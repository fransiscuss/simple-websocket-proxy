import { vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';

// Mock Prisma client
export const createMockPrismaClient = (): any => {
  const mockPrisma = {
    $connect: vi.fn(),
    $disconnect: vi.fn(),
    $queryRaw: vi.fn(),
    
    appUser: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    
    endpoint: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    
    liveSession: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    
    trafficSample: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    
    auditLog: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
  } as any;

  return mockPrisma;
};

// Helper to setup common Prisma mock behaviors
export const setupPrismaMocks = (mockPrisma: any) => {
  // Setup default successful responses
  mockPrisma.$connect.mockResolvedValue(undefined);
  mockPrisma.$disconnect.mockResolvedValue(undefined);
  mockPrisma.$queryRaw.mockResolvedValue([{ result: 1 }]);
  
  // Setup default return values for CRUD operations
  const defaultUser = {
    id: 'user-123',
    email: 'test@example.com',
    passwordHash: '$2a$10$hashedpassword',
    role: 'ADMIN',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const defaultEndpoint = {
    id: 'endpoint-123',
    name: 'Test Endpoint',
    targetUrl: 'wss://example.com/ws',
    limits: { maxConnections: 100, maxMessageSize: 1048576, timeoutMs: 30000 },
    sampling: { enabled: false, percentage: 10 },
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const defaultSession = {
    id: 'session-123',
    endpointId: 'endpoint-123',
    state: 'ACTIVE',
    startedAt: new Date(),
    lastSeen: new Date(),
    msgsIn: 0,
    msgsOut: 0,
    bytesIn: BigInt(0),
    bytesOut: BigInt(0),
  };

  // AppUser mocks
  mockPrisma.appUser.findUnique.mockResolvedValue(defaultUser);
  mockPrisma.appUser.findMany.mockResolvedValue([defaultUser]);
  mockPrisma.appUser.create.mockResolvedValue(defaultUser);
  mockPrisma.appUser.update.mockResolvedValue(defaultUser);
  mockPrisma.appUser.delete.mockResolvedValue(defaultUser);
  mockPrisma.appUser.count.mockResolvedValue(1);

  // Endpoint mocks
  mockPrisma.endpoint.findUnique.mockResolvedValue(defaultEndpoint);
  mockPrisma.endpoint.findMany.mockResolvedValue([defaultEndpoint]);
  mockPrisma.endpoint.create.mockResolvedValue(defaultEndpoint);
  mockPrisma.endpoint.update.mockResolvedValue(defaultEndpoint);
  mockPrisma.endpoint.delete.mockResolvedValue(defaultEndpoint);
  mockPrisma.endpoint.count.mockResolvedValue(1);

  // LiveSession mocks
  mockPrisma.liveSession.findUnique.mockResolvedValue(defaultSession);
  mockPrisma.liveSession.findMany.mockResolvedValue([defaultSession]);
  mockPrisma.liveSession.create.mockResolvedValue(defaultSession);
  mockPrisma.liveSession.update.mockResolvedValue(defaultSession);
  mockPrisma.liveSession.delete.mockResolvedValue(defaultSession);
  mockPrisma.liveSession.deleteMany.mockResolvedValue({ count: 1 });
  mockPrisma.liveSession.count.mockResolvedValue(1);

  // TrafficSample mocks
  const defaultTrafficSample = {
    id: 'sample-123',
    sessionId: 'session-123',
    endpointId: 'endpoint-123',
    direction: 'INBOUND',
    timestamp: new Date(),
    sizeBytes: 1024,
    content: 'test message content',
  };
  mockPrisma.trafficSample.findUnique.mockResolvedValue(defaultTrafficSample);
  mockPrisma.trafficSample.findMany.mockResolvedValue([defaultTrafficSample]);
  mockPrisma.trafficSample.create.mockResolvedValue(defaultTrafficSample);
  mockPrisma.trafficSample.update.mockResolvedValue(defaultTrafficSample);
  mockPrisma.trafficSample.delete.mockResolvedValue(defaultTrafficSample);
  mockPrisma.trafficSample.deleteMany.mockResolvedValue({ count: 1 });
  mockPrisma.trafficSample.count.mockResolvedValue(1);

  // AuditLog mocks
  const defaultAuditLog = {
    id: 'audit-123',
    action: 'CREATE_ENDPOINT',
    entityType: 'ENDPOINT',
    entityId: 'endpoint-123',
    timestamp: new Date(),
    details: { userId: 'user-123' },
  };
  mockPrisma.auditLog.findUnique.mockResolvedValue(defaultAuditLog);
  mockPrisma.auditLog.findMany.mockResolvedValue([defaultAuditLog]);
  mockPrisma.auditLog.create.mockResolvedValue(defaultAuditLog);
  mockPrisma.auditLog.update.mockResolvedValue(defaultAuditLog);
  mockPrisma.auditLog.delete.mockResolvedValue(defaultAuditLog);
  mockPrisma.auditLog.count.mockResolvedValue(1);
  
  return mockPrisma;
};

// Mock the entire database service module
export const mockDatabaseService = {
  connect: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn().mockResolvedValue(undefined),
  healthCheck: vi.fn().mockResolvedValue({ connected: true, responseTimeMs: 5 }),
  getEndpoint: vi.fn().mockResolvedValue({
    id: 'endpoint-123',
    name: 'Test Endpoint',
    targetUrl: 'wss://example.com/ws',
    limits: { maxConnections: 100, maxMessageSize: 1048576, timeoutMs: 30000 },
    sampling: { enabled: false, percentage: 10 },
    enabled: true,
  }),
  getAllEndpoints: vi.fn().mockResolvedValue([{
    id: 'endpoint-123',
    name: 'Test Endpoint',
    targetUrl: 'wss://example.com/ws',
    limits: { maxConnections: 100, maxMessageSize: 1048576, timeoutMs: 30000 },
    sampling: { enabled: false, percentage: 10 },
    enabled: true,
  }]),
  getActiveConnectionCount: vi.fn().mockResolvedValue(1),
  createSession: vi.fn().mockResolvedValue('session-123'),
  updateSession: vi.fn().mockResolvedValue(undefined),
  getSession: vi.fn().mockResolvedValue({
    id: 'session-123',
    endpointId: 'endpoint-123',
    state: 'ACTIVE',
    startedAt: new Date(),
    lastSeen: new Date(),
    msgsIn: 0,
    msgsOut: 0,
    bytesIn: BigInt(0),
    bytesOut: BigInt(0),
  }),
  closeSession: vi.fn().mockResolvedValue(undefined),
  getActiveSessions: vi.fn().mockResolvedValue([{
    id: 'session-123',
    endpointId: 'endpoint-123',
    state: 'ACTIVE',
    startedAt: new Date(),
    lastSeen: new Date(),
    msgsIn: 0,
    msgsOut: 0,
    bytesIn: BigInt(0),
    bytesOut: BigInt(0),
  }]),
  createTrafficSample: vi.fn().mockResolvedValue('sample-123'),
  getTrafficSamples: vi.fn().mockResolvedValue([{
    id: 'sample-123',
    sessionId: 'session-123',
    endpointId: 'endpoint-123',
    direction: 'INBOUND',
    timestamp: new Date(),
    sizeBytes: 1024,
    content: 'test message content',
  }]),
  cleanupOldSessions: vi.fn().mockResolvedValue(1),
  cleanupOldTrafficSamples: vi.fn().mockResolvedValue(1),
  client: createMockPrismaClient(),
};