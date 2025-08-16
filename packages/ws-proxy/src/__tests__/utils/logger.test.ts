import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import pino from 'pino';
import {
  createLogger,
  getLogger,
  createContextLogger,
  loggers,
  logPerformance,
  logError,
  logConnectionEvent,
  logMessage,
  logRateLimit,
  logBackpressure,
  logDatabaseOperation,
  logShutdown,
  LOG_LEVELS,
} from '../../utils/logger';

// Mock pino
vi.mock('pino', () => ({
  default: vi.fn(() => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
    child: vi.fn(() => ({
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      fatal: vi.fn(),
      trace: vi.fn(),
    })),
  })),
  stdTimeFunctions: {
    isoTime: vi.fn(),
  },
  stdSerializers: {
    req: vi.fn(),
    res: vi.fn(),
    err: vi.fn(),
  },
  destination: vi.fn(),
  transport: vi.fn(),
}));

describe('Logger Utils', () => {
  let mockLogger: any;
  
  beforeEach(() => {
    vi.clearAllMocks();
    mockLogger = {
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      fatal: vi.fn(),
      trace: vi.fn(),
      child: vi.fn(() => mockLogger),
    };
    vi.mocked(pino).mockReturnValue(mockLogger);
  });

  afterEach(() => {
    // Reset module state
    delete process.env.LOG_LEVEL;
    delete process.env.NODE_ENV;
  });

  describe('LOG_LEVELS', () => {
    it('should define correct log levels', () => {
      expect(LOG_LEVELS).toEqual({
        fatal: 60,
        error: 50,
        warn: 40,
        info: 30,
        debug: 20,
        trace: 10,
      });
    });
  });

  describe('createLogger', () => {
    it('should create logger with default options', () => {
      const logger = createLogger({});
      
      expect(pino).toHaveBeenCalledWith({
        name: 'ws-proxy',
        level: 'info',
        timestamp: expect.any(Function),
        formatters: {
          level: expect.any(Function),
        },
        serializers: {
          req: expect.any(Function),
          res: expect.any(Function),
          error: expect.any(Function),
        },
      });
    });

    it('should create logger with custom options', () => {
      const logger = createLogger({
        level: 'debug',
        name: 'test-logger',
      });
      
      expect(pino).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'test-logger',
          level: 'debug',
        })
      );
    });

    it('should enable pretty printing in development', () => {
      process.env.NODE_ENV = 'development';
      
      const logger = createLogger({ pretty: true });
      
      expect(pino.destination).toHaveBeenCalled();
      expect(pino.transport).toHaveBeenCalledWith({
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      });
    });

    it('should not enable pretty printing in production', () => {
      process.env.NODE_ENV = 'production';
      
      const logger = createLogger({ pretty: true });
      
      expect(pino.destination).not.toHaveBeenCalled();
      expect(pino.transport).not.toHaveBeenCalled();
    });
  });

  describe('getLogger', () => {
    it('should return singleton logger instance', () => {
      const logger1 = getLogger();
      const logger2 = getLogger();
      
      expect(logger1).toBe(logger2);
    });

    it('should use environment variables for configuration', () => {
      process.env.LOG_LEVEL = 'debug';
      process.env.NODE_ENV = 'development';
      
      // Clear module cache to force re-initialization
      vi.resetModules();
      
      const logger = getLogger();
      
      expect(pino).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'debug',
        })
      );
    });
  });

  describe('createContextLogger', () => {
    it('should create child logger with context', () => {
      const context = { sessionId: 'test-session', endpointId: 'test-endpoint' };
      
      const contextLogger = createContextLogger(context);
      
      expect(mockLogger.child).toHaveBeenCalledWith(context);
    });
  });

  describe('loggers', () => {
    it('should create app logger', () => {
      const logger = loggers.app({ userId: 'test-user' });
      
      expect(mockLogger.child).toHaveBeenCalledWith({
        component: 'app',
        userId: 'test-user',
      });
    });

    it('should create server logger', () => {
      const logger = loggers.server();
      
      expect(mockLogger.child).toHaveBeenCalledWith({
        component: 'server',
      });
    });

    it('should create proxy logger', () => {
      const logger = loggers.proxy({ sessionId: 'test-session' });
      
      expect(mockLogger.child).toHaveBeenCalledWith({
        component: 'proxy',
        sessionId: 'test-session',
      });
    });

    it('should create database logger', () => {
      const logger = loggers.database();
      
      expect(mockLogger.child).toHaveBeenCalledWith({
        component: 'database',
      });
    });

    it('should create session logger', () => {
      const logger = loggers.session();
      
      expect(mockLogger.child).toHaveBeenCalledWith({
        component: 'session',
      });
    });

    it('should create health logger', () => {
      const logger = loggers.health();
      
      expect(mockLogger.child).toHaveBeenCalledWith({
        component: 'health',
      });
    });
  });

  describe('logPerformance', () => {
    it('should log performance metrics', () => {
      const startTime = process.hrtime();
      const operation = 'test-operation';
      const context = { requestId: 'test-request' };
      
      // Wait a bit for time to pass
      setTimeout(() => {
        logPerformance(mockLogger, operation, startTime, context);
        
        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.objectContaining({
            operation,
            durationMs: expect.any(Number),
            requestId: 'test-request',
          }),
          `Operation completed: ${operation}`
        );
      }, 1);
    });

    it('should round duration to 2 decimal places', () => {
      const startTime: [number, number] = [0, 0]; // Mock start time
      vi.spyOn(process, 'hrtime').mockReturnValue([0, 1500000]); // 1.5ms
      
      logPerformance(mockLogger, 'test-op', startTime);
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          durationMs: 1.5,
        }),
        expect.any(String)
      );
    });
  });

  describe('logError', () => {
    it('should log error with context', () => {
      const error = new Error('Test error');
      const message = 'Test error occurred';
      const context = { sessionId: 'test-session' };
      
      logError(mockLogger, error, message, context);
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        {
          error,
          sessionId: 'test-session',
        },
        message
      );
    });

    it('should log error without context', () => {
      const error = new Error('Test error');
      const message = 'Test error occurred';
      
      logError(mockLogger, error, message);
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        { error },
        message
      );
    });
  });

  describe('logConnectionEvent', () => {
    const sessionId = 'test-session';
    const endpointId = 'test-endpoint';
    
    beforeEach(() => {
      // Mock the proxy logger
      vi.spyOn(loggers, 'proxy').mockReturnValue(mockLogger);
    });

    it('should log connect event', () => {
      const details = { clientIP: '192.168.1.1' };
      
      logConnectionEvent(sessionId, endpointId, 'connect', details);
      
      expect(loggers.proxy).toHaveBeenCalledWith({ sessionId, endpointId });
      expect(mockLogger.info).toHaveBeenCalledWith(details, 'Client connected');
    });

    it('should log disconnect event', () => {
      const details = { code: 1000, reason: 'Normal closure' };
      
      logConnectionEvent(sessionId, endpointId, 'disconnect', details);
      
      expect(mockLogger.info).toHaveBeenCalledWith(details, 'Client disconnected');
    });

    it('should log target-connect event', () => {
      logConnectionEvent(sessionId, endpointId, 'target-connect');
      
      expect(mockLogger.info).toHaveBeenCalledWith(undefined, 'Target connected');
    });

    it('should log target-disconnect event', () => {
      logConnectionEvent(sessionId, endpointId, 'target-disconnect');
      
      expect(mockLogger.info).toHaveBeenCalledWith(undefined, 'Target disconnected');
    });

    it('should log error event', () => {
      const details = { error: 'Connection failed' };
      
      logConnectionEvent(sessionId, endpointId, 'error', details);
      
      expect(mockLogger.error).toHaveBeenCalledWith(details, 'Connection error');
    });
  });

  describe('logMessage', () => {
    beforeEach(() => {
      vi.spyOn(loggers, 'proxy').mockReturnValue(mockLogger);
    });

    it('should log inbound message', () => {
      logMessage('session-123', 'endpoint-123', 'inbound', 1024, 'text');
      
      expect(mockLogger.debug).toHaveBeenCalledWith(
        {
          direction: 'inbound',
          size: 1024,
          type: 'text',
          sample: undefined,
        },
        'Message inbound: text (1024 bytes)'
      );
    });

    it('should log outbound binary message with sample flag', () => {
      logMessage('session-123', 'endpoint-123', 'outbound', 2048, 'binary', true);
      
      expect(mockLogger.debug).toHaveBeenCalledWith(
        {
          direction: 'outbound',
          size: 2048,
          type: 'binary',
          sample: true,
        },
        'Message outbound: binary (2048 bytes) [sampled]'
      );
    });
  });

  describe('logRateLimit', () => {
    beforeEach(() => {
      vi.spyOn(loggers, 'proxy').mockReturnValue(mockLogger);
    });

    it('should log rate limit warning', () => {
      logRateLimit('session-123', 'endpoint-123', 45, 50);
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        {
          current: 45,
          limit: 50,
          usage: 90,
        },
        'Rate limit warning: 45/50 requests'
      );
    });

    it('should calculate usage percentage correctly', () => {
      logRateLimit('session-123', 'endpoint-123', 33, 100);
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          usage: 33,
        }),
        expect.any(String)
      );
    });
  });

  describe('logBackpressure', () => {
    beforeEach(() => {
      vi.spyOn(loggers, 'proxy').mockReturnValue(mockLogger);
    });

    it('should log backpressure warning', () => {
      logBackpressure('session-123', 'endpoint-123', 8192, 16384, 10000);
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        {
          clientBuffer: 8192,
          targetBuffer: 16384,
          threshold: 10000,
        },
        'Backpressure detected'
      );
    });
  });

  describe('logDatabaseOperation', () => {
    beforeEach(() => {
      vi.spyOn(loggers, 'database').mockReturnValue(mockLogger);
    });

    it('should log operation start', () => {
      logDatabaseOperation('select', 'endpoints', 'endpoint-123');
      
      expect(loggers.database).toHaveBeenCalledWith({
        operation: 'select',
        table: 'endpoints',
        recordId: 'endpoint-123',
      });
      expect(mockLogger.debug).toHaveBeenCalledWith('Database select started');
    });

    it('should log operation completion with duration', () => {
      logDatabaseOperation('insert', 'sessions', 'session-123', 45.67);
      
      expect(mockLogger.debug).toHaveBeenCalledWith(
        { durationMs: 45.67 },
        'Database insert completed'
      );
    });

    it('should log operation without recordId', () => {
      logDatabaseOperation('count', 'endpoints');
      
      expect(loggers.database).toHaveBeenCalledWith({
        operation: 'count',
        table: 'endpoints',
        recordId: undefined,
      });
    });
  });

  describe('logShutdown', () => {
    beforeEach(() => {
      vi.spyOn(loggers, 'app').mockReturnValue(mockLogger);
      vi.spyOn(process, 'uptime').mockReturnValue(123.45);
    });

    it('should log shutdown information', () => {
      logShutdown('SIGTERM', 0);
      
      expect(loggers.app).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        {
          signal: 'SIGTERM',
          exitCode: 0,
          uptime: 123.45,
        },
        'Application shutting down'
      );
    });
  });
});