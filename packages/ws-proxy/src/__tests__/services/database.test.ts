import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SessionState } from '@prisma/client';
import { DatabaseService, getDatabaseService, initializeDatabase, shutdownDatabase } from '../../services/database';
import { createMockPrismaClient, setupPrismaMocks } from '../mocks/prisma';
import { generateTestData } from '../helpers/test-setup';

// Mock the logger
vi.mock('../../utils/logger', () => ({
  loggers: {
    database: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }),
  },
  logDatabaseOperation: vi.fn(),
  logError: vi.fn(),
}));

// Mock PrismaClient
vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(),
  SessionState: {
    ACTIVE: 'ACTIVE',
    CLOSED: 'CLOSED',
    FAILED: 'FAILED',
  },
  Direction: {
    INBOUND: 'INBOUND',
    OUTBOUND: 'OUTBOUND',
  },
}));

describe('DatabaseService', () => {
  let databaseService: DatabaseService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = createMockPrismaClient();
    setupPrismaMocks(mockPrisma);
    
    databaseService = new DatabaseService();
    // Manually inject the mock prisma client
    (databaseService as any).prisma = mockPrisma;
    
    // Setup default session creation mock
    const testSession = generateTestData.session();
    mockPrisma.liveSession.create.mockResolvedValue(testSession);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Connection Management', () => {
    it('should connect to database successfully', async () => {
      mockPrisma.$connect.mockResolvedValue(undefined);
      
      await databaseService.connect();
      
      expect(mockPrisma.$connect).toHaveBeenCalled();
    });

    it('should handle connection errors', async () => {
      const error = new Error('Connection failed');
      mockPrisma.$connect.mockRejectedValue(error);
      
      await expect(databaseService.connect()).rejects.toThrow('Connection failed');
      expect(mockPrisma.$connect).toHaveBeenCalled();
    });

    it('should disconnect from database successfully', async () => {
      mockPrisma.$disconnect.mockResolvedValue(undefined);
      
      await databaseService.disconnect();
      
      expect(mockPrisma.$disconnect).toHaveBeenCalled();
    });

    it('should handle disconnect errors', async () => {
      const error = new Error('Disconnect failed');
      mockPrisma.$disconnect.mockRejectedValue(error);
      
      await expect(databaseService.disconnect()).rejects.toThrow('Disconnect failed');
    });
  });

  describe('Health Check', () => {
    it('should return healthy status with response time', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ result: 1 }]);
      
      const health = await databaseService.healthCheck();
      
      expect(health.connected).toBe(true);
      expect(health.responseTimeMs).toBeGreaterThan(0);
      expect(mockPrisma.$queryRaw).toHaveBeenCalledWith(expect.anything());
    });

    it('should return unhealthy status on error', async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('Database error'));
      
      const health = await databaseService.healthCheck();
      
      expect(health.connected).toBe(false);
      expect(health.responseTimeMs).toBeUndefined();
    });
  });

  describe('Endpoint Operations', () => {
    const testEndpoint = generateTestData.endpoint();

    it('should get endpoint by id successfully', async () => {
      mockPrisma.endpoint.findUnique.mockResolvedValue(testEndpoint);
      
      const result = await databaseService.getEndpoint(testEndpoint.id);
      
      expect(mockPrisma.endpoint.findUnique).toHaveBeenCalledWith({
        where: { id: testEndpoint.id },
      });
      expect(result).toEqual(expect.objectContaining({
        id: testEndpoint.id,
        name: testEndpoint.name,
        targetUrl: testEndpoint.targetUrl,
      }));
    });

    it('should return null for non-existent endpoint', async () => {
      mockPrisma.endpoint.findUnique.mockResolvedValue(null);
      
      const result = await databaseService.getEndpoint('non-existent');
      
      expect(result).toBeNull();
    });

    it('should handle endpoint query errors', async () => {
      const error = new Error('Query failed');
      mockPrisma.endpoint.findUnique.mockRejectedValue(error);
      
      await expect(databaseService.getEndpoint('test-id')).rejects.toThrow('Query failed');
    });

    it('should get all endpoints successfully', async () => {
      const endpoints = [testEndpoint, generateTestData.endpoint({ id: 'endpoint-2' })];
      mockPrisma.endpoint.findMany.mockResolvedValue(endpoints);
      
      const result = await databaseService.getAllEndpoints();
      
      expect(mockPrisma.endpoint.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toHaveLength(2);
    });

    it('should get active connection count', async () => {
      mockPrisma.liveSession.count.mockResolvedValue(5);
      
      const count = await databaseService.getActiveConnectionCount('endpoint-123');
      
      expect(mockPrisma.liveSession.count).toHaveBeenCalledWith({
        where: {
          endpointId: 'endpoint-123',
          state: SessionState.ACTIVE,
        },
      });
      expect(count).toBe(5);
    });
  });

  describe('Session Operations', () => {
    const testSession = generateTestData.session();

    it('should create session successfully', async () => {
      mockPrisma.liveSession.create.mockResolvedValue(testSession);
      
      const sessionId = await databaseService.createSession('endpoint-123');
      
      expect(mockPrisma.liveSession.create).toHaveBeenCalledWith({
        data: {
          endpointId: 'endpoint-123',
          state: SessionState.ACTIVE,
        },
      });
      expect(sessionId).toBe(testSession.id);
    });

    it('should update session successfully', async () => {
      const updates = {
        lastSeen: new Date(),
        msgsIn: 10,
        msgsOut: 5,
        bytesIn: BigInt(1024),
        bytesOut: BigInt(512),
        state: SessionState.ACTIVE,
      };
      
      mockPrisma.liveSession.update.mockResolvedValue({ ...testSession, ...updates });
      
      await databaseService.updateSession(testSession.id, updates);
      
      expect(mockPrisma.liveSession.update).toHaveBeenCalledWith({
        where: { id: testSession.id },
        data: updates,
      });
    });

    it('should get session by id', async () => {
      mockPrisma.liveSession.findUnique.mockResolvedValue(testSession);
      
      const result = await databaseService.getSession(testSession.id);
      
      expect(mockPrisma.liveSession.findUnique).toHaveBeenCalledWith({
        where: { id: testSession.id },
      });
      expect(result).toEqual(expect.objectContaining({
        id: testSession.id,
        endpointId: testSession.endpointId,
      }));
    });

    it('should return null for non-existent session', async () => {
      mockPrisma.liveSession.findUnique.mockResolvedValue(null);
      
      const result = await databaseService.getSession('non-existent');
      
      expect(result).toBeNull();
    });

    it('should close session with default state', async () => {
      const updateSessionSpy = vi.spyOn(databaseService, 'updateSession').mockResolvedValue();
      
      await databaseService.closeSession('session-123');
      
      expect(updateSessionSpy).toHaveBeenCalledWith('session-123', {
        state: SessionState.CLOSED,
        lastSeen: expect.any(Date),
      });
    });

    it('should close session with custom state', async () => {
      const updateSessionSpy = vi.spyOn(databaseService, 'updateSession').mockResolvedValue();
      
      await databaseService.closeSession('session-123', SessionState.FAILED);
      
      expect(updateSessionSpy).toHaveBeenCalledWith('session-123', {
        state: SessionState.FAILED,
        lastSeen: expect.any(Date),
      });
    });

    it('should get active sessions', async () => {
      const sessions = [testSession, generateTestData.session({ id: 'session-2' })];
      mockPrisma.liveSession.findMany.mockResolvedValue(sessions);
      
      const result = await databaseService.getActiveSessions();
      
      expect(mockPrisma.liveSession.findMany).toHaveBeenCalledWith({
        where: {
          state: SessionState.ACTIVE,
        },
        orderBy: { startedAt: 'desc' },
      });
      expect(result).toHaveLength(2);
    });

    it('should get active sessions for specific endpoint', async () => {
      const sessions = [testSession];
      mockPrisma.liveSession.findMany.mockResolvedValue(sessions);
      
      const result = await databaseService.getActiveSessions('endpoint-123');
      
      expect(mockPrisma.liveSession.findMany).toHaveBeenCalledWith({
        where: {
          endpointId: 'endpoint-123',
          state: SessionState.ACTIVE,
        },
        orderBy: { startedAt: 'desc' },
      });
    });
  });

  describe('Traffic Sampling Operations', () => {
    const testSample = generateTestData.trafficSample();

    it('should create traffic sample successfully', async () => {
      mockPrisma.trafficSample.create.mockResolvedValue(testSample);
      
      const sampleData = {
        sessionId: testSample.sessionId,
        endpointId: testSample.endpointId,
        direction: testSample.direction,
        timestamp: testSample.timestamp,
        sizeBytes: testSample.sizeBytes,
        content: testSample.content,
      };
      
      await databaseService.createTrafficSample(sampleData);
      
      expect(mockPrisma.trafficSample.create).toHaveBeenCalledWith({
        data: {
          ...sampleData,
          content: testSample.content,
        },
      });
    });

    it('should create traffic sample without content', async () => {
      const sampleData = {
        sessionId: 'session-123',
        endpointId: 'endpoint-123',
        direction: 'INBOUND' as any,
        timestamp: new Date(),
        sizeBytes: 1024,
      };
      
      await databaseService.createTrafficSample(sampleData);
      
      expect(mockPrisma.trafficSample.create).toHaveBeenCalledWith({
        data: {
          ...sampleData,
          content: null,
        },
      });
    });

    it('should get traffic samples with defaults', async () => {
      const samples = [testSample];
      mockPrisma.trafficSample.findMany.mockResolvedValue(samples);
      
      const result = await databaseService.getTrafficSamples();
      
      expect(mockPrisma.trafficSample.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { timestamp: 'desc' },
        take: 100,
      });
      expect(result).toHaveLength(1);
    });

    it('should get traffic samples with filters', async () => {
      const samples = [testSample];
      mockPrisma.trafficSample.findMany.mockResolvedValue(samples);
      
      const result = await databaseService.getTrafficSamples('session-123', 'endpoint-123', 50);
      
      expect(mockPrisma.trafficSample.findMany).toHaveBeenCalledWith({
        where: {
          sessionId: 'session-123',
          endpointId: 'endpoint-123',
        },
        orderBy: { timestamp: 'desc' },
        take: 50,
      });
    });
  });

  describe('Cleanup Operations', () => {
    it('should cleanup old sessions', async () => {
      mockPrisma.liveSession.deleteMany.mockResolvedValue({ count: 10 });
      
      const deletedCount = await databaseService.cleanupOldSessions(48);
      
      expect(mockPrisma.liveSession.deleteMany).toHaveBeenCalledWith({
        where: {
          state: { in: [SessionState.CLOSED, SessionState.FAILED] },
          lastSeen: { lt: expect.any(Date) },
        },
      });
      expect(deletedCount).toBe(10);
    });

    it('should cleanup old traffic samples', async () => {
      mockPrisma.trafficSample.deleteMany.mockResolvedValue({ count: 25 });
      
      const deletedCount = await databaseService.cleanupOldTrafficSamples(14);
      
      expect(mockPrisma.trafficSample.deleteMany).toHaveBeenCalledWith({
        where: {
          timestamp: { lt: expect.any(Date) },
        },
      });
      expect(deletedCount).toBe(25);
    });

    it('should use default cleanup periods', async () => {
      mockPrisma.liveSession.deleteMany.mockResolvedValue({ count: 5 });
      
      await databaseService.cleanupOldSessions();
      
      // Should use 24 hours as default
      const call = mockPrisma.liveSession.deleteMany.mock.calls[0][0];
      const cutoffDate = call.where.lastSeen.lt;
      const hoursAgo = (Date.now() - cutoffDate.getTime()) / (1000 * 60 * 60);
      expect(hoursAgo).toBeCloseTo(24, 1);
    });
  });

  describe('Helper Methods', () => {
    it('should map endpoint to config correctly', async () => {
      const testEndpoint = generateTestData.endpoint({
        limits: { maxConnections: 50 },
        sampling: { enabled: true, percentage: 20 },
      });
      mockPrisma.endpoint.findUnique.mockResolvedValue(testEndpoint);
      
      const result = await databaseService.getEndpoint(testEndpoint.id);
      
      expect(result).toEqual(expect.objectContaining({
        id: testEndpoint.id,
        name: testEndpoint.name,
        targetUrl: testEndpoint.targetUrl,
        limits: testEndpoint.limits,
        sampling: testEndpoint.sampling,
        enabled: testEndpoint.enabled,
      }));
    });

    it('should map session to metrics correctly', async () => {
      const testSession = generateTestData.session({
        msgsIn: 100,
        msgsOut: 50,
        bytesIn: BigInt(10240),
        bytesOut: BigInt(5120),
      });
      mockPrisma.liveSession.findUnique.mockResolvedValue(testSession);
      
      const result = await databaseService.getSession(testSession.id);
      
      expect(result).toEqual(expect.objectContaining({
        id: testSession.id,
        endpointId: testSession.endpointId,
        msgsIn: 100,
        msgsOut: 50,
        bytesIn: BigInt(10240),
        bytesOut: BigInt(5120),
      }));
    });

    it('should expose prisma client', () => {
      const client = databaseService.client;
      expect(client).toBe(mockPrisma);
    });
  });

  describe('Singleton Functions', () => {
    it('should return same instance from getDatabaseService', () => {
      const service1 = getDatabaseService();
      const service2 = getDatabaseService();
      
      expect(service1).toBe(service2);
    });

    it('should initialize database service', async () => {
      const connectSpy = vi.spyOn(DatabaseService.prototype, 'connect').mockResolvedValue();
      
      const service = await initializeDatabase();
      
      expect(connectSpy).toHaveBeenCalled();
      expect(service).toBeInstanceOf(DatabaseService);
    });

    it('should shutdown database service', async () => {
      const disconnectSpy = vi.spyOn(DatabaseService.prototype, 'disconnect').mockResolvedValue();
      
      // First get a service to create the singleton
      getDatabaseService();
      
      await shutdownDatabase();
      
      expect(disconnectSpy).toHaveBeenCalled();
    });

    it('should handle shutdown when no service exists', async () => {
      // Should not throw error
      await expect(shutdownDatabase()).resolves.toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle session creation errors', async () => {
      const error = new Error('Database error');
      mockPrisma.liveSession.create.mockRejectedValue(error);
      
      await expect(databaseService.createSession('endpoint-123')).rejects.toThrow('Database error');
    });

    it('should handle session update errors', async () => {
      const error = new Error('Update failed');
      mockPrisma.liveSession.update.mockRejectedValue(error);
      
      await expect(databaseService.updateSession('session-123', { msgsIn: 10 }))
        .rejects.toThrow('Update failed');
    });

    it('should handle traffic sample creation errors', async () => {
      const error = new Error('Insert failed');
      mockPrisma.trafficSample.create.mockRejectedValue(error);
      
      const sampleData = {
        sessionId: 'session-123',
        endpointId: 'endpoint-123',
        direction: 'INBOUND' as any,
        timestamp: new Date(),
        sizeBytes: 1024,
      };
      
      await expect(databaseService.createTrafficSample(sampleData))
        .rejects.toThrow('Insert failed');
    });

    it('should handle cleanup errors gracefully', async () => {
      const error = new Error('Cleanup failed');
      mockPrisma.liveSession.deleteMany.mockRejectedValue(error);
      
      await expect(databaseService.cleanupOldSessions()).rejects.toThrow('Cleanup failed');
    });
  });
});