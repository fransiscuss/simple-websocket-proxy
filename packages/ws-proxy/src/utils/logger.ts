import pino, { Logger, LoggerOptions } from 'pino';
import { LogContext } from '../types';

// Define log levels
export const LOG_LEVELS = {
  fatal: 60,
  error: 50,
  warn: 40,
  info: 30,
  debug: 20,
  trace: 10
} as const;

// Create logger instance
let logger: Logger;

export function createLogger(options: {
  level?: string;
  pretty?: boolean;
  name?: string;
}): Logger {
  const loggerOptions: LoggerOptions = {
    name: options.name || 'ws-proxy',
    level: options.level || 'info',
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => ({ level: label })
    },
    serializers: {
      req: pino.stdSerializers.req,
      res: pino.stdSerializers.res,
      error: pino.stdSerializers.err
    }
  };

  // Add pretty printing for development
  if (options.pretty && process.env.NODE_ENV !== 'production') {
    logger = pino(loggerOptions, pino.destination({
      sync: false,
      dest: pino.transport({
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname'
        }
      })
    }));
  } else {
    logger = pino(loggerOptions);
  }

  return logger;
}

// Get the singleton logger instance
export function getLogger(): Logger {
  if (!logger) {
    logger = createLogger({
      level: process.env.LOG_LEVEL || 'info',
      pretty: process.env.NODE_ENV === 'development'
    });
  }
  return logger;
}

// Create child logger with context
export function createContextLogger(context: LogContext): Logger {
  return getLogger().child(context);
}

// Logging utilities for common scenarios
export const loggers = {
  // Application startup/shutdown
  app: (context?: LogContext) => createContextLogger({ component: 'app', ...context }),
  
  // HTTP server
  server: (context?: LogContext) => createContextLogger({ component: 'server', ...context }),
  
  // WebSocket proxy
  proxy: (context?: LogContext) => createContextLogger({ component: 'proxy', ...context }),
  
  // Database operations
  database: (context?: LogContext) => createContextLogger({ component: 'database', ...context }),
  
  // Session management
  session: (context?: LogContext) => createContextLogger({ component: 'session', ...context }),
  
  // Health checks
  health: (context?: LogContext) => createContextLogger({ component: 'health', ...context })
};

// Performance logging helper
export function logPerformance(
  logger: Logger,
  operation: string,
  startTime: [number, number],
  context?: LogContext
): void {
  const [seconds, nanoseconds] = process.hrtime(startTime);
  const durationMs = seconds * 1000 + nanoseconds / 1000000;
  
  logger.info({
    operation,
    durationMs: Math.round(durationMs * 100) / 100,
    ...context
  }, `Operation completed: ${operation}`);
}

// Error logging with context
export function logError(
  logger: Logger,
  error: Error,
  message: string,
  context?: LogContext
): void {
  logger.error({
    error,
    ...context
  }, message);
}

// WebSocket connection lifecycle logging
export function logConnectionEvent(
  sessionId: string,
  endpointId: string,
  event: 'connect' | 'disconnect' | 'error' | 'target-connect' | 'target-disconnect',
  details?: any
): void {
  const logger = loggers.proxy({ sessionId, endpointId });
  
  switch (event) {
    case 'connect':
      logger.info({ ...details }, 'Client connected');
      break;
    case 'disconnect':
      logger.info({ ...details }, 'Client disconnected');
      break;
    case 'target-connect':
      logger.info({ ...details }, 'Target connected');
      break;
    case 'target-disconnect':
      logger.info({ ...details }, 'Target disconnected');
      break;
    case 'error':
      logger.error({ ...details }, 'Connection error');
      break;
  }
}

// Message flow logging
export function logMessage(
  sessionId: string,
  endpointId: string,
  direction: 'inbound' | 'outbound',
  size: number,
  type: 'text' | 'binary',
  sample?: boolean
): void {
  const logger = loggers.proxy({ sessionId, endpointId });
  
  logger.debug({
    direction,
    size,
    type,
    sample
  }, `Message ${direction}: ${type} (${size} bytes)${sample ? ' [sampled]' : ''}`);
}

// Rate limit logging
export function logRateLimit(
  sessionId: string,
  endpointId: string,
  current: number,
  limit: number
): void {
  const logger = loggers.proxy({ sessionId, endpointId });
  
  logger.warn({
    current,
    limit,
    usage: Math.round((current / limit) * 100)
  }, `Rate limit warning: ${current}/${limit} requests`);
}

// Backpressure logging
export function logBackpressure(
  sessionId: string,
  endpointId: string,
  clientBuffer: number,
  targetBuffer: number,
  threshold: number
): void {
  const logger = loggers.proxy({ sessionId, endpointId });
  
  logger.warn({
    clientBuffer,
    targetBuffer,
    threshold
  }, 'Backpressure detected');
}

// Database operation logging
export function logDatabaseOperation(
  operation: string,
  table: string,
  recordId?: string,
  durationMs?: number
): void {
  const logger = loggers.database({ operation, table, recordId });
  
  if (durationMs !== undefined) {
    logger.debug({ durationMs }, `Database ${operation} completed`);
  } else {
    logger.debug(`Database ${operation} started`);
  }
}

// Graceful shutdown logging
export function logShutdown(signal: string, exitCode: number): void {
  const logger = loggers.app();
  
  logger.info({
    signal,
    exitCode,
    uptime: process.uptime()
  }, 'Application shutting down');
}

// Export the main logger instance
export { logger };
export default getLogger;