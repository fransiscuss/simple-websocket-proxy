import { SessionState, Direction } from '@prisma/client';
import { ProxyConnection, TrafficSample, EndpointSampling, RateLimit } from '../types';
import { DatabaseService, getDatabaseService } from './database';
import { loggers, logError, logMessage } from '../utils/logger';

export class SessionManager {
  private database: DatabaseService;
  private logger = loggers.session();
  private activeSessions = new Map<string, ProxyConnection>();
  private rateLimits = new Map<string, RateLimit>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.database = getDatabaseService();
    this.startCleanupTimer();
  }

  // Session lifecycle management
  async createSession(endpointId: string, clientWs: import('ws').WebSocket): Promise<string> {
    try {
      const sessionId = await this.database.createSession(endpointId);
      
      const connection: ProxyConnection = {
        sessionId,
        endpointId,
        clientWs,
        targetWs: null,
        metrics: {
          msgsIn: 0,
          msgsOut: 0,
          bytesIn: 0,
          bytesOut: 0
        },
        lastActivity: new Date(),
        state: 'connecting'
      };

      this.activeSessions.set(sessionId, connection);

      this.logger.info({
        sessionId,
        endpointId,
        activeConnections: this.activeSessions.size
      }, 'Session created');

      return sessionId;
    } catch (error) {
      logError(this.logger, error as Error, 'Failed to create session', { endpointId });
      throw error;
    }
  }

  async closeSession(sessionId: string, state: SessionState = SessionState.CLOSED): Promise<void> {
    const connection = this.activeSessions.get(sessionId);
    if (!connection) {
      this.logger.warn({ sessionId }, 'Attempted to close non-existent session');
      return;
    }

    try {
      // Update final metrics in database
      await this.updateSessionMetrics(sessionId, connection.metrics);
      await this.database.closeSession(sessionId, state);

      // Clean up connection state
      connection.state = 'closed';
      this.activeSessions.delete(sessionId);

      this.logger.info({
        sessionId,
        endpointId: connection.endpointId,
        state,
        metrics: connection.metrics,
        activeConnections: this.activeSessions.size
      }, 'Session closed');

    } catch (error) {
      logError(this.logger, error as Error, 'Failed to close session', { sessionId });
      // Still remove from active sessions even if database update fails
      this.activeSessions.delete(sessionId);
    }
  }

  getSession(sessionId: string): ProxyConnection | undefined {
    return this.activeSessions.get(sessionId);
  }

  getActiveSessionCount(): number {
    return this.activeSessions.size;
  }

  getActiveSessionsForEndpoint(endpointId: string): ProxyConnection[] {
    return Array.from(this.activeSessions.values())
      .filter(conn => conn.endpointId === endpointId);
  }

  updateConnectionState(sessionId: string, state: ProxyConnection['state']): void {
    const connection = this.activeSessions.get(sessionId);
    if (connection) {
      connection.state = state;
      connection.lastActivity = new Date();
    }
  }

  setTargetWebSocket(sessionId: string, targetWs: import('ws').WebSocket): void {
    const connection = this.activeSessions.get(sessionId);
    if (connection) {
      connection.targetWs = targetWs;
      connection.state = 'connected';
      connection.lastActivity = new Date();
    }
  }

  // Message tracking and metrics
  async trackMessage(
    sessionId: string,
    direction: 'inbound' | 'outbound',
    size: number,
    type: 'text' | 'binary',
    content?: string | Buffer,
    sampling?: EndpointSampling
  ): Promise<void> {
    const connection = this.activeSessions.get(sessionId);
    if (!connection) {
      this.logger.warn({ sessionId }, 'Attempted to track message for non-existent session');
      return;
    }

    try {
      // Update connection metrics
      if (direction === 'inbound') {
        connection.metrics.msgsIn++;
        connection.metrics.bytesIn += size;
      } else {
        connection.metrics.msgsOut++;
        connection.metrics.bytesOut += size;
      }
      connection.lastActivity = new Date();

      // Log message
      logMessage(sessionId, connection.endpointId, direction, size, type);

      // Handle traffic sampling
      if (sampling?.enabled && this.shouldSample(sampling.sampleRate || 0.1)) {
        await this.sampleTraffic(
          sessionId,
          connection.endpointId,
          direction === 'inbound' ? Direction.INBOUND : Direction.OUTBOUND,
          size,
          content,
          sampling
        );
      }

      // Periodically update database (every 10 messages or 30 seconds)
      const totalMessages = connection.metrics.msgsIn + connection.metrics.msgsOut;
      if (totalMessages % 10 === 0 || this.shouldUpdateMetrics(connection.lastActivity)) {
        await this.updateSessionMetrics(sessionId, connection.metrics);
      }

    } catch (error) {
      logError(this.logger, error as Error, 'Failed to track message', {
        sessionId,
        direction,
        size
      });
    }
  }

  private async updateSessionMetrics(sessionId: string, metrics: ProxyConnection['metrics']): Promise<void> {
    try {
      await this.database.updateSession(sessionId, {
        lastSeen: new Date(),
        msgsIn: metrics.msgsIn,
        msgsOut: metrics.msgsOut,
        bytesIn: BigInt(metrics.bytesIn),
        bytesOut: BigInt(metrics.bytesOut)
      });
    } catch (error) {
      logError(this.logger, error as Error, 'Failed to update session metrics', { sessionId });
    }
  }

  // Traffic sampling
  private async sampleTraffic(
    sessionId: string,
    endpointId: string,
    direction: Direction,
    size: number,
    content?: string | Buffer,
    sampling?: EndpointSampling
  ): Promise<void> {
    try {
      let sampleContent: string | undefined;

      if (sampling?.storeContent && content) {
        const maxSize = sampling.maxSampleSize || 1024;
        if (Buffer.isBuffer(content)) {
          sampleContent = content.toString('base64').substring(0, maxSize);
        } else {
          sampleContent = content.substring(0, maxSize);
        }
      }

      const sample: Omit<TrafficSample, 'id'> = {
        sessionId,
        endpointId,
        direction,
        timestamp: new Date(),
        sizeBytes: size,
        content: sampleContent
      };

      await this.database.createTrafficSample(sample);

      logMessage(sessionId, endpointId, 
        direction === Direction.INBOUND ? 'inbound' : 'outbound',
        size, 'text', true);

    } catch (error) {
      logError(this.logger, error as Error, 'Failed to sample traffic', {
        sessionId,
        direction
      });
    }
  }

  private shouldSample(sampleRate: number): boolean {
    return Math.random() < sampleRate;
  }

  // Rate limiting
  checkRateLimit(endpointId: string, limitRpm?: number): boolean {
    if (!limitRpm) return true;

    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute window
    const key = endpointId;
    
    let rateLimit = this.rateLimits.get(key);
    
    if (!rateLimit || now - rateLimit.lastReset > windowMs) {
      // Reset window
      rateLimit = {
        requests: 0,
        windowMs,
        lastReset: now
      };
      this.rateLimits.set(key, rateLimit);
    }

    rateLimit.requests++;

    if (rateLimit.requests > limitRpm) {
      this.logger.warn({
        endpointId,
        requests: rateLimit.requests,
        limit: limitRpm,
        windowMs
      }, 'Rate limit exceeded');
      return false;
    }

    return true;
  }

  // Connection limits
  async checkConnectionLimit(endpointId: string, maxConnections?: number): Promise<boolean> {
    if (!maxConnections) return true;

    try {
      const activeCount = await this.database.getActiveConnectionCount(endpointId);
      
      if (activeCount >= maxConnections) {
        this.logger.warn({
          endpointId,
          activeCount,
          limit: maxConnections
        }, 'Connection limit exceeded');
        return false;
      }

      return true;
    } catch (error) {
      logError(this.logger, error as Error, 'Failed to check connection limit', { endpointId });
      return false;
    }
  }

  // Backpressure monitoring
  checkBackpressure(sessionId: string, threshold: number = 16 * 1024): boolean {
    const connection = this.activeSessions.get(sessionId);
    if (!connection) return false;

    const clientBuffered = connection.clientWs.bufferedAmount || 0;
    const targetBuffered = connection.targetWs?.bufferedAmount || 0;

    if (clientBuffered > threshold || targetBuffered > threshold) {
      this.logger.warn({
        sessionId,
        clientBuffered,
        targetBuffered,
        threshold
      }, 'Backpressure detected');
      return true;
    }

    return false;
  }

  // Cleanup and maintenance
  private startCleanupTimer(): void {
    // Run cleanup every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupStaleSessions();
    }, 5 * 60 * 1000);
  }

  private async cleanupStaleSessions(): Promise<void> {
    const now = Date.now();
    const staleThreshold = 30 * 60 * 1000; // 30 minutes
    const staleSessions: string[] = [];

    for (const [sessionId, connection] of this.activeSessions) {
      const timeSinceActivity = now - connection.lastActivity.getTime();
      
      if (timeSinceActivity > staleThreshold) {
        staleSessions.push(sessionId);
      }
    }

    if (staleSessions.length > 0) {
      this.logger.info({
        staleSessionCount: staleSessions.length,
        staleThresholdMinutes: staleThreshold / (60 * 1000)
      }, 'Cleaning up stale sessions');

      for (const sessionId of staleSessions) {
        await this.closeSession(sessionId, SessionState.FAILED);
      }
    }

    // Clean up rate limit entries
    this.cleanupRateLimits();
  }

  private cleanupRateLimits(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, rateLimit] of this.rateLimits) {
      if (now - rateLimit.lastReset > rateLimit.windowMs) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.rateLimits.delete(key);
    }
  }

  private shouldUpdateMetrics(lastActivity: Date): boolean {
    const timeSinceUpdate = Date.now() - lastActivity.getTime();
    return timeSinceUpdate > 30 * 1000; // 30 seconds
  }

  // Shutdown
  async shutdown(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Close all active sessions
    const sessionIds = Array.from(this.activeSessions.keys());
    for (const sessionId of sessionIds) {
      await this.closeSession(sessionId, SessionState.CLOSED);
    }

    this.logger.info('Session manager shutdown complete');
  }

  // Get all active sessions
  getActiveSessions(): Map<string, ProxyConnection> {
    return new Map(this.activeSessions);
  }

  // Force kill a session
  async killSession(sessionId: string): Promise<boolean> {
    const connection = this.activeSessions.get(sessionId);
    if (!connection) {
      this.logger.warn({ sessionId }, 'Attempted to kill non-existent session');
      return false;
    }

    try {
      // Force close WebSocket connections
      if (connection.clientWs.readyState === 1) { // OPEN
        connection.clientWs.close(1000, 'Force closed by admin');
      }
      if (connection.targetWs && connection.targetWs.readyState === 1) { // OPEN
        connection.targetWs.close(1000, 'Force closed by admin');
      }

      // Close session with FAILED state to indicate forced closure
      await this.closeSession(sessionId, SessionState.FAILED);
      
      this.logger.info({ sessionId }, 'Session force killed');
      return true;
    } catch (error) {
      logError(this.logger, error as Error, 'Failed to kill session', { sessionId });
      return false;
    }
  }

  // Statistics
  getStatistics(): {
    activeConnections: number;
    totalSessions: number;
    endpointStats: Record<string, { sessions: number; totalMessages: number; totalBytes: number }>;
  } {
    const endpointStats: Record<string, { sessions: number; totalMessages: number; totalBytes: number }> = {};

    for (const connection of this.activeSessions.values()) {
      const { endpointId, metrics } = connection;
      
      if (!endpointStats[endpointId]) {
        endpointStats[endpointId] = { sessions: 0, totalMessages: 0, totalBytes: 0 };
      }

      endpointStats[endpointId].sessions++;
      endpointStats[endpointId].totalMessages += metrics.msgsIn + metrics.msgsOut;
      endpointStats[endpointId].totalBytes += metrics.bytesIn + metrics.bytesOut;
    }

    return {
      activeConnections: this.activeSessions.size,
      totalSessions: this.activeSessions.size,
      endpointStats
    };
  }
}

// Singleton instance
let sessionManager: SessionManager | null = null;

export function getSessionManager(): SessionManager {
  if (!sessionManager) {
    sessionManager = new SessionManager();
  }
  return sessionManager;
}

export async function shutdownSessionManager(): Promise<void> {
  if (sessionManager) {
    await sessionManager.shutdown();
    sessionManager = null;
  }
}