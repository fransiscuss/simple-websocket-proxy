import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createIntegrationTestHelpers, setupIntegrationTestGlobals } from '../helpers/integration-setup';
import { generateTestData } from '../helpers/test-setup';

// Mock auth middleware to allow authenticated requests
vi.mock('../../middleware/auth', () => ({
  authenticateToken: vi.fn((req, res, next) => {
    req.user = { userId: 'user-123', email: 'test@example.com', role: 'ADMIN' };
    next();
  }),
  requireAdmin: vi.fn((req, res, next) => next()),
}));

vi.mock('../../utils/logger', () => ({
  createLogger: () => ({
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Mock prisma
vi.mock('../../services/database', () => ({
  prisma: {
    liveSession: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

describe('Sessions API Integration Tests', () => {
  const { request, authHeaders } = createIntegrationTestHelpers();
  let mockPrisma: any;
  
  setupIntegrationTestGlobals();

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Get the mocked prisma instance
    const { prisma } = await import('../../services/database');
    mockPrisma = vi.mocked(prisma);
  });

  describe('GET /api/sessions', () => {
    const testSessions = [
      generateTestData.session({ 
        id: 'session-1', 
        endpointId: 'endpoint-1',
        state: 'ACTIVE',
        endpoint: {
          id: 'endpoint-1',
          name: 'Endpoint 1',
          targetUrl: 'wss://example.com/ws1'
        },
        _count: { trafficSamples: 5 }
      }),
      generateTestData.session({ 
        id: 'session-2', 
        endpointId: 'endpoint-2',
        state: 'CLOSED',
        endpoint: {
          id: 'endpoint-2',
          name: 'Endpoint 2',
          targetUrl: 'wss://example.com/ws2'
        },
        _count: { trafficSamples: 3 }
      }),
    ];

    it('should get sessions with default pagination', async () => {
      mockPrisma.liveSession.findMany.mockResolvedValue(testSessions);
      mockPrisma.liveSession.count.mockResolvedValue(2);

      const response = await request
        .get('/api/sessions')
        .set(authHeaders())
        .expect(200);

      expect(response.body).toEqual({
        sessions: testSessions,
        pagination: {
          page: 1,
          limit: 20,
          total: 2,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      });

      expect(mockPrisma.liveSession.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 20,
        orderBy: { startedAt: 'desc' },
        include: {
          endpoint: {
            select: {
              id: true,
              name: true,
              targetUrl: true,
            },
          },
          _count: {
            select: { trafficSamples: true },
          },
        },
      });
    });

    it('should handle pagination parameters', async () => {
      mockPrisma.liveSession.findMany.mockResolvedValue([testSessions[0]]);
      mockPrisma.liveSession.count.mockResolvedValue(50);

      const response = await request
        .get('/api/sessions?page=2&limit=10')
        .set(authHeaders())
        .expect(200);

      expect(response.body.pagination).toEqual({
        page: 2,
        limit: 10,
        total: 50,
        totalPages: 5,
        hasNext: true,
        hasPrev: true,
      });

      expect(mockPrisma.liveSession.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 10, // (2-1) * 10
        take: 10,
        orderBy: { startedAt: 'desc' },
        include: {
          endpoint: {
            select: {
              id: true,
              name: true,
              targetUrl: true,
            },
          },
          _count: {
            select: { trafficSamples: true },
          },
        },
      });
    });

    it('should filter by endpointId', async () => {
      mockPrisma.liveSession.findMany.mockResolvedValue([testSessions[0]]);
      mockPrisma.liveSession.count.mockResolvedValue(1);

      await request
        .get('/api/sessions?endpointId=endpoint-1')
        .set(authHeaders())
        .expect(200);

      expect(mockPrisma.liveSession.findMany).toHaveBeenCalledWith({
        where: { endpointId: 'endpoint-1' },
        skip: 0,
        take: 20,
        orderBy: { startedAt: 'desc' },
        include: {
          endpoint: {
            select: {
              id: true,
              name: true,
              targetUrl: true,
            },
          },
          _count: {
            select: { trafficSamples: true },
          },
        },
      });
    });

    it('should filter by state', async () => {
      mockPrisma.liveSession.findMany.mockResolvedValue([testSessions[0]]);
      mockPrisma.liveSession.count.mockResolvedValue(1);

      await request
        .get('/api/sessions?state=ACTIVE')
        .set(authHeaders())
        .expect(200);

      expect(mockPrisma.liveSession.findMany).toHaveBeenCalledWith({
        where: { state: 'ACTIVE' },
        skip: 0,
        take: 20,
        orderBy: { startedAt: 'desc' },
        include: {
          endpoint: {
            select: {
              id: true,
              name: true,
              targetUrl: true,
            },
          },
          _count: {
            select: { trafficSamples: true },
          },
        },
      });
    });

    it('should filter by both endpointId and state', async () => {
      mockPrisma.liveSession.findMany.mockResolvedValue([]);
      mockPrisma.liveSession.count.mockResolvedValue(0);

      await request
        .get('/api/sessions?endpointId=endpoint-1&state=CLOSED')
        .set(authHeaders())
        .expect(200);

      expect(mockPrisma.liveSession.findMany).toHaveBeenCalledWith({
        where: { 
          endpointId: 'endpoint-1',
          state: 'CLOSED'
        },
        skip: 0,
        take: 20,
        orderBy: { startedAt: 'desc' },
        include: {
          endpoint: {
            select: {
              id: true,
              name: true,
              targetUrl: true,
            },
          },
          _count: {
            select: { trafficSamples: true },
          },
        },
      });
    });

    it('should validate state parameter', async () => {
      const response = await request
        .get('/api/sessions?state=INVALID_STATE')
        .set(authHeaders())
        .expect(400);

      expect(response.body).toEqual({
        error: 'Invalid query parameters',
        details: expect.any(Array),
      });
    });

    it('should sanitize pagination parameters', async () => {
      mockPrisma.liveSession.findMany.mockResolvedValue([]);
      mockPrisma.liveSession.count.mockResolvedValue(0);

      await request
        .get('/api/sessions?page=0&limit=200')
        .set(authHeaders())
        .expect(200);

      expect(mockPrisma.liveSession.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0, // page 0 should become page 1
        take: 100, // limit 200 should be capped at 100
        orderBy: { startedAt: 'desc' },
        include: {
          endpoint: {
            select: {
              id: true,
              name: true,
              targetUrl: true,
            },
          },
          _count: {
            select: { trafficSamples: true },
          },
        },
      });
    });

    it('should handle database errors', async () => {
      mockPrisma.liveSession.findMany.mockRejectedValue(new Error('Database error'));

      const response = await request
        .get('/api/sessions')
        .set(authHeaders())
        .expect(500);

      expect(response.body).toEqual({ error: 'Failed to fetch sessions' });
    });

    it('should require authentication', async () => {
      const { authenticateToken, requireAdmin } = await import('../../middleware/auth');
      
      await request.get('/api/sessions').set(authHeaders());
      
      expect(authenticateToken).toHaveBeenCalled();
      expect(requireAdmin).toHaveBeenCalled();
    });
  });

  describe('GET /api/sessions/:id', () => {
    const testSession = generateTestData.session({
      id: 'session-123',
      endpoint: {
        id: 'endpoint-1',
        name: 'Test Endpoint',
        targetUrl: 'wss://example.com/ws'
      },
      trafficSamples: [
        generateTestData.trafficSample({ id: 'sample-1' }),
        generateTestData.trafficSample({ id: 'sample-2' }),
      ]
    });

    it('should get session by id successfully', async () => {
      mockPrisma.liveSession.findUnique.mockResolvedValue(testSession);

      const response = await request
        .get('/api/sessions/session-123')
        .set(authHeaders())
        .expect(200);

      expect(response.body).toEqual(testSession);
      expect(mockPrisma.liveSession.findUnique).toHaveBeenCalledWith({
        where: { id: 'session-123' },
        include: {
          endpoint: {
            select: {
              id: true,
              name: true,
              targetUrl: true,
            },
          },
          trafficSamples: {
            take: 50,
            orderBy: { timestamp: 'desc' },
          },
        },
      });
    });

    it('should return 404 for non-existent session', async () => {
      mockPrisma.liveSession.findUnique.mockResolvedValue(null);

      const response = await request
        .get('/api/sessions/non-existent')
        .set(authHeaders())
        .expect(404);

      expect(response.body).toEqual({ error: 'Session not found' });
    });

    it('should handle database errors', async () => {
      mockPrisma.liveSession.findUnique.mockRejectedValue(new Error('Database error'));

      const response = await request
        .get('/api/sessions/session-123')
        .set(authHeaders())
        .expect(500);

      expect(response.body).toEqual({ error: 'Failed to fetch session' });
    });

    it('should limit traffic samples to 50 most recent', async () => {
      await request
        .get('/api/sessions/session-123')
        .set(authHeaders());

      expect(mockPrisma.liveSession.findUnique).toHaveBeenCalledWith({
        where: { id: 'session-123' },
        include: {
          endpoint: {
            select: {
              id: true,
              name: true,
              targetUrl: true,
            },
          },
          trafficSamples: {
            take: 50,
            orderBy: { timestamp: 'desc' },
          },
        },
      });
    });
  });

  describe('DELETE /api/sessions/:id', () => {
    const testSession = generateTestData.session({
      id: 'session-123',
      endpointId: 'endpoint-1'
    });

    it('should force close session successfully', async () => {
      mockPrisma.liveSession.findUnique.mockResolvedValue(testSession);
      mockPrisma.liveSession.update.mockResolvedValue({ ...testSession, state: 'CLOSED' });
      mockPrisma.auditLog.create.mockResolvedValue({});

      await request
        .delete('/api/sessions/session-123')
        .set(authHeaders())
        .expect(204);

      expect(mockPrisma.liveSession.findUnique).toHaveBeenCalledWith({
        where: { id: 'session-123' },
        select: { id: true, endpointId: true },
      });

      expect(mockPrisma.liveSession.update).toHaveBeenCalledWith({
        where: { id: 'session-123' },
        data: { state: 'CLOSED' },
      });

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          action: 'FORCE_CLOSE_SESSION',
          entityType: 'SESSION',
          entityId: 'session-123',
          details: {
            endpointId: 'endpoint-1',
            userId: 'user-123',
          },
        },
      });
    });

    it('should return 404 for non-existent session', async () => {
      mockPrisma.liveSession.findUnique.mockResolvedValue(null);

      const response = await request
        .delete('/api/sessions/non-existent')
        .set(authHeaders())
        .expect(404);

      expect(response.body).toEqual({ error: 'Session not found' });
      expect(mockPrisma.liveSession.update).not.toHaveBeenCalled();
    });

    it('should handle database update errors', async () => {
      mockPrisma.liveSession.findUnique.mockResolvedValue(testSession);
      mockPrisma.liveSession.update.mockRejectedValue(new Error('Update failed'));

      const response = await request
        .delete('/api/sessions/session-123')
        .set(authHeaders())
        .expect(500);

      expect(response.body).toEqual({ error: 'Failed to close session' });
    });

    it('should handle audit log creation failures gracefully', async () => {
      mockPrisma.liveSession.findUnique.mockResolvedValue(testSession);
      mockPrisma.liveSession.update.mockResolvedValue({ ...testSession, state: 'CLOSED' });
      mockPrisma.auditLog.create.mockRejectedValue(new Error('Audit failed'));

      // Should still succeed even if audit log fails
      await request
        .delete('/api/sessions/session-123')
        .set(authHeaders())
        .expect(204);
    });

    it('should only update session state to CLOSED', async () => {
      mockPrisma.liveSession.findUnique.mockResolvedValue(testSession);
      mockPrisma.liveSession.update.mockResolvedValue({ ...testSession, state: 'CLOSED' });
      mockPrisma.auditLog.create.mockResolvedValue({});

      await request
        .delete('/api/sessions/session-123')
        .set(authHeaders())
        .expect(204);

      // Should not actually delete the session, just update state
      expect(mockPrisma.liveSession.update).toHaveBeenCalledWith({
        where: { id: 'session-123' },
        data: { state: 'CLOSED' },
      });
      expect(mockPrisma.liveSession.delete).not.toHaveBeenCalled();
    });
  });

  describe('Authentication and Authorization', () => {
    it('should require authentication for all endpoints', async () => {
      const { authenticateToken, requireAdmin } = await import('../../middleware/auth');
      
      await request.get('/api/sessions').set(authHeaders());
      await request.get('/api/sessions/123').set(authHeaders());
      await request.delete('/api/sessions/123').set(authHeaders());
      
      expect(authenticateToken).toHaveBeenCalledTimes(3);
      expect(requireAdmin).toHaveBeenCalledTimes(3);
    });
  });

  describe('Query Parameter Validation', () => {
    it('should handle invalid page parameter', async () => {
      mockPrisma.liveSession.findMany.mockResolvedValue([]);
      mockPrisma.liveSession.count.mockResolvedValue(0);

      await request
        .get('/api/sessions?page=invalid')
        .set(authHeaders())
        .expect(200);

      // Should default to page 1
      expect(mockPrisma.liveSession.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 20,
        orderBy: { startedAt: 'desc' },
        include: {
          endpoint: {
            select: {
              id: true,
              name: true,
              targetUrl: true,
            },
          },
          _count: {
            select: { trafficSamples: true },
          },
        },
      });
    });

    it('should handle invalid limit parameter', async () => {
      mockPrisma.liveSession.findMany.mockResolvedValue([]);
      mockPrisma.liveSession.count.mockResolvedValue(0);

      await request
        .get('/api/sessions?limit=invalid')
        .set(authHeaders())
        .expect(200);

      // Should default to limit 20
      expect(mockPrisma.liveSession.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 20,
        orderBy: { startedAt: 'desc' },
        include: {
          endpoint: {
            select: {
              id: true,
              name: true,
              targetUrl: true,
            },
          },
          _count: {
            select: { trafficSamples: true },
          },
        },
      });
    });

    it('should ignore invalid endpointId gracefully', async () => {
      mockPrisma.liveSession.findMany.mockResolvedValue([]);
      mockPrisma.liveSession.count.mockResolvedValue(0);

      await request
        .get('/api/sessions?endpointId=')
        .set(authHeaders())
        .expect(200);

      // Should ignore empty endpointId
      expect(mockPrisma.liveSession.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 20,
        orderBy: { startedAt: 'desc' },
        include: {
          endpoint: {
            select: {
              id: true,
              name: true,
              targetUrl: true,
            },
          },
          _count: {
            select: { trafficSamples: true },
          },
        },
      });
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large session lists efficiently', async () => {
      const largeSessions = Array.from({ length: 100 }, (_, i) =>
        generateTestData.session({ id: `session-${i}` })
      );
      
      mockPrisma.liveSession.findMany.mockResolvedValue(largeSessions);
      mockPrisma.liveSession.count.mockResolvedValue(1000);

      const response = await request
        .get('/api/sessions?limit=100')
        .set(authHeaders())
        .expect(200);

      expect(response.body.sessions).toHaveLength(100);
      expect(response.body.pagination.total).toBe(1000);
    });

    it('should handle concurrent requests properly', async () => {
      mockPrisma.liveSession.findMany.mockResolvedValue([]);
      mockPrisma.liveSession.count.mockResolvedValue(0);

      const promises = Array.from({ length: 5 }, () =>
        request.get('/api/sessions').set(authHeaders())
      );

      const responses = await Promise.all(promises);

      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });
  });
});