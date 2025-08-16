import { vi } from 'vitest';
import { setupPrismaMocks, createMockPrismaClient } from '../mocks/prisma';

// Global test setup
export const setupTestEnvironment = () => {
  // Mock environment variables
  process.env.JWT_SECRET = 'test-jwt-secret';
  process.env.JWT_EXPIRES_IN = '1h';
  process.env.LOG_LEVEL = 'silent';
  process.env.NODE_ENV = 'test';
  
  // Clear all mocks before each test
  vi.clearAllMocks();
  
  // Setup Prisma mocks with default return values
  const mockPrisma = createMockPrismaClient();
  setupPrismaMocks(mockPrisma);
};

// Helper to create mock logger
export const createMockLogger = () => ({
  info: vi.fn(),
  debug: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  fatal: vi.fn(),
  trace: vi.fn(),
  child: vi.fn(() => createMockLogger()),
});

// Helper to generate test data
export const generateTestData = {
  user: (overrides: any = {}) => ({
    id: 'user-123',
    email: 'test@example.com',
    passwordHash: '$2a$10$hashedpassword',
    role: 'ADMIN',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  endpoint: (overrides: any = {}) => ({
    id: 'endpoint-123',
    name: 'Test Endpoint',
    targetUrl: 'wss://example.com/ws',
    limits: {
      maxConnections: 100,
      maxMessageSize: 1048576,
      timeoutMs: 30000,
    },
    sampling: {
      enabled: false,
      percentage: 10,
    },
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  session: (overrides: any = {}) => ({
    id: 'session-123',
    endpointId: 'endpoint-123',
    state: 'ACTIVE',
    startedAt: new Date(),
    lastSeen: new Date(),
    msgsIn: 0,
    msgsOut: 0,
    bytesIn: BigInt(0),
    bytesOut: BigInt(0),
    ...overrides,
  }),

  trafficSample: (overrides: any = {}) => ({
    id: 'sample-123',
    sessionId: 'session-123',
    endpointId: 'endpoint-123',
    direction: 'INBOUND',
    timestamp: new Date(),
    sizeBytes: 1024,
    content: 'test message content',
    ...overrides,
  }),

  auditLog: (overrides: any = {}) => ({
    id: 'audit-123',
    action: 'CREATE_ENDPOINT',
    entityType: 'ENDPOINT',
    entityId: 'endpoint-123',
    timestamp: new Date(),
    details: { userId: 'user-123' },
    ...overrides,
  }),
};

// Helper to generate JWT tokens for testing
export const generateTestJWT = (payload: any = {}) => {
  const jwt = require('jsonwebtoken');
  return jwt.sign(
    {
      userId: 'user-123',
      email: 'test@example.com',
      role: 'ADMIN',
      ...payload,
    },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
};

// Helper to wait for async operations
export const waitFor = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to create test request objects
export const createTestRequest = (overrides: any = {}) => ({
  body: {},
  params: {},
  query: {},
  headers: {},
  user: undefined,
  ...overrides,
});

// Helper to create test response objects
export const createTestResponse = () => {
  const res: any = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  };
  return res;
};

// Helper to create mock next function
export const createMockNext = () => vi.fn();