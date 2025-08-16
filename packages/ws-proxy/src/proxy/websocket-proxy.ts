import WebSocket from 'ws';
import { IncomingMessage } from 'http';
import { SessionState } from '@prisma/client';
import {
  EndpointConfig,
  ProxyError,
  EndpointNotFoundError,
  EndpointDisabledError,
  ConnectionLimitExceededError,
  MessageTooLargeError,
  TargetConnectionError,
  WebSocketMessage
} from '../types';
import { DatabaseService, getDatabaseService } from '../services/database';
import { SessionManager, getSessionManager } from '../services/session-manager';
import { loggers, logError, logConnectionEvent, logBackpressure } from '../utils/logger';

export class WebSocketProxy {
  private database: DatabaseService;
  private sessionManager: SessionManager;
  private logger = loggers.proxy();

  constructor() {
    this.database = getDatabaseService();
    this.sessionManager = getSessionManager();
  }

  async handleConnection(ws: WebSocket, request: IncomingMessage, endpointId: string): Promise<void> {
    let sessionId: string | null = null;
    let endpoint: EndpointConfig | null = null;

    try {
      // Get endpoint configuration
      endpoint = await this.database.getEndpoint(endpointId);
      if (!endpoint) {
        throw new EndpointNotFoundError(endpointId);
      }

      if (!endpoint.enabled) {
        throw new EndpointDisabledError(endpointId);
      }

      // Check connection limits
      const canConnect = await this.sessionManager.checkConnectionLimit(
        endpointId,
        endpoint.limits.maxConnections
      );
      if (!canConnect) {
        throw new ConnectionLimitExceededError(
          endpointId,
          endpoint.limits.maxConnections || 0
        );
      }

      // Check rate limits
      const rateLimitOk = this.sessionManager.checkRateLimit(
        endpointId,
        endpoint.limits.rateLimitRpm
      );
      if (!rateLimitOk) {
        throw new ProxyError('Rate limit exceeded', 'RATE_LIMIT_EXCEEDED', 429);
      }

      // Create session
      sessionId = await this.sessionManager.createSession(endpointId, ws);
      
      logConnectionEvent(sessionId, endpointId, 'connect', {
        clientIP: this.getClientIP(request),
        userAgent: request.headers['user-agent'],
        targetUrl: endpoint.targetUrl
      });

      // Set up client WebSocket handlers
      this.setupClientHandlers(ws, sessionId, endpoint);

      // Connect to target
      await this.connectToTarget(sessionId, endpoint);

    } catch (error) {
      this.handleConnectionError(ws, sessionId, endpointId, error as Error);
    }
  }

