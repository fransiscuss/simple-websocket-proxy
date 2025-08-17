import express from 'express';
import cors from 'cors';
import WebSocket from 'ws';
import { createServer } from 'http';
import { URL } from 'url';
import { ServerConfig, HealthStatus } from './types';
import { initializeDatabase, shutdownDatabase } from './services/database';
import { getSessionManager, shutdownSessionManager } from './services/session-manager';
import { getWebSocketProxy, shutdownWebSocketProxy } from './proxy/websocket-proxy';
import { getTelemetryService, shutdownTelemetryService } from './services/telemetry';
import { createLogger, loggers, logError, logShutdown } from './utils/logger';
import { authRouter } from './routes/auth';
import { endpointsRouter } from './routes/endpoints';
import { sessionsRouter } from './routes/sessions';
import { auditRouter } from './routes/audit';

// Configuration
const config: ServerConfig = {
  port: parseInt(process.env.PORT || '3001'),
  host: process.env.HOST || '0.0.0.0',
  cors: {
    origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true
  },
  proxy: {
    connectionTimeoutMs: parseInt(process.env.CONNECTION_TIMEOUT_MS || '10000'),
    idleTimeoutMs: parseInt(process.env.IDLE_TIMEOUT_MS || '300000'),
    maxMessageSize: parseInt(process.env.MAX_MESSAGE_SIZE || '16777216'),
    backpressureThreshold: parseInt(process.env.BACKPRESSURE_THRESHOLD || '16384')
  },
  database: {
    url: process.env.DATABASE_URL || 'postgresql://localhost:5432/ws_proxy',
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '10'),
    connectionTimeoutMs: parseInt(process.env.DB_CONNECTION_TIMEOUT_MS || '5000')
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    pretty: process.env.NODE_ENV === 'development'
  }
};

