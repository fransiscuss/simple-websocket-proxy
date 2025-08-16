import { SessionState, Direction } from '@prisma/client';

// WebSocket message types
export interface WebSocketMessage {
  type: 'text' | 'binary';
  data: Buffer | string;
  size: number;
}

// Endpoint configuration
export interface EndpointLimits {
  maxConnections?: number;
  maxMessageSize?: number;
  connectionTimeoutMs?: number;
  idleTimeoutMs?: number;
  rateLimitRpm?: number;
}

export interface EndpointSampling {
  enabled: boolean;
  sampleRate?: number; // 0.0 to 1.0
  maxSampleSize?: number;
  storeContent?: boolean;
}

export interface EndpointConfig {
  id: string;
  name: string;
  targetUrl: string;
  limits: EndpointLimits;
  sampling: EndpointSampling;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Session tracking
export interface SessionMetrics {
  id: string;
  endpointId: string;
  startedAt: Date;
  lastSeen: Date;
  msgsIn: number;
  msgsOut: number;
  bytesIn: bigint;
  bytesOut: bigint;
  state: SessionState;
}

export interface SessionUpdate {
  lastSeen?: Date;
  msgsIn?: number;
  msgsOut?: number;
  bytesIn?: bigint;
  bytesOut?: bigint;
  state?: SessionState;
}

// Traffic sampling
export interface TrafficSample {
  id: string;
  sessionId: string;
  endpointId: string;
  direction: Direction;
  timestamp: Date;
  sizeBytes: number;
  content?: string;
}

// Proxy connection state
export interface ProxyConnection {
  sessionId: string;
  endpointId: string;
  clientWs: import('ws').WebSocket;
  targetWs: import('ws').WebSocket | null;
  metrics: {
    msgsIn: number;
    msgsOut: number;
    bytesIn: number;
    bytesOut: number;
  };
  lastActivity: Date;
  state: 'connecting' | 'connected' | 'closing' | 'closed';
}

// Error types
export class ProxyError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = 'ProxyError';
  }
}

export class EndpointNotFoundError extends ProxyError {
  constructor(endpointId: string) {
    super(`Endpoint not found: ${endpointId}`, 'ENDPOINT_NOT_FOUND', 404);
  }
}

export class EndpointDisabledError extends ProxyError {
  constructor(endpointId: string) {
    super(`Endpoint is disabled: ${endpointId}`, 'ENDPOINT_DISABLED', 403);
  }
}

export class ConnectionLimitExceededError extends ProxyError {
  constructor(endpointId: string, limit: number) {
    super(
      `Connection limit exceeded for endpoint ${endpointId}: ${limit}`,
      'CONNECTION_LIMIT_EXCEEDED',
      429
    );
  }
}

export class MessageTooLargeError extends ProxyError {
  constructor(size: number, limit: number) {
    super(
      `Message size ${size} exceeds limit ${limit}`,
      'MESSAGE_TOO_LARGE',
      413
    );
  }
}

export class TargetConnectionError extends ProxyError {
  constructor(targetUrl: string, cause?: Error) {
    super(
      `Failed to connect to target: ${targetUrl}`,
      'TARGET_CONNECTION_ERROR',
      502,
      { cause: cause?.message }
    );
  }
}

// Configuration
export interface ServerConfig {
  port: number;
  host: string;
  cors: {
    origin: string[];
    credentials: boolean;
  };
  proxy: {
    connectionTimeoutMs: number;
    idleTimeoutMs: number;
    maxMessageSize: number;
    backpressureThreshold: number;
  };
  database: {
    url: string;
    maxConnections: number;
    connectionTimeoutMs: number;
  };
  logging: {
    level: string;
    pretty: boolean;
  };
}

// Health check
export interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  uptime: number;
  database: {
    connected: boolean;
    responseTimeMs?: number;
  };
  activeConnections: number;
  memory: {
    used: number;
    total: number;
    usage: number;
  };
}

// Logging context
export interface LogContext {
  sessionId?: string;
  endpointId?: string;
  targetUrl?: string;
  requestId?: string;
  userId?: string;
  [key: string]: any;
}

// Rate limiting
export interface RateLimit {
  requests: number;
  windowMs: number;
  lastReset: number;
}

// Backpressure monitoring
export interface BackpressureStatus {
  clientBufferedAmount: number;
  targetBufferedAmount: number;
  isBackpressured: boolean;
  threshold: number;
}