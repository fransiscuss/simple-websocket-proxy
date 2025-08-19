import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { generateTestData, generateTestJWT } from '../helpers/test-setup';

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

// Mock dependencies
vi.mock('../../utils/logger', () => ({
  createLogger: () => ({
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Mock auth middleware to allow authenticated requests
vi.mock('../../middleware/auth', () => ({
  authenticateToken: vi.fn((req, res, next) => {
    req.user = { userId: 'user-123', email: 'test@example.com', role: 'ADMIN' };
    next();
  }),
  requireAdmin: vi.fn((req, res, next) => next()),
}));

// Create test application
const createTestApp = (router: any) => {
  const app = express();
  app.use(express.json());
  app.use('/api/endpoints', router);
  return app;
};

// Helper to create authenticated headers
const createAuthHeaders = () => {
  const token = generateTestJWT();
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
};

describe('Endpoints Routes', () => {
  let app: express.Application;
  let mockPrisma: any;
  
  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Get the mocked prisma instance
    const { prisma } = await import('../../services/database');
    mockPrisma = vi.mocked(prisma);
    
    // Import and create app after mocks are set up
    const { endpointsRouter } = await import('../../routes/endpoints');
    app = createTestApp(endpointsRouter);
  });

  describe('GET /', () => {
    const testEndpoints = [
      generateTestData.endpoint({ id: 'endpoint-1', name: 'Endpoint 1' }),
      generateTestData.endpoint({ id: 'endpoint-2', name: 'Endpoint 2' }),
    ];

    it('should get endpoints with default pagination', async () => {
      mockPrisma.endpoint.findMany.mockResolvedValue(testEndpoints);
      mockPrisma.endpoint.count.mockResolvedValue(2);

      const response = await request(app)
        .get('/api/endpoints')
        .set(createAuthHeaders())
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
      expect(mockPrisma.endpoint.count).toHaveBeenCalledWith({ where: {} });
    });

    it('should handle pagination parameters', async () => {
      mockPrisma.endpoint.findMany.mockResolvedValue([testEndpoints[0]]);
      mockPrisma.endpoint.count.mockResolvedValue(25);

      const response = await request(app)
        .get('/api/endpoints?page=3&limit=5')
        .set(createAuthHeaders())
        .expect(200);

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

      expect(response.body.pagination).toEqual({
        page: 3,
        limit: 5,
        total: 25,
        totalPages: 5,
        hasNext: true,
        hasPrev: true,
      });
    });

    it('should handle search parameter', async () => {
      mockPrisma.endpoint.findMany.mockResolvedValue([testEndpoints[0]]);
      mockPrisma.endpoint.count.mockResolvedValue(1);

      await request(app)
        .get('/api/endpoints?search=test%20search')
        .set(createAuthHeaders())
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

      await request(app)
        .get('/api/endpoints?enabled=true')
        .set(createAuthHeaders())
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

      const response = await request(app)
        .get('/api/endpoints')
        .set(createAuthHeaders())
        .expect(500);

      expect(response.body).toEqual({ error: 'Failed to fetch endpoints' });
    });

    it('should sanitize pagination parameters', async () => {
      mockPrisma.endpoint.findMany.mockResolvedValue([]);
      mockPrisma.endpoint.count.mockResolvedValue(0);

      await request(app)
        .get('/api/endpoints?page=0&limit=200') // Invalid values
        .set(createAuthHeaders())
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
  });

  describe('GET /:id', () => {
    const testEndpoint = generateTestData.endpoint();

    it('should get endpoint by id successfully', async () => {
      mockPrisma.endpoint.findUnique.mockResolvedValue(testEndpoint);

      const response = await request(app)
        .get('/api/endpoints/endpoint-123')
        .set(createAuthHeaders())
        .expect(200);

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

      expect(response.body).toEqual({
        ...testEndpoint,
        createdAt: testEndpoint.createdAt.toISOString(),
        updatedAt: testEndpoint.updatedAt.toISOString(),
      });
    });

    it('should return 404 for non-existent endpoint', async () => {
      mockPrisma.endpoint.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/endpoints/non-existent')
        .set(createAuthHeaders())
        .expect(404);

      expect(response.body).toEqual({ error: 'Endpoint not found' });
    });

    it('should handle database errors', async () => {
      mockPrisma.endpoint.findUnique.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/endpoints/endpoint-123')
        .set(createAuthHeaders())
        .expect(500);

      expect(response.body).toEqual({ error: 'Failed to fetch endpoint' });
    });
  });

  describe('POST /', () => {
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

      const response = await request(app)
        .post('/api/endpoints')
        .set(createAuthHeaders())
        .send(validEndpointData)
        .expect(201);

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

      expect(response.body).toEqual({
        ...createdEndpoint,
        createdAt: createdEndpoint.createdAt.toISOString(),
        updatedAt: createdEndpoint.updatedAt.toISOString(),
      });
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/endpoints')
        .set(createAuthHeaders())
        .send({ name: 'Test' }) // Missing targetUrl
        .expect(400);

      expect(response.body).toEqual({
        error: 'Invalid request data',
        details: expect.any(Array),
      });
      expect(mockPrisma.endpoint.create).not.toHaveBeenCalled();
    });

    it('should validate URL format', async () => {
      const response = await request(app)
        .post('/api/endpoints')
        .set(createAuthHeaders())
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
      const response = await request(app)
        .post('/api/endpoints')
        .set(createAuthHeaders())
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

      const response = await request(app)
        .post('/api/endpoints')
        .set(createAuthHeaders())
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

      await request(app)
        .post('/api/endpoints')
        .set(createAuthHeaders())
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
  });

  describe('PATCH /:id', () => {
    const existingEndpoint = generateTestData.endpoint();
    const updateData = {
      name: 'Updated Endpoint',
      enabled: false,
    };
    const updatedEndpoint = { ...existingEndpoint, ...updateData };

    it('should update endpoint successfully', async () => {
      mockPrisma.endpoint.findUnique.mockResolvedValue(existingEndpoint);
      mockPrisma.endpoint.update.mockResolvedValue(updatedEndpoint);
      mockPrisma.auditLog.create.mockResolvedValue({});

      const response = await request(app)
        .patch('/api/endpoints/endpoint-123')
        .set(createAuthHeaders())
        .send(updateData)
        .expect(200);

      expect(mockPrisma.endpoint.update).toHaveBeenCalledWith({
        where: { id: 'endpoint-123' },
        data: updateData,
      });

      expect(response.body).toEqual({
        ...updatedEndpoint,
        createdAt: updatedEndpoint.createdAt.toISOString(),
        updatedAt: updatedEndpoint.updatedAt.toISOString(),
      });
    });

    it('should return 404 for non-existent endpoint', async () => {
      mockPrisma.endpoint.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .patch('/api/endpoints/non-existent')
        .set(createAuthHeaders())
        .send(updateData)
        .expect(404);

      expect(response.body).toEqual({ error: 'Endpoint not found' });
    });

    it('should validate partial update data', async () => {
      const response = await request(app)
        .patch('/api/endpoints/endpoint-123')
        .set(createAuthHeaders())
        .send({ targetUrl: 'invalid-url' })
        .expect(400);

      expect(response.body).toEqual({
        error: 'Invalid request data',
        details: expect.any(Array),
      });
    });
  });

  describe('DELETE /:id', () => {
    const existingEndpoint = generateTestData.endpoint();

    it('should delete endpoint successfully', async () => {
      mockPrisma.endpoint.findUnique.mockResolvedValue(existingEndpoint);
      mockPrisma.endpoint.delete.mockResolvedValue(existingEndpoint);
      mockPrisma.auditLog.create.mockResolvedValue({});

      await request(app)
        .delete('/api/endpoints/endpoint-123')
        .set(createAuthHeaders())
        .expect(204);

      expect(mockPrisma.endpoint.delete).toHaveBeenCalledWith({
        where: { id: 'endpoint-123' },
      });
    });

    it('should return 404 for non-existent endpoint', async () => {
      mockPrisma.endpoint.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .delete('/api/endpoints/non-existent')
        .set(createAuthHeaders())
        .expect(404);

      expect(response.body).toEqual({ error: 'Endpoint not found' });
    });

    it('should handle database deletion errors', async () => {
      mockPrisma.endpoint.findUnique.mockResolvedValue(existingEndpoint);
      mockPrisma.endpoint.delete.mockRejectedValue(new Error('Deletion failed'));

      const response = await request(app)
        .delete('/api/endpoints/endpoint-123')
        .set(createAuthHeaders())
        .expect(500);

      expect(response.body).toEqual({ error: 'Failed to delete endpoint' });
    });
  });

  describe('Authentication and Authorization', () => {
    it('should use authentication middleware', async () => {
      const { authenticateToken } = await import('../../middleware/auth');

      await request(app)
        .get('/api/endpoints')
        .set(createAuthHeaders())
        .expect(200);

      expect(authenticateToken).toHaveBeenCalled();
    });

    it('should require admin role', async () => {
      const { requireAdmin } = await import('../../middleware/auth');

      await request(app)
        .get('/api/endpoints')
        .set(createAuthHeaders())
        .expect(200);

      expect(requireAdmin).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle unexpected validation errors', async () => {
      const response = await request(app)
        .post('/api/endpoints')
        .set(createAuthHeaders())
        .send({ invalid: 'data' })
        .expect(400);

      expect(response.body).toEqual({
        error: 'Invalid request data',
        details: expect.any(Array),
      });
    });

    it('should handle audit log creation failures gracefully', async () => {
      const validData = {
        name: 'Test Endpoint',
        targetUrl: 'wss://example.com/ws',
      };
      
      const createdEndpoint = generateTestData.endpoint();
      mockPrisma.endpoint.create.mockResolvedValue(createdEndpoint);
      mockPrisma.auditLog.create.mockRejectedValue(new Error('Audit failed'));

      // Should still return success even if audit log fails
      const response = await request(app)
        .post('/api/endpoints')
        .set(createAuthHeaders())
        .send(validData)
        .expect(201);

      expect(response.body).toEqual({
        ...createdEndpoint,
        createdAt: createdEndpoint.createdAt.toISOString(),
        updatedAt: createdEndpoint.updatedAt.toISOString(),
      });
    });
  });
});