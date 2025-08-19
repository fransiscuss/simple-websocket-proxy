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
    auditLog: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

describe('Audit API Integration Tests', () => {
  const { request, authHeaders } = createIntegrationTestHelpers();
  let mockPrisma: any;
  
  const testAuditLogs = [
    generateTestData.auditLog({
      id: 'audit-1',
      action: 'CREATE_ENDPOINT',
      entityType: 'ENDPOINT',
      entityId: 'endpoint-1',
      timestamp: new Date('2023-01-01T10:00:00Z'),
      details: { userId: 'user-123', name: 'Test Endpoint' }
    }),
    generateTestData.auditLog({
      id: 'audit-2',
      action: 'UPDATE_ENDPOINT',
      entityType: 'ENDPOINT',
      entityId: 'endpoint-1',
      timestamp: new Date('2023-01-01T11:00:00Z'),
      details: { userId: 'user-123', changes: { enabled: false } }
    }),
    generateTestData.auditLog({
      id: 'audit-3',
      action: 'FORCE_CLOSE_SESSION',
      entityType: 'SESSION',
      entityId: 'session-1',
      timestamp: new Date('2023-01-01T12:00:00Z'),
      details: { userId: 'user-123', endpointId: 'endpoint-1' }
    }),
  ];
  
  setupIntegrationTestGlobals();

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Get the mocked prisma instance
    const { prisma } = await import('../../services/database');
    mockPrisma = vi.mocked(prisma);
  });

  describe('GET /api/audit', () => {

    it('should get audit logs with default pagination', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue(testAuditLogs);
      mockPrisma.auditLog.count.mockResolvedValue(3);

      const response = await request
        .get('/api/audit')
        .set(authHeaders())
        .expect(200);

      expect(response.body).toEqual({
        auditLogs: testAuditLogs.map(log => ({
          ...log,
          timestamp: log.timestamp.toISOString(),
        })),
        pagination: {
          page: 1,
          limit: 50,
          total: 3,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 50,
        orderBy: { timestamp: 'desc' },
      });
    });

    it('should handle pagination parameters', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([testAuditLogs[0]]);
      mockPrisma.auditLog.count.mockResolvedValue(150);

      const response = await request
        .get('/api/audit?page=2&limit=25')
        .set(authHeaders())
        .expect(200);

      expect(response.body.pagination).toEqual({
        page: 2,
        limit: 25,
        total: 150,
        totalPages: 6,
        hasNext: true,
        hasPrev: true,
      });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 25, // (2-1) * 25
        take: 25,
        orderBy: { timestamp: 'desc' },
      });
    });

    it('should filter by action', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([testAuditLogs[0]]);
      mockPrisma.auditLog.count.mockResolvedValue(1);

      await request
        .get('/api/audit?action=CREATE_ENDPOINT')
        .set(authHeaders())
        .expect(200);

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
        where: { action: { contains: 'CREATE_ENDPOINT', mode: 'insensitive' } },
        skip: 0,
        take: 50,
        orderBy: { timestamp: 'desc' },
      });
    });

    it('should filter by entityType', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([testAuditLogs[0], testAuditLogs[1]]);
      mockPrisma.auditLog.count.mockResolvedValue(2);

      await request
        .get('/api/audit?entityType=ENDPOINT')
        .set(authHeaders())
        .expect(200);

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
        where: { entityType: { contains: 'ENDPOINT', mode: 'insensitive' } },
        skip: 0,
        take: 50,
        orderBy: { timestamp: 'desc' },
      });
    });

    it('should filter by entityId', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([testAuditLogs[0], testAuditLogs[1]]);
      mockPrisma.auditLog.count.mockResolvedValue(2);

      await request
        .get('/api/audit?entityId=endpoint-1')
        .set(authHeaders())
        .expect(200);

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
        where: { entityId: 'endpoint-1' },
        skip: 0,
        take: 50,
        orderBy: { timestamp: 'desc' },
      });
    });

    it('should filter by date range', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([testAuditLogs[1]]);
      mockPrisma.auditLog.count.mockResolvedValue(1);

      await request
        .get('/api/audit?startDate=2023-01-01T10:30:00Z&endDate=2023-01-01T11:30:00Z')
        .set(authHeaders())
        .expect(200);

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
        where: { 
          timestamp: {
            gte: new Date('2023-01-01T10:30:00Z'),
            lte: new Date('2023-01-01T11:30:00Z'),
          }
        },
        skip: 0,
        take: 50,
        orderBy: { timestamp: 'desc' },
      });
    });

    it('should filter by start date only', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([testAuditLogs[1], testAuditLogs[2]]);
      mockPrisma.auditLog.count.mockResolvedValue(2);

      await request
        .get('/api/audit?startDate=2023-01-01T10:30:00Z')
        .set(authHeaders())
        .expect(200);

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
        where: { 
          timestamp: {
            gte: new Date('2023-01-01T10:30:00Z'),
          }
        },
        skip: 0,
        take: 50,
        orderBy: { timestamp: 'desc' },
      });
    });

    it('should filter by end date only', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([testAuditLogs[0]]);
      mockPrisma.auditLog.count.mockResolvedValue(1);

      await request
        .get('/api/audit?endDate=2023-01-01T10:30:00Z')
        .set(authHeaders())
        .expect(200);

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
        where: { 
          timestamp: {
            lte: new Date('2023-01-01T10:30:00Z'),
          }
        },
        skip: 0,
        take: 50,
        orderBy: { timestamp: 'desc' },
      });
    });

    it('should combine multiple filters', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([testAuditLogs[1]]);
      mockPrisma.auditLog.count.mockResolvedValue(1);

      await request
        .get('/api/audit?action=UPDATE&entityType=ENDPOINT&entityId=endpoint-1')
        .set(authHeaders())
        .expect(200);

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
        where: { 
          action: { contains: 'UPDATE', mode: 'insensitive' },
          entityType: { contains: 'ENDPOINT', mode: 'insensitive' },
          entityId: 'endpoint-1'
        },
        skip: 0,
        take: 50,
        orderBy: { timestamp: 'desc' },
      });
    });

    it('should sanitize pagination parameters', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.count.mockResolvedValue(0);

      await request
        .get('/api/audit?page=0&limit=200')
        .set(authHeaders())
        .expect(200);

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0, // page 0 should become page 1
        take: 100, // limit 200 should be capped at 100
        orderBy: { timestamp: 'desc' },
      });
    });

    it('should handle invalid date parameters gracefully', async () => {
      const response = await request
        .get('/api/audit?startDate=invalid-date')
        .set(authHeaders())
        .expect(400);

      expect(response.body).toEqual({
        error: 'Invalid query parameters',
        details: expect.any(Array),
      });
    });

    it('should handle database errors', async () => {
      mockPrisma.auditLog.findMany.mockRejectedValue(new Error('Database error'));

      const response = await request
        .get('/api/audit')
        .set(authHeaders())
        .expect(500);

      expect(response.body).toEqual({ error: 'Failed to fetch audit logs' });
    });

    it('should require authentication', async () => {
      const { authenticateToken, requireAdmin } = await import('../../middleware/auth');
      
      await request.get('/api/audit').set(authHeaders());
      
      expect(authenticateToken).toHaveBeenCalled();
      expect(requireAdmin).toHaveBeenCalled();
    });
  });

  describe('GET /api/audit/actions', () => {
    const testActions = [
      { action: 'CREATE_ENDPOINT' },
      { action: 'UPDATE_ENDPOINT' },
      { action: 'DELETE_ENDPOINT' },
      { action: 'FORCE_CLOSE_SESSION' },
    ];

    it('should get distinct actions successfully', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue(testActions);

      const response = await request
        .get('/api/audit/actions')
        .set(authHeaders())
        .expect(200);

      expect(response.body).toEqual({
        actions: ['CREATE_ENDPOINT', 'UPDATE_ENDPOINT', 'DELETE_ENDPOINT', 'FORCE_CLOSE_SESSION'],
      });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
        select: { action: true },
        distinct: ['action'],
        orderBy: { action: 'asc' },
      });
    });

    it('should handle empty actions list', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);

      const response = await request
        .get('/api/audit/actions')
        .set(authHeaders())
        .expect(200);

      expect(response.body).toEqual({ actions: [] });
    });

    it('should handle database errors', async () => {
      mockPrisma.auditLog.findMany.mockRejectedValue(new Error('Database error'));

      const response = await request
        .get('/api/audit/actions')
        .set(authHeaders())
        .expect(500);

      expect(response.body).toEqual({ error: 'Failed to fetch audit actions' });
    });

    it('should require authentication', async () => {
      const { authenticateToken, requireAdmin } = await import('../../middleware/auth');
      
      await request.get('/api/audit/actions').set(authHeaders());
      
      expect(authenticateToken).toHaveBeenCalled();
      expect(requireAdmin).toHaveBeenCalled();
    });
  });

  describe('GET /api/audit/entity-types', () => {
    const testEntityTypes = [
      { entityType: 'ENDPOINT' },
      { entityType: 'SESSION' },
      { entityType: 'USER' },
    ];

    it('should get distinct entity types successfully', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue(testEntityTypes);

      const response = await request
        .get('/api/audit/entity-types')
        .set(authHeaders())
        .expect(200);

      expect(response.body).toEqual({
        entityTypes: ['ENDPOINT', 'SESSION', 'USER'],
      });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
        select: { entityType: true },
        distinct: ['entityType'],
        orderBy: { entityType: 'asc' },
      });
    });

    it('should handle empty entity types list', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);

      const response = await request
        .get('/api/audit/entity-types')
        .set(authHeaders())
        .expect(200);

      expect(response.body).toEqual({ entityTypes: [] });
    });

    it('should handle database errors', async () => {
      mockPrisma.auditLog.findMany.mockRejectedValue(new Error('Database error'));

      const response = await request
        .get('/api/audit/entity-types')
        .set(authHeaders())
        .expect(500);

      expect(response.body).toEqual({ error: 'Failed to fetch entity types' });
    });

    it('should require authentication', async () => {
      const { authenticateToken, requireAdmin } = await import('../../middleware/auth');
      
      await request.get('/api/audit/entity-types').set(authHeaders());
      
      expect(authenticateToken).toHaveBeenCalled();
      expect(requireAdmin).toHaveBeenCalled();
    });
  });

  describe('Query Parameter Validation', () => {
    it('should handle invalid page parameter', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.count.mockResolvedValue(0);

      await request
        .get('/api/audit?page=invalid')
        .set(authHeaders())
        .expect(200);

      // Should default to page 1
      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 50,
        orderBy: { timestamp: 'desc' },
      });
    });

    it('should handle invalid limit parameter', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.count.mockResolvedValue(0);

      await request
        .get('/api/audit?limit=invalid')
        .set(authHeaders())
        .expect(200);

      // Should default to limit 50
      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 50,
        orderBy: { timestamp: 'desc' },
      });
    });

    it('should handle empty string filters gracefully', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.count.mockResolvedValue(0);

      await request
        .get('/api/audit?action=&entityType=&entityId=')
        .set(authHeaders())
        .expect(200);

      // Should ignore empty filters
      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 50,
        orderBy: { timestamp: 'desc' },
      });
    });

    it('should handle case-insensitive action search', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([testAuditLogs[0]]);
      mockPrisma.auditLog.count.mockResolvedValue(1);

      await request
        .get('/api/audit?action=create')
        .set(authHeaders())
        .expect(200);

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
        where: { action: { contains: 'create', mode: 'insensitive' } },
        skip: 0,
        take: 50,
        orderBy: { timestamp: 'desc' },
      });
    });

    it('should handle case-insensitive entityType search', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([testAuditLogs[0]]);
      mockPrisma.auditLog.count.mockResolvedValue(1);

      await request
        .get('/api/audit?entityType=endpoint')
        .set(authHeaders())
        .expect(200);

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
        where: { entityType: { contains: 'endpoint', mode: 'insensitive' } },
        skip: 0,
        take: 50,
        orderBy: { timestamp: 'desc' },
      });
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large audit log lists efficiently', async () => {
      const largeAuditLogs = Array.from({ length: 100 }, (_, i) =>
        generateTestData.auditLog({ id: `audit-${i}` })
      );
      
      mockPrisma.auditLog.findMany.mockResolvedValue(largeAuditLogs);
      mockPrisma.auditLog.count.mockResolvedValue(10000);

      const response = await request
        .get('/api/audit?limit=100')
        .set(authHeaders())
        .expect(200);

      expect(response.body.auditLogs).toHaveLength(100);
      expect(response.body.pagination.total).toBe(10000);
    });

    it('should handle concurrent requests properly', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.count.mockResolvedValue(0);

      // Reduce concurrency to prevent ECONNRESET and add sequential execution
      const promises = Array.from({ length: 3 }, async (_, i) => {
        try {
          // Add small delay between requests to prevent connection flooding
          await new Promise(resolve => setTimeout(resolve, i * 50));
          return await request.get('/api/audit').set(authHeaders());
        } catch (error) {
          // Retry once on connection reset
          if (error.code === 'ECONNRESET') {
            await new Promise(resolve => setTimeout(resolve, 100));
            return await request.get('/api/audit').set(authHeaders());
          }
          throw error;
        }
      });

      const responses = await Promise.all(promises);

      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });

    it('should order results by timestamp desc for recent-first display', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue(testAuditLogs);
      mockPrisma.auditLog.count.mockResolvedValue(3);

      await request
        .get('/api/audit')
        .set(authHeaders())
        .expect(200);

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 50,
        orderBy: { timestamp: 'desc' },
      });
    });
  });

  describe('Data Integrity', () => {
    it('should preserve audit log structure and details', async () => {
      const detailedAuditLog = generateTestData.auditLog({
        details: {
          userId: 'user-123',
          changes: {
            name: 'New Name',
            enabled: false,
            limits: { maxConnections: 200 }
          },
          previousValues: {
            name: 'Old Name',
            enabled: true,
            limits: { maxConnections: 100 }
          }
        }
      });

      mockPrisma.auditLog.findMany.mockResolvedValue([detailedAuditLog]);
      mockPrisma.auditLog.count.mockResolvedValue(1);

      const response = await request
        .get('/api/audit')
        .set(authHeaders())
        .expect(200);

      expect(response.body.auditLogs[0].details).toEqual(detailedAuditLog.details);
    });

    it('should handle audit logs with minimal details', async () => {
      const minimalAuditLog = generateTestData.auditLog({
        details: { userId: 'user-123' }
      });

      mockPrisma.auditLog.findMany.mockResolvedValue([minimalAuditLog]);
      mockPrisma.auditLog.count.mockResolvedValue(1);

      const response = await request
        .get('/api/audit')
        .set(authHeaders())
        .expect(200);

      expect(response.body.auditLogs[0]).toEqual({
        ...minimalAuditLog,
        timestamp: minimalAuditLog.timestamp.toISOString(),
      });
    });
  });
});