class WebSocketProxyServer {
  private app: express.Application;
  private server: ReturnType<typeof createServer>;
  private wss: WebSocket.Server;
  private logger = loggers.server();
  private startTime = Date.now();

  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.wss = new WebSocket.Server({ 
      server: this.server,
      path: '/ws',
      perMessageDeflate: false, // Disable compression for lower latency
      maxPayload: config.proxy.maxMessageSize
    });

    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocketServer();
    this.setupGracefulShutdown();
  }

  private setupMiddleware(): void {
    // CORS
    this.app.use(cors({
      origin: config.cors.origin,
      credentials: config.cors.credentials
    }));

    // JSON parsing
    this.app.use(express.json({ limit: '10mb' }));

    // Request logging
    this.app.use((req, res, next) => {
      const startTime = process.hrtime();
      const requestId = Math.random().toString(36).substring(7);
      
      (req.headers as Record<string, unknown>)['x-request-id'] = requestId;
      
      res.on('finish', () => {
        const [seconds, nanoseconds] = process.hrtime(startTime);
        const durationMs = seconds * 1000 + nanoseconds / 1000000;
        
        this.logger.info({
          requestId,
          method: req.method,
          url: req.url,
          statusCode: res.statusCode,
          durationMs: Math.round(durationMs * 100) / 100,
          userAgent: req.headers['user-agent'],
          ip: this.getClientIP(req)
        }, `${req.method} ${req.url} ${res.statusCode}`);
      });

      next();
    });
  }

  private setupRoutes(): void {
    // API routes
    this.app.use('/auth', authRouter);
    this.app.use('/api/endpoints', endpointsRouter);
    this.app.use('/api/sessions', sessionsRouter);
    this.app.use('/api/audit', auditRouter);

    // Health check endpoint
    this.app.get('/healthz', async (req, res) => {
      try {
        const healthStatus = await this.getHealthStatus();
        const statusCode = healthStatus.status === 'healthy' ? 200 : 503;
        res.status(statusCode).json(healthStatus);
      } catch (error) {
        logError(this.logger, error as Error, 'Health check failed');
        res.status(503).json({
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          error: 'Health check failed'
        });
      }
    });

    // Metrics endpoint
    this.app.get('/metrics', (req, res) => {
      try {
        const proxy = getWebSocketProxy();
        const sessionManager = getSessionManager();
        const stats = sessionManager.getStatistics();
        
        res.json({
          timestamp: new Date().toISOString(),
          uptime: Date.now() - this.startTime,
          activeConnections: proxy.getActiveConnections(),
          statistics: stats,
          memory: {
            used: process.memoryUsage().heapUsed,
            total: process.memoryUsage().heapTotal,
            usage: process.memoryUsage().heapUsed / process.memoryUsage().heapTotal
          }
        });
      } catch (error) {
        logError(this.logger, error as Error, 'Failed to get metrics');
        res.status(500).json({ error: 'Failed to get metrics' });
      }
    });

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({ 
        error: 'Not Found',
        message: `Route ${req.method} ${req.originalUrl} not found`
      });
    });

    // Error handler
    this.app.use((error: Error, req: express.Request, res: express.Response) => {
      logError(this.logger, error, 'Unhandled request error', {
        requestId: Array.isArray(req.headers['x-request-id']) ? req.headers['x-request-id'][0] : req.headers['x-request-id'],
        method: req.method,
        url: req.url
      });

      res.status(500).json({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred'
      });
    });
  }

  private setupWebSocketServer(): void {
    this.wss.on('connection', async (ws, request) => {
      const url = new URL(request.url!, `http://${request.headers.host}`);
      const pathParts = url.pathname.split('/');
      
      // Handle ops WebSocket connection
      if (url.pathname === '/ops') {
        this.logger.info({
          ip: this.getClientIP(request),
          userAgent: request.headers['user-agent']
        }, 'New ops WebSocket connection');

        const telemetryService = getTelemetryService();
        telemetryService.addClient(ws);
        return;
      }
      
      // Expected path: /ws/:endpointId
      if (pathParts.length < 3 || pathParts[1] !== 'ws') {
        this.logger.warn({ 
          path: url.pathname,
          ip: this.getClientIP(request)
        }, 'Invalid WebSocket path');
        
        ws.close(1002, 'Invalid path. Expected /ws/:endpointId or /ops');
        return;
      }

      const endpointId = pathParts[2];
      
      if (!endpointId) {
        this.logger.warn({ 
          path: url.pathname,
          ip: this.getClientIP(request)
        }, 'Missing endpoint ID');
        
        ws.close(1002, 'Missing endpoint ID');
        return;
      }

      this.logger.info({
        endpointId,
        ip: this.getClientIP(request),
        userAgent: request.headers['user-agent']
      }, 'New WebSocket connection');

      // Handle the connection through the proxy
      const proxy = getWebSocketProxy();
      await proxy.handleConnection(ws, request, endpointId);
    });

    this.wss.on('error', (error) => {
      logError(this.logger, error, 'WebSocket server error');
    });

    // Periodic ping to keep connections alive
    setInterval(() => {
      this.wss.clients.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.ping();
        }
      });
    }, 30000); // Ping every 30 seconds
  }

  private async getHealthStatus(): Promise<HealthStatus> {
    const database = await initializeDatabase();
    const dbHealth = await database.healthCheck();
    const proxy = getWebSocketProxy();
    
    const isHealthy = dbHealth.connected;
    
    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      database: dbHealth,
      activeConnections: proxy.getActiveConnections(),
      memory: {
        used: process.memoryUsage().heapUsed,
        total: process.memoryUsage().heapTotal,
        usage: process.memoryUsage().heapUsed / process.memoryUsage().heapTotal
      }
    };
  }

  private getClientIP(req: express.Request | import('http').IncomingMessage): string {
    const xForwardedFor = req.headers['x-forwarded-for'];
    if (xForwardedFor) {
      return Array.isArray(xForwardedFor) ? xForwardedFor[0] : xForwardedFor.split(',')[0];
    }
    return req.socket?.remoteAddress || (req as any).connection?.remoteAddress || 'unknown';
  }

  private setupGracefulShutdown(): void {
    const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT', 'SIGUSR2'];
    
    signals.forEach((signal) => {
      process.on(signal, async () => {
        logShutdown(signal, 0);
        await this.shutdown();
        process.exit(0);
      });
    });

    process.on('uncaughtException', async (error) => {
      logError(this.logger, error, 'Uncaught exception');
      await this.shutdown();
      process.exit(1);
    });

    process.on('unhandledRejection', async (reason, promise) => {
      logError(this.logger, new Error(String(reason)), 'Unhandled rejection', { promise });
      await this.shutdown();
      process.exit(1);
    });
  }

  async start(): Promise<void> {
    try {
      // Initialize database
      await initializeDatabase();
      this.logger.info('Database initialized');

      // Start HTTP server
      await new Promise<void>((resolve, reject) => {
        this.server.listen(config.port, config.host, (error?: Error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });

      this.logger.info({
        port: config.port,
        host: config.host,
        env: process.env.NODE_ENV || 'development'
      }, 'WebSocket proxy server started');

      // Log configuration (without sensitive data)
      this.logger.info({
        proxy: {
          connectionTimeoutMs: config.proxy.connectionTimeoutMs,
          idleTimeoutMs: config.proxy.idleTimeoutMs,
          maxMessageSize: config.proxy.maxMessageSize,
          backpressureThreshold: config.proxy.backpressureThreshold
        },
        cors: {
          origin: config.cors.origin,
          credentials: config.cors.credentials
        }
      }, 'Server configuration loaded');

    } catch (error) {
      logError(this.logger, error as Error, 'Failed to start server');
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    this.logger.info('Starting graceful shutdown');

    try {
      // Stop accepting new connections
      this.wss.close();
      
      // Shutdown WebSocket proxy
      await shutdownWebSocketProxy();
      
      // Shutdown telemetry service
      await shutdownTelemetryService();
      
      // Shutdown session manager
      await shutdownSessionManager();
      
      // Close HTTP server
      await new Promise<void>((resolve) => {
        this.server.close(() => {
          this.logger.info('HTTP server closed');
          resolve();
        });
      });

      // Shutdown database
      await shutdownDatabase();
      
      this.logger.info('Graceful shutdown complete');
      
    } catch (error) {
      logError(this.logger, error as Error, 'Error during shutdown');
    }
  }
}

// Main execution
async function main(): Promise<void> {
  // Initialize logger
  createLogger({
    level: config.logging.level,
    pretty: config.logging.pretty,
    name: 'ws-proxy'
  });

  const logger = loggers.app();
  
  logger.info({
    version: process.env.npm_package_version || '1.0.0',
    node: process.version,
    platform: process.platform,
    arch: process.arch
  }, 'WebSocket Proxy starting up');

  try {
    const server = new WebSocketProxyServer();
    await server.start();
  } catch (error) {
    logError(logger, error as Error, 'Failed to start WebSocket proxy server');
    process.exit(1);
  }
}

// Start the server if this file is run directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { WebSocketProxyServer, config };
export default main;