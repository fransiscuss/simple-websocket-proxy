import { PrismaClient, Endpoint, LiveSession, SessionState } from '@prisma/client';
import { EndpointConfig, EndpointLimits, EndpointSampling, SessionMetrics, SessionUpdate, TrafficSample as TrafficSampleType } from '../types';
import { loggers, logDatabaseOperation, logError } from '../utils/logger';

export class DatabaseService {
  private prisma: PrismaClient;
  private logger = loggers.database();

  constructor() {
    this.prisma = new PrismaClient({
      log: [
        { level: 'info', emit: 'stdout' },
        { level: 'warn', emit: 'stdout' },
        { level: 'error', emit: 'stdout' }
      ]
    });
  }

  async connect(): Promise<void> {
    const startTime = process.hrtime();
    
    try {
      await this.prisma.$connect();
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const durationMs = seconds * 1000 + nanoseconds / 1000000;
      
      this.logger.info({ durationMs }, 'Database connected successfully');
    } catch (error) {
      logError(this.logger, error as Error, 'Failed to connect to database');
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.prisma.$disconnect();
      this.logger.info('Database disconnected successfully');
    } catch (error) {
      logError(this.logger, error as Error, 'Error disconnecting from database');
      throw error;
    }
  }

  async healthCheck(): Promise<{ connected: boolean; responseTimeMs?: number }> {
    const startTime = process.hrtime();
    
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const responseTimeMs = seconds * 1000 + nanoseconds / 1000000;
      
      return { connected: true, responseTimeMs };
    } catch (error) {
      logError(this.logger, error as Error, 'Database health check failed');
      return { connected: false };
    }
  }

  // Endpoint operations
  async getEndpoint(id: string): Promise<EndpointConfig | null> {
    logDatabaseOperation('select', 'endpoint', id);
    const startTime = process.hrtime();
    
    try {
      const endpoint = await this.prisma.endpoint.findUnique({
        where: { id }
      });

      if (!endpoint) {
        return null;
      }

      const [seconds, nanoseconds] = process.hrtime(startTime);
      const durationMs = seconds * 1000 + nanoseconds / 1000000;
      logDatabaseOperation('select', 'endpoint', id, durationMs);

      return this.mapEndpointToConfig(endpoint);
    } catch (error) {
      logError(this.logger, error as Error, 'Failed to get endpoint', { endpointId: id });
      throw error;
    }
  }

  async getAllEndpoints(): Promise<EndpointConfig[]> {
    logDatabaseOperation('select', 'endpoint');
    const startTime = process.hrtime();
    
    try {
      const endpoints = await this.prisma.endpoint.findMany({
        orderBy: { createdAt: 'desc' }
      });

      const [seconds, nanoseconds] = process.hrtime(startTime);
      const durationMs = seconds * 1000 + nanoseconds / 1000000;
      logDatabaseOperation('select', 'endpoint', undefined, durationMs);

      return endpoints.map(this.mapEndpointToConfig);
    } catch (error) {
      logError(this.logger, error as Error, 'Failed to get all endpoints');
      throw error;
    }
  }

  async getActiveConnectionCount(endpointId: string): Promise<number> {
    logDatabaseOperation('count', 'live_session', endpointId);
    
    try {
      const count = await this.prisma.liveSession.count({
        where: {
          endpointId,
          state: SessionState.ACTIVE
        }
      });

      return count;
    } catch (error) {
      logError(this.logger, error as Error, 'Failed to get active connection count', { endpointId });
      throw error;
    }
  }

  // Session operations
  async createSession(endpointId: string): Promise<string> {
    logDatabaseOperation('create', 'live_session', endpointId);
    const startTime = process.hrtime();
    
    try {
      const session = await this.prisma.liveSession.create({
        data: {
          endpointId,
          state: SessionState.ACTIVE
        }
      });

      const [seconds, nanoseconds] = process.hrtime(startTime);
      const durationMs = seconds * 1000 + nanoseconds / 1000000;
      logDatabaseOperation('create', 'live_session', session.id, durationMs);

      return session.id;
    } catch (error) {
      logError(this.logger, error as Error, 'Failed to create session', { endpointId });
      throw error;
    }
  }

  async updateSession(sessionId: string, updates: SessionUpdate): Promise<void> {
    logDatabaseOperation('update', 'live_session', sessionId);
    const startTime = process.hrtime();
    
    try {
      await this.prisma.liveSession.update({
        where: { id: sessionId },
        data: {
          ...(updates.lastSeen && { lastSeen: updates.lastSeen }),
          ...(updates.msgsIn !== undefined && { msgsIn: updates.msgsIn }),
          ...(updates.msgsOut !== undefined && { msgsOut: updates.msgsOut }),
          ...(updates.bytesIn !== undefined && { bytesIn: updates.bytesIn }),
          ...(updates.bytesOut !== undefined && { bytesOut: updates.bytesOut }),
          ...(updates.state && { state: updates.state })
        }
      });

      const [seconds, nanoseconds] = process.hrtime(startTime);
      const durationMs = seconds * 1000 + nanoseconds / 1000000;
      logDatabaseOperation('update', 'live_session', sessionId, durationMs);
    } catch (error) {
      logError(this.logger, error as Error, 'Failed to update session', { sessionId, updates });
      throw error;
    }
  }

  async getSession(sessionId: string): Promise<SessionMetrics | null> {
    logDatabaseOperation('select', 'live_session', sessionId);
    
    try {
      const session = await this.prisma.liveSession.findUnique({
        where: { id: sessionId }
      });

      if (!session) {
        return null;
      }

      return this.mapSessionToMetrics(session);
    } catch (error) {
      logError(this.logger, error as Error, 'Failed to get session', { sessionId });
      throw error;
    }
  }

  async closeSession(sessionId: string, state: SessionState = SessionState.CLOSED): Promise<void> {
    await this.updateSession(sessionId, {
      state,
      lastSeen: new Date()
    });
  }

  async getActiveSessions(endpointId?: string): Promise<SessionMetrics[]> {
    logDatabaseOperation('select', 'live_session', endpointId);
    
    try {
      const sessions = await this.prisma.liveSession.findMany({
        where: {
          ...(endpointId && { endpointId }),
          state: SessionState.ACTIVE
        },
        orderBy: { startedAt: 'desc' }
      });

      return sessions.map(this.mapSessionToMetrics);
    } catch (error) {
      logError(this.logger, error as Error, 'Failed to get active sessions', { endpointId });
      throw error;
    }
  }

  // Traffic sampling operations
  async createTrafficSample(sample: Omit<TrafficSampleType, 'id'>): Promise<void> {
    logDatabaseOperation('create', 'traffic_sample', sample.sessionId);
    
    try {
      await this.prisma.trafficSample.create({
        data: {
          sessionId: sample.sessionId,
          endpointId: sample.endpointId,
          direction: sample.direction,
          timestamp: sample.timestamp,
          sizeBytes: sample.sizeBytes,
          content: sample.content || null
        }
      });
    } catch (error) {
      logError(this.logger, error as Error, 'Failed to create traffic sample', { 
        sessionId: sample.sessionId,
        direction: sample.direction
      });
      throw error;
    }
  }

  async getTrafficSamples(
    sessionId?: string,
    endpointId?: string,
    limit: number = 100
  ): Promise<TrafficSampleType[]> {
    logDatabaseOperation('select', 'traffic_sample');
    
    try {
      const samples = await this.prisma.trafficSample.findMany({
        where: {
          ...(sessionId && { sessionId }),
          ...(endpointId && { endpointId })
        },
        orderBy: { timestamp: 'desc' },
        take: limit
      });

      return samples.map(sample => ({
        id: sample.id,
        sessionId: sample.sessionId,
        endpointId: sample.endpointId,
        direction: sample.direction,
        timestamp: sample.timestamp,
        sizeBytes: sample.sizeBytes,
        content: sample.content || undefined
      }));
    } catch (error) {
      logError(this.logger, error as Error, 'Failed to get traffic samples', { sessionId, endpointId });
      throw error;
    }
  }

  // Cleanup operations
  async cleanupOldSessions(olderThanHours: number = 24): Promise<number> {
    logDatabaseOperation('delete', 'live_session');
    
    try {
      const cutoffDate = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
      
      const result = await this.prisma.liveSession.deleteMany({
        where: {
          state: { in: [SessionState.CLOSED, SessionState.FAILED] },
          lastSeen: { lt: cutoffDate }
        }
      });

      this.logger.info({ 
        deletedCount: result.count,
        cutoffDate,
        olderThanHours
      }, 'Cleaned up old sessions');

      return result.count;
    } catch (error) {
      logError(this.logger, error as Error, 'Failed to cleanup old sessions');
      throw error;
    }
  }

  async cleanupOldTrafficSamples(olderThanDays: number = 7): Promise<number> {
    logDatabaseOperation('delete', 'traffic_sample');
    
    try {
      const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
      
      const result = await this.prisma.trafficSample.deleteMany({
        where: {
          timestamp: { lt: cutoffDate }
        }
      });

      this.logger.info({ 
        deletedCount: result.count,
        cutoffDate,
        olderThanDays
      }, 'Cleaned up old traffic samples');

      return result.count;
    } catch (error) {
      logError(this.logger, error as Error, 'Failed to cleanup old traffic samples');
      throw error;
    }
  }

  // Helper methods
  private mapEndpointToConfig(endpoint: Endpoint): EndpointConfig {
    return {
      id: endpoint.id,
      name: endpoint.name,
      targetUrl: endpoint.targetUrl,
      limits: endpoint.limits as unknown as EndpointLimits,
      sampling: endpoint.sampling as unknown as EndpointSampling,
      enabled: endpoint.enabled,
      createdAt: endpoint.createdAt,
      updatedAt: endpoint.updatedAt
    };
  }

  private mapSessionToMetrics(session: LiveSession): SessionMetrics {
    return {
      id: session.id,
      endpointId: session.endpointId,
      startedAt: session.startedAt,
      lastSeen: session.lastSeen,
      msgsIn: session.msgsIn,
      msgsOut: session.msgsOut,
      bytesIn: session.bytesIn,
      bytesOut: session.bytesOut,
      state: session.state
    };
  }

  // Expose Prisma client for complex queries if needed
  get client(): PrismaClient {
    return this.prisma;
  }
}

// Singleton instance
let databaseService: DatabaseService | null = null;

export function getDatabaseService(): DatabaseService {
  if (!databaseService) {
    databaseService = new DatabaseService();
  }
  return databaseService;
}

export async function initializeDatabase(): Promise<DatabaseService> {
  const service = getDatabaseService();
  await service.connect();
  return service;
}

export async function shutdownDatabase(): Promise<void> {
  if (databaseService) {
    await databaseService.disconnect();
    databaseService = null;
  }
}

// Export prisma client for direct use in routes
export const prisma = new PrismaClient();