  private async connectToTarget(sessionId: string, endpoint: EndpointConfig): Promise<void> {
    const connection = this.sessionManager.getSession(sessionId);
    if (!connection) {
      throw new ProxyError('Session not found', 'SESSION_NOT_FOUND');
    }

    try {
      // Create target WebSocket connection
      const targetWs = new WebSocket(endpoint.targetUrl, {
        handshakeTimeout: endpoint.limits.connectionTimeoutMs || 10000,
        perMessageDeflate: false, // Disable compression for lower latency
        maxPayload: endpoint.limits.maxMessageSize || 16 * 1024 * 1024
      });

      // Set up target connection handlers
      this.setupTargetHandlers(targetWs, sessionId, endpoint);

      // Wait for target connection to open
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new TargetConnectionError(endpoint.targetUrl, new Error('Connection timeout')));
        }, endpoint.limits.connectionTimeoutMs || 10000);

        targetWs.once('open', () => {
          clearTimeout(timeout);
          this.sessionManager.setTargetWebSocket(sessionId, targetWs);
          logConnectionEvent(sessionId, endpoint.id, 'target-connect', {
            targetUrl: endpoint.targetUrl
          });
          resolve();
        });

        targetWs.once('error', (error) => {
          clearTimeout(timeout);
          reject(new TargetConnectionError(endpoint.targetUrl, error));
        });
      });

    } catch (error) {
      logError(this.logger, error as Error, 'Failed to connect to target', {
        sessionId,
        targetUrl: endpoint.targetUrl
      });
      
      await this.sessionManager.closeSession(sessionId, SessionState.FAILED);
      throw error;
    }
  }

  private setupClientHandlers(ws: WebSocket, sessionId: string, endpoint: EndpointConfig): void {
    // Message handler
    ws.on('message', async (data: WebSocket.RawData, isBinary: boolean) => {
      try {
        await this.handleClientMessage(sessionId, data, isBinary, endpoint);
      } catch (error) {
        logError(this.logger, error as Error, 'Error handling client message', { sessionId });
        this.closeConnection(sessionId, SessionState.FAILED);
      }
    });

    // Close handler
    ws.on('close', async (code: number, reason: Buffer) => {
      logConnectionEvent(sessionId, endpoint.id, 'disconnect', {
        code,
        reason: reason.toString()
      });
      await this.sessionManager.closeSession(sessionId, SessionState.CLOSED);
    });

    // Error handler
    ws.on('error', async (error: Error) => {
      logConnectionEvent(sessionId, endpoint.id, 'error', { error: error.message });
      await this.sessionManager.closeSession(sessionId, SessionState.FAILED);
    });

    // Ping/pong for keepalive
    ws.on('pong', () => {
      // Update last activity
      const connection = this.sessionManager.getSession(sessionId);
      if (connection) {
        connection.lastActivity = new Date();
      }
    });

    // Set up idle timeout
    if (endpoint.limits.idleTimeoutMs) {
      const idleTimer = setTimeout(() => {
        this.logger.info({ sessionId }, 'Closing idle connection');
        this.closeConnection(sessionId, SessionState.CLOSED);
      }, endpoint.limits.idleTimeoutMs);

      ws.on('close', () => clearTimeout(idleTimer));
      ws.on('message', () => {
        clearTimeout(idleTimer);
        setTimeout(() => {
          if (ws.readyState === WebSocket.OPEN) {
            this.closeConnection(sessionId, SessionState.CLOSED);
          }
        }, endpoint.limits.idleTimeoutMs!);
      });
    }
  }

  private setupTargetHandlers(targetWs: WebSocket, sessionId: string, endpoint: EndpointConfig): void {
    // Message handler
    targetWs.on('message', async (data: WebSocket.RawData, isBinary: boolean) => {
      try {
        await this.handleTargetMessage(sessionId, data, isBinary, endpoint);
      } catch (error) {
        logError(this.logger, error as Error, 'Error handling target message', { sessionId });
        this.closeConnection(sessionId, SessionState.FAILED);
      }
    });

    // Close handler
    targetWs.on('close', (code: number, reason: Buffer) => {
      logConnectionEvent(sessionId, endpoint.id, 'target-disconnect', {
        code,
        reason: reason.toString()
      });
      this.closeConnection(sessionId, SessionState.CLOSED);
    });

    // Error handler
    targetWs.on('error', (error: Error) => {
      logError(this.logger, error as Error, 'Target WebSocket error', { sessionId });
      this.closeConnection(sessionId, SessionState.FAILED);
    });
  }

  private async handleClientMessage(
    sessionId: string,
    data: WebSocket.RawData,
    isBinary: boolean,
    endpoint: EndpointConfig
  ): Promise<void> {
    const connection = this.sessionManager.getSession(sessionId);
    if (!connection || !connection.targetWs || connection.targetWs.readyState !== WebSocket.OPEN) {
      this.logger.warn({ sessionId }, 'Received message but target not connected');
      return;
    }

    const message = this.processMessage(data, isBinary);

    // Check message size limits
    if (endpoint.limits.maxMessageSize && message.size > endpoint.limits.maxMessageSize) {
      throw new MessageTooLargeError(message.size, endpoint.limits.maxMessageSize);
    }

    // Check backpressure
    if (this.sessionManager.checkBackpressure(sessionId, 16 * 1024)) {
      logBackpressure(
        sessionId,
        endpoint.id,
        connection.clientWs.bufferedAmount || 0,
        connection.targetWs.bufferedAmount || 0,
        16 * 1024
      );
      
      // Optionally pause or drop messages under backpressure
      if (connection.targetWs.bufferedAmount > 64 * 1024) {
        this.logger.warn({ sessionId }, 'Dropping message due to severe backpressure');
        return;
      }
    }

    // Forward message to target
    try {
      if (isBinary) {
        connection.targetWs.send(message.data as Buffer);
      } else {
        connection.targetWs.send(message.data as string);
      }

      // Track message metrics
      await this.sessionManager.trackMessage(
        sessionId,
        'inbound',
        message.size,
        message.type,
        message.data,
        endpoint.sampling
      );

    } catch (error) {
      logError(this.logger, error as Error, 'Failed to forward message to target', { sessionId });
      throw error;
    }
  }

  private async handleTargetMessage(
    sessionId: string,
    data: WebSocket.RawData,
    isBinary: boolean,
    endpoint: EndpointConfig
  ): Promise<void> {
    const connection = this.sessionManager.getSession(sessionId);
    if (!connection || connection.clientWs.readyState !== WebSocket.OPEN) {
      this.logger.warn({ sessionId }, 'Received target message but client not connected');
      return;
    }

    const message = this.processMessage(data, isBinary);

    // Check backpressure
    if (this.sessionManager.checkBackpressure(sessionId, 16 * 1024)) {
      logBackpressure(
        sessionId,
        endpoint.id,
        connection.clientWs.bufferedAmount || 0,
        connection.targetWs?.bufferedAmount || 0,
        16 * 1024
      );
      
      // Optionally pause or drop messages under backpressure
      if (connection.clientWs.bufferedAmount > 64 * 1024) {
        this.logger.warn({ sessionId }, 'Dropping message due to severe backpressure');
        return;
      }
    }

    // Forward message to client
    try {
      if (isBinary) {
        connection.clientWs.send(message.data as Buffer);
      } else {
        connection.clientWs.send(message.data as string);
      }

      // Track message metrics
      await this.sessionManager.trackMessage(
        sessionId,
        'outbound',
        message.size,
        message.type,
        message.data,
        endpoint.sampling
      );

    } catch (error) {
      logError(this.logger, error as Error, 'Failed to forward message to client', { sessionId });
      throw error;
    }
  }

  private processMessage(data: WebSocket.RawData, isBinary: boolean): WebSocketMessage {
    let processedData: Buffer | string;
    let size: number;

    if (isBinary) {
      if (Buffer.isBuffer(data)) {
        processedData = data;
        size = data.length;
      } else if (data instanceof ArrayBuffer) {
        processedData = Buffer.from(data);
        size = data.byteLength;
      } else if (Array.isArray(data)) {
        processedData = Buffer.concat(data);
        size = processedData.length;
      } else {
        processedData = Buffer.from(data);
        size = processedData.length;
      }
    } else {
      if (Buffer.isBuffer(data)) {
        processedData = data.toString('utf8');
        size = data.length;
      } else if (Array.isArray(data)) {
        const buffer = Buffer.concat(data);
        processedData = buffer.toString('utf8');
        size = buffer.length;
      } else {
        processedData = data.toString();
        size = Buffer.byteLength(processedData, 'utf8');
      }
    }

    return {
      type: isBinary ? 'binary' : 'text',
      data: processedData,
      size
    };
  }

  private closeConnection(sessionId: string, state: SessionState): void {
    const connection = this.sessionManager.getSession(sessionId);
    if (!connection) return;

    try {
      // Close client WebSocket if open
      if (connection.clientWs.readyState === WebSocket.OPEN) {
        connection.clientWs.close(1000, 'Proxy closing connection');
      }

      // Close target WebSocket if open
      if (connection.targetWs && connection.targetWs.readyState === WebSocket.OPEN) {
        connection.targetWs.close(1000, 'Proxy closing connection');
      }

      // Update session state
      this.sessionManager.closeSession(sessionId, state);

    } catch (error) {
      logError(this.logger, error as Error, 'Error closing connection', { sessionId });
    }
  }

  private handleConnectionError(
    ws: WebSocket,
    sessionId: string | null,
    endpointId: string | null,
    error: Error
  ): void {
    logError(this.logger, error, 'Connection error', { 
      sessionId: sessionId || undefined, 
      endpointId: endpointId || undefined 
    });

    let statusCode = 500;
    let errorCode = 'INTERNAL_ERROR';
    let message = 'Internal server error';

    if (error instanceof ProxyError) {
      statusCode = error.statusCode;
      errorCode = error.code;
      message = error.message;
    }

    // Send error response to client
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.close(statusCode === 404 ? 1002 : 1011, message);
      } catch (closeError) {
        logError(this.logger, closeError as Error, 'Error closing WebSocket after error');
      }
    }

    // Clean up session if created
    if (sessionId) {
      this.sessionManager.closeSession(sessionId, SessionState.FAILED);
    }
  }

  private getClientIP(request: IncomingMessage): string {
    const xForwardedFor = request.headers['x-forwarded-for'];
    if (xForwardedFor) {
      return Array.isArray(xForwardedFor) ? xForwardedFor[0] : xForwardedFor.split(',')[0];
    }
    return request.socket.remoteAddress || 'unknown';
  }

  // Health and statistics
  getActiveConnections(): number {
    return this.sessionManager.getActiveSessionCount();
  }

  getStatistics() {
    return this.sessionManager.getStatistics();
  }

  // Graceful shutdown
  async shutdown(): Promise<void> {
    this.logger.info('WebSocket proxy shutting down');
    
    // Close all active connections
    const stats = this.sessionManager.getStatistics();
    if (stats.activeConnections > 0) {
      this.logger.info(
        { activeConnections: stats.activeConnections },
        'Closing active connections'
      );
      
      // Give connections time to close gracefully
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    this.logger.info('WebSocket proxy shutdown complete');
  }
}

// Singleton instance
let webSocketProxy: WebSocketProxy | null = null;

export function getWebSocketProxy(): WebSocketProxy {
  if (!webSocketProxy) {
    webSocketProxy = new WebSocketProxy();
  }
  return webSocketProxy;
}

export async function shutdownWebSocketProxy(): Promise<void> {
  if (webSocketProxy) {
    await webSocketProxy.shutdown();
    webSocketProxy = null;
  }
}