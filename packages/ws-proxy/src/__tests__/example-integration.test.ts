import { describe, it, expect, vi } from 'vitest';
import { DatabaseService } from '../services/database';
import { SessionManager } from '../services/session-manager';
import { TelemetryService } from '../services/telemetry';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { createMockRequest, createMockResponse, createMockNext } from './mocks/express';
import { MockWebSocket } from './mocks/websocket';

// Mock external dependencies
vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => ({
    $connect: vi.fn(),
    $disconnect: vi.fn(),
    $queryRaw: vi.fn(),
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
      create: vi.fn().mockResolvedValue({
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
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    trafficSample: {
      create: vi.fn(),
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  })),
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

vi.mock('../utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(() => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    })),
  }),
  loggers: {
    database: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
    session: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
    proxy: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
  },
  logError: vi.fn(),
  logDatabaseOperation: vi.fn(),
  logConnectionEvent: vi.fn(),
  logMessage: vi.fn(),
}));

vi.mock('jsonwebtoken', () => ({
  default: {
    verify: vi.fn(),
    sign: vi.fn(),
  },
}));

import jwt from 'jsonwebtoken';
const mockJwt = vi.mocked(jwt);

describe('Integration Tests', () => {
  describe('Core Service Integration', () => {
    it('should create and manage a complete session lifecycle', async () => {
      const sessionManager = new SessionManager();
      

      // Create a session
      const mockWebSocket = new MockWebSocket();
      const sessionId = await sessionManager.createSession('endpoint-123', mockWebSocket as unknown as WebSocket);
      
      expect(sessionId).toBe('session-123');

      // Verify session is tracked
      const connection = sessionManager.getSession(sessionId);
      expect(connection).toBeDefined();
      expect(connection?.endpointId).toBe('endpoint-123');
      expect(connection?.sessionId).toBe(sessionId);
    });

    it('should handle telemetry service correctly', () => {
      const telemetryService = new TelemetryService();
      const mockClient = new MockWebSocket();
      
      // Add client
      telemetryService.addClient(mockClient as unknown as WebSocket);
      expect(telemetryService.getClientCount()).toBe(1);
      
      // Broadcast event
      const event = {
        type: 'sessionStarted',
        timestamp: new Date().toISOString(),
        data: { sessionId: 'session-123', endpointId: 'endpoint-123', clientIP: '192.168.1.1' },
      };
      
      const sendSpy = vi.spyOn(mockClient, 'send');
      telemetryService.broadcast(event);
      
      expect(sendSpy).toHaveBeenCalledWith(JSON.stringify(event));
      
      // Remove client
      mockClient.emit('close');
      expect(telemetryService.getClientCount()).toBe(0);
    });
  });

  describe('Authentication Integration', () => {
    it('should authenticate and authorize admin users', () => {
      // Use the existing mocked JWT
      
      // Mock valid JWT verification
      const mockUser = {
        userId: 'user-123',
        email: 'admin@example.com',
        role: 'ADMIN',
      };
      mockJwt.verify.mockReturnValue(mockUser);
      
      const req = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
      });
      const res = createMockResponse();
      const next = createMockNext();
      
      // Test authentication
      authenticateToken(req, res, next);
      expect(req.user).toEqual(mockUser);
      expect(next).toHaveBeenCalled();
      
      // Test authorization
      const next2 = createMockNext();
      requireAdmin(req, res, next2);
      expect(next2).toHaveBeenCalled();
    });

    it('should reject non-admin users', () => {
      const req = createMockRequest({
        user: {
          userId: 'user-123',
          email: 'user@example.com',
          role: 'USER',
        },
      });
      const res = createMockResponse();
      const next = createMockNext();
      
      requireAdmin(req, res, next);
      
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Admin role required' });
    });
  });

  describe('Data Flow Integration', () => {
    it('should track messages through the system', async () => {
      const sessionManager = new SessionManager();
      const telemetryService = new TelemetryService();
      
      // Setup mocks
      const mockPrisma = (sessionManager as unknown as { database: { client: any } }).database.client;
      mockPrisma.liveSession.create.mockResolvedValue({
        id: 'session-123',
        endpointId: 'endpoint-123',
        state: 'ACTIVE',
        startedAt: new Date(),
        lastSeen: new Date(),
        msgsIn: 0,
        msgsOut: 0,
        bytesIn: BigInt(0),
        bytesOut: BigInt(0),
      });
      mockPrisma.liveSession.update.mockResolvedValue({});
      mockPrisma.trafficSample.create.mockResolvedValue({});
      
      // Create session
      const mockWebSocket = new MockWebSocket();
      const sessionId = await sessionManager.createSession('endpoint-123', mockWebSocket as unknown as WebSocket);
      
      // Track message
      const sampling = { enabled: true, sampleRate: 1.0, storeContent: true };
      await sessionManager.trackMessage(sessionId, 'inbound', 100, 'text', 'test message', sampling);
      
      // Verify metrics updated
      const connection = sessionManager.getSession(sessionId);
      expect(connection?.metrics.msgsIn).toBe(1);
      expect(connection?.metrics.bytesIn).toBe(100);
      
      // Emit telemetry event
      telemetryService.emitMessageMeta(sessionId, 'endpoint-123', 'inbound', 100);
      
      // Should not throw errors
      expect(true).toBe(true);
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle database connection failures gracefully', async () => {
      const databaseService = new DatabaseService();
      const mockPrisma = databaseService.client as unknown as { endpoint: { findUnique: ReturnType<typeof vi.fn> } };
      
      // Mock database error
      mockPrisma.endpoint.findUnique.mockRejectedValue(new Error('Connection failed'));
      
      await expect(databaseService.getEndpoint('test-id')).rejects.toThrow('Connection failed');
    });

    it('should handle invalid authentication tokens', () => {
      mockJwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });
      
      const req = createMockRequest({
        headers: { authorization: 'Bearer invalid-token' },
      });
      const res = createMockResponse();
      const next = createMockNext();
      
      authenticateToken(req, res, next);
      
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
    });
  });

  describe('Configuration and Limits', () => {
    it('should respect rate limits', () => {
      const sessionManager = new SessionManager();
      const endpointId = 'endpoint-123';
      const limitRpm = 2;
      
      // Should allow initial requests
      expect(sessionManager.checkRateLimit(endpointId, limitRpm)).toBe(true);
      expect(sessionManager.checkRateLimit(endpointId, limitRpm)).toBe(true);
      
      // Should block after limit exceeded
      expect(sessionManager.checkRateLimit(endpointId, limitRpm)).toBe(false);
    });

    it('should check connection limits', async () => {
      const sessionManager = new SessionManager();
      const mockPrisma = (sessionManager as unknown as { database: { client: any } }).database.client;
      
      // Mock active connection count
      mockPrisma.liveSession.count.mockResolvedValue(10);
      
      // Should allow connections under limit
      const allowed = await sessionManager.checkConnectionLimit('endpoint-123', 15);
      expect(allowed).toBe(true);
      
      // Should block connections over limit
      const blocked = await sessionManager.checkConnectionLimit('endpoint-123', 5);
      expect(blocked).toBe(false);
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should provide accurate statistics', async () => {
      const sessionManager = new SessionManager();
      
      // Initially empty
      let stats = sessionManager.getStatistics();
      expect(stats.activeConnections).toBe(0);
      expect(stats.totalSessions).toBe(0);
      
      // Add sessions and verify stats update
      const mockPrisma = (sessionManager as unknown as { database: { client: any } }).database.client;
      mockPrisma.liveSession.create.mockResolvedValue({
        id: 'session-1',
        endpointId: 'endpoint-123',
        state: 'ACTIVE',
        startedAt: new Date(),
        lastSeen: new Date(),
        msgsIn: 0,
        msgsOut: 0,
        bytesIn: BigInt(0),
        bytesOut: BigInt(0),
      });
      
      const mockWs1 = new MockWebSocket();
      await sessionManager.createSession('endpoint-123', mockWs1 as unknown as WebSocket);
      
      stats = sessionManager.getStatistics();
      expect(stats.activeConnections).toBe(1);
      expect(stats.endpointStats['endpoint-123']).toBeDefined();
      expect(stats.endpointStats['endpoint-123'].sessions).toBe(1);
    });
  });
});