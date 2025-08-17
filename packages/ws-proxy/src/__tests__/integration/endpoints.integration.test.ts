import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createIntegrationTestHelpers, setupIntegrationTestGlobals } from '../helpers/integration-setup';
import { generateTestData } from '../helpers/test-setup';

// Mock auth middleware with configurable behavior
const mockAuthenticateToken = vi.fn((req, res, next) => {
  req.user = { userId: 'user-123', email: 'test@example.com', role: 'ADMIN' };
  next();
});

const mockRequireAdmin = vi.fn((req, res, next) => next());

vi.mock('../../middleware/auth', () => ({
  authenticateToken: mockAuthenticateToken,
  requireAdmin: mockRequireAdmin,
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
    endpoint: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

describe('Endpoints API Integration Tests', () => {
  const { request, authHeaders } = createIntegrationTestHelpers();
  let mockPrisma: any;
  
  setupIntegrationTestGlobals();

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Get the mocked prisma instance
    const { prisma } = await import('../../services/database');
    mockPrisma = vi.mocked(prisma);
  });

  describe('GET /api/endpoints', () => {
    const testEndpoints = [
      generateTestData.endpoint({ id: 'endpoint-1', name: 'Endpoint 1' }),
      generateTestData.endpoint({ id: 'endpoint-2', name: 'Endpoint 2' }),
    ];

    it('should get endpoints with default pagination', async () => {
      mockPrisma.endpoint.findMany.mockResolvedValue(testEndpoints);
      mockPrisma.endpoint.count.mockResolvedValue(2);

      const response = await request
        .get('/api/endpoints')
        .set(authHeaders())
        .expect(200);

      expect(response.body).toEqual({
        endpoints: testEndpoints.map(endpoint => ({
          ...endpoint,
          createdAt: endpoint.createdAt.toISOString(),
          updatedAt: endpoint.updatedAt.toISOString(),
        })),
        pagination: {
          page: 1,
          limit: 10,
          total: 2,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      });

      expect(mockPrisma.endpoint.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { liveSessions: true },
          },
        },
      });
    });

    it('should handle pagination parameters', async () => {
      mockPrisma.endpoint.findMany.mockResolvedValue([testEndpoints[0]]);
      mockPrisma.endpoint.count.mockResolvedValue(25);

      const response = await request
        .get('/api/endpoints?page=3&limit=5')
        .set(authHeaders())
        .expect(200);

      expect(response.body.pagination).toEqual({
        page: 3,
        limit: 5,
        total: 25,
        totalPages: 5,
        hasNext: true,
        hasPrev: true,
      });

      expect(mockPrisma.endpoint.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 10, // (3-1) * 5
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { liveSessions: true },
          },
        },
      });
    });

    it('should handle search parameter', async () => {
      mockPrisma.endpoint.findMany.mockResolvedValue([testEndpoints[0]]);
      mockPrisma.endpoint.count.mockResolvedValue(1);

      await request
        .get('/api/endpoints?search=test%20search')
        .set(authHeaders())
        .expect(200);

      expect(mockPrisma.endpoint.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { name: { contains: 'test search', mode: 'insensitive' } },
            { targetUrl: { contains: 'test search', mode: 'insensitive' } },
          ],
        },
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { liveSessions: true },
          },
        },
      });
    });

    it('should handle enabled filter', async () => {
      mockPrisma.endpoint.findMany.mockResolvedValue([testEndpoints[0]]);
      mockPrisma.endpoint.count.mockResolvedValue(1);

      await request
        .get('/api/endpoints?enabled=true')
        .set(authHeaders())
        .expect(200);

      expect(mockPrisma.endpoint.findMany).toHaveBeenCalledWith({
        where: { enabled: true },
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { liveSessions: true },
          },
        },
      });
    });

    it('should handle database errors', async () => {
      mockPrisma.endpoint.findMany.mockRejectedValue(new Error('Database error'));

      const response = await request
        .get('/api/endpoints')
        .set(authHeaders())
        .expect(500);

      expect(response.body).toEqual({ error: 'Failed to fetch endpoints' });
    });

    it('should sanitize pagination parameters', async () => {
      mockPrisma.endpoint.findMany.mockResolvedValue([]);
      mockPrisma.endpoint.count.mockResolvedValue(0);

      await request
        .get('/api/endpoints?page=0&limit=200')
        .set(authHeaders())
        .expect(200);

      expect(mockPrisma.endpoint.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0, // page 0 should become page 1
        take: 100, // limit 200 should be capped at 100
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { liveSessions: true },
          },
        },
      });
    });

    it('should require authentication', async () => {
      // Mock auth middleware to return 401
      mockAuthenticateToken.mockImplementationOnce((req, res) => {
        res.status(401).json({ error: 'Unauthorized' });
      });

      const response = await request
        .get('/api/endpoints')
        .expect(401);

      expect(mockAuthenticateToken).toHaveBeenCalled();
      expect(response.body).toEqual({ error: 'Unauthorized' });
    });
  });

  describe('GET /api/endpoints/:id', () => {
    const testEndpoint = generateTestData.endpoint();

    it('should get endpoint by id successfully', async () => {
      mockPrisma.endpoint.findUnique.mockResolvedValue(testEndpoint);

      const response = await request
        .get('/api/endpoints/endpoint-123')
        .set(authHeaders())
        .expect(200);

      expect(response.body).toEqual({
        ...testEndpoint,
        createdAt: testEndpoint.createdAt.toISOString(),
        updatedAt: testEndpoint.updatedAt.toISOString(),
      });
      expect(mockPrisma.endpoint.findUnique).toHaveBeenCalledWith({
        where: { id: 'endpoint-123' },
        include: {
          _count: {
            select: {
              liveSessions: true,
              trafficSamples: true,
            },
          },
        },
      });
    });

    it('should return 404 for non-existent endpoint', async () => {
      mockPrisma.endpoint.findUnique.mockResolvedValue(null);

      const response = await request
        .get('/api/endpoints/non-existent')
        .set(authHeaders())
        .expect(404);

      expect(response.body).toEqual({ error: 'Endpoint not found' });
    });

    it('should handle database errors', async () => {
      mockPrisma.endpoint.findUnique.mockRejectedValue(new Error('Database error'));

      const response = await request
        .get('/api/endpoints/endpoint-123')
        .set(authHeaders())
        .expect(500);

      expect(response.body).toEqual({ error: 'Failed to fetch endpoint' });
    });
  });

  describe('POST /api/endpoints', () => {
    const validEndpointData = {
      name: 'Test Endpoint',
      targetUrl: 'wss://example.com/ws',
      limits: {
        maxConnections: 50,
        maxMessageSize: 512000,
        timeoutMs: 20000,
      },
      sampling: {
        enabled: true,
        percentage: 15,
      },
      enabled: true,
    };

    const createdEndpoint = generateTestData.endpoint(validEndpointData);

    it('should create endpoint successfully', async () => {
      mockPrisma.endpoint.create.mockResolvedValue(createdEndpoint);
      mockPrisma.auditLog.create.mockResolvedValue({});

      const response = await request
        .post('/api/endpoints')
        .set(authHeaders())
        .send(validEndpointData)
        .expect(201);

      expect(response.body).toEqual({
        ...createdEndpoint,
        createdAt: createdEndpoint.createdAt.toISOString(),
        updatedAt: createdEndpoint.updatedAt.toISOString(),
      });
      expect(mockPrisma.endpoint.create).toHaveBeenCalledWith({
        data: validEndpointData,
      });

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          action: 'CREATE_ENDPOINT',
          entityType: 'ENDPOINT',
          entityId: createdEndpoint.id,
          details: {
            name: createdEndpoint.name,
            targetUrl: createdEndpoint.targetUrl,
            userId: 'user-123',
          },
        },
      });
    });

    it('should validate required fields', async () => {
      const response = await request
        .post('/api/endpoints')
        .set(authHeaders())
        .send({ name: 'Test' }) // Missing targetUrl
        .expect(400);

      expect(response.body).toEqual({
        error: 'Invalid request data',
        details: expect.any(Array),
      });
      expect(mockPrisma.endpoint.create).not.toHaveBeenCalled();
    });

    it('should validate URL format', async () => {
      const response = await request
        .post('/api/endpoints')
        .set(authHeaders())
        .send({
          name: 'Test Endpoint',
          targetUrl: 'invalid-url',
        })
        .expect(400);

      expect(response.body).toEqual({
        error: 'Invalid request data',
        details: expect.any(Array),
      });
    });

    it('should validate limits constraints', async () => {
      const response = await request
        .post('/api/endpoints')
        .set(authHeaders())
        .send({
          name: 'Test Endpoint',
          targetUrl: 'wss://example.com/ws',
          limits: {
            maxConnections: 20000, // Too high
            maxMessageSize: 500, // Too low
          },
        })
        .expect(400);

      expect(response.body).toEqual({
        error: 'Invalid request data',
        details: expect.any(Array),
      });
    });

    it('should handle database creation errors', async () => {
      mockPrisma.endpoint.create.mockRejectedValue(new Error('Creation failed'));

      const response = await request
        .post('/api/endpoints')
        .set(authHeaders())
        .send(validEndpointData)
        .expect(500);

      expect(response.body).toEqual({ error: 'Failed to create endpoint' });
    });

    it('should use default values for optional fields', async () => {
      const minimalData = {
        name: 'Minimal Endpoint',
        targetUrl: 'wss://example.com/ws',
      };

      mockPrisma.endpoint.create.mockResolvedValue(createdEndpoint);
      mockPrisma.auditLog.create.mockResolvedValue({});

      await request
        .post('/api/endpoints')
        .set(authHeaders())
        .send(minimalData)
        .expect(201);

      expect(mockPrisma.endpoint.create).toHaveBeenCalledWith({
        data: {
          name: 'Minimal Endpoint',
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
        },
      });
    });

    it('should handle audit log creation failures gracefully', async () => {
      mockPrisma.endpoint.create.mockResolvedValue(createdEndpoint);
      mockPrisma.auditLog.create.mockRejectedValue(new Error('Audit failed'));

      const response = await request
        .post('/api/endpoints')
        .set(authHeaders())
        .send(validEndpointData)
        .expect(201);

      // Should still succeed even if audit log fails
      expect(response.body).toEqual({
        ...createdEndpoint,
        createdAt: createdEndpoint.createdAt.toISOString(),
        updatedAt: createdEndpoint.updatedAt.toISOString(),
      });
    });
  });

  describe('PATCH /api/endpoints/:id', () => {
    const existingEndpoint = generateTestData.endpoint();
    const updateData = {
      name: 'Updated Endpoint',
      limits: {
        maxConnections: 200,
      },
    };

    it('should update endpoint successfully', async () => {
      mockPrisma.endpoint.findUnique.mockResolvedValue(existingEndpoint);
      mockPrisma.endpoint.update.mockResolvedValue({ ...existingEndpoint, ...updateData });
      mockPrisma.auditLog.create.mockResolvedValue({});

      const response = await request
        .patch('/api/endpoints/endpoint-123')
        .set(authHeaders())
        .send(updateData)
        .expect(200);

      const updatedEndpoint = { ...existingEndpoint, ...updateData };
      expect(response.body).toEqual({
        ...updatedEndpoint,
        createdAt: updatedEndpoint.createdAt.toISOString(),
        updatedAt: updatedEndpoint.updatedAt.toISOString(),
      });

      expect(mockPrisma.endpoint.findUnique).toHaveBeenCalledWith({
        where: { id: 'endpoint-123' },
      });

      expect(mockPrisma.endpoint.update).toHaveBeenCalledWith({
        where: { id: 'endpoint-123' },
        data: {
          name: 'Updated Endpoint',
          limits: {
            maxConnections: 200,
            maxMessageSize: 1048576,  // Default value applied by Zod
            timeoutMs: 30000,         // Default value applied by Zod
          },
        },
      });

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          action: 'UPDATE_ENDPOINT',
          entityType: 'ENDPOINT',
          entityId: 'endpoint-123',
          details: {
            changes: updateData,
            userId: 'user-123',
          },
        },
      });
    });

    it('should return 404 for non-existent endpoint', async () => {
      mockPrisma.endpoint.findUnique.mockResolvedValue(null);

      const response = await request
        .patch('/api/endpoints/non-existent')
        .set(authHeaders())
        .send(updateData)
        .expect(404);

      expect(response.body).toEqual({ error: 'Endpoint not found' });
      expect(mockPrisma.endpoint.update).not.toHaveBeenCalled();
    });

    it('should validate partial update data', async () => {
      const response = await request
        .patch('/api/endpoints/endpoint-123')
        .set(authHeaders())
        .send({ targetUrl: 'invalid-url' })
        .expect(400);

      expect(response.body).toEqual({
        error: 'Invalid request data',
        details: expect.any(Array),
      });
    });

    it('should handle database update errors', async () => {
      mockPrisma.endpoint.findUnique.mockResolvedValue(existingEndpoint);
      mockPrisma.endpoint.update.mockRejectedValue(new Error('Update failed'));

      const response = await request
        .patch('/api/endpoints/endpoint-123')
        .set(authHeaders())
        .send(updateData)
        .expect(500);

      expect(response.body).toEqual({ error: 'Failed to update endpoint' });
    });
  });

  describe('DELETE /api/endpoints/:id', () => {
    const existingEndpoint = generateTestData.endpoint();

    it('should delete endpoint successfully', async () => {
      mockPrisma.endpoint.findUnique.mockResolvedValue(existingEndpoint);
      mockPrisma.endpoint.delete.mockResolvedValue(existingEndpoint);
      mockPrisma.auditLog.create.mockResolvedValue({});

      await request
        .delete('/api/endpoints/endpoint-123')
        .set(authHeaders())
        .expect(204);

      expect(mockPrisma.endpoint.findUnique).toHaveBeenCalledWith({
        where: { id: 'endpoint-123' },
      });

      expect(mockPrisma.endpoint.delete).toHaveBeenCalledWith({
        where: { id: 'endpoint-123' },
      });

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          action: 'DELETE_ENDPOINT',
          entityType: 'ENDPOINT',
          entityId: 'endpoint-123',
          details: {
            name: existingEndpoint.name,
            targetUrl: existingEndpoint.targetUrl,
            userId: 'user-123',
          },
        },
      });
    });

    it('should return 404 for non-existent endpoint', async () => {
      mockPrisma.endpoint.findUnique.mockResolvedValue(null);

      const response = await request
        .delete('/api/endpoints/non-existent')
        .set(authHeaders())
        .expect(404);

      expect(response.body).toEqual({ error: 'Endpoint not found' });
      expect(mockPrisma.endpoint.delete).not.toHaveBeenCalled();
    });

    it('should handle database deletion errors', async () => {
      mockPrisma.endpoint.findUnique.mockResolvedValue(existingEndpoint);
      mockPrisma.endpoint.delete.mockRejectedValue(new Error('Deletion failed'));

      const response = await request
        .delete('/api/endpoints/endpoint-123')
        .set(authHeaders())
        .expect(500);

      expect(response.body).toEqual({ error: 'Failed to delete endpoint' });
    });
  });

  describe('Authentication and Authorization', () => {
    it('should require authentication for all endpoints', async () => {
      const { authenticateToken, requireAdmin } = await import('../../middleware/auth');
      
      await request.get('/api/endpoints').set(authHeaders());
      await request.get('/api/endpoints/123').set(authHeaders());
      await request.post('/api/endpoints').set(authHeaders());
      await request.patch('/api/endpoints/123').set(authHeaders());
      await request.delete('/api/endpoints/123').set(authHeaders());
      
      expect(authenticateToken).toHaveBeenCalledTimes(5);
      expect(requireAdmin).toHaveBeenCalledTimes(5);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON gracefully', async () => {
      const response = await request
        .post('/api/endpoints')
        .set(authHeaders())
        .set('Content-Type', 'application/json')
        .send('invalid-json{')
        .expect(400);

      // Express should handle malformed JSON and return 400
      expect(response.status).toBe(400);
    });

    it('should handle very large payloads', async () => {
      const largePayload = {
        name: 'Test',
        targetUrl: 'wss://example.com/ws',
        description: 'a'.repeat(100000), // Very large string
      };

      // This would normally be handled by express body size limits
      const response = await request
        .post('/api/endpoints')
        .set(authHeaders())
        .send(largePayload);

      // Should either succeed or fail gracefully
      expect([200, 201, 400, 413]).toContain(response.status);
    });

    it('should handle concurrent requests properly', async () => {
      mockPrisma.endpoint.findMany.mockResolvedValue([]);
      mockPrisma.endpoint.count.mockResolvedValue(0);

      // Make multiple concurrent requests
      const promises = Array.from({ length: 5 }, () =>
        request.get('/api/endpoints').set(authHeaders())
      );

      const responses = await Promise.all(promises);

      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });
  });
});