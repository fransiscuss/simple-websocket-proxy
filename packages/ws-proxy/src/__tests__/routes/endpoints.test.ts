import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Router } from 'express';
import { endpointsRouter } from '../../routes/endpoints';
import { createMockPrismaClient } from '../mocks/prisma';
import { createAuthenticatedRequest, createMockResponse, createMockNext } from '../mocks/express';
import { generateTestData } from '../helpers/test-setup';

// Mock prisma first
const mockPrisma = createMockPrismaClient();
vi.mock('../../services/database', () => ({
  prisma: mockPrisma,
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

// Mock auth middleware
vi.mock('../../middleware/auth', () => ({
  authenticateToken: vi.fn((req, res, next) => next()),
  requireAdmin: vi.fn((req, res, next) => next()),
}));

// Global setup for router mock
const routes = [];
const middlewares = [];

const mockRouterInstance = {
  post: vi.fn((path, handler) => routes.push({ method: 'POST', path, handler })),
  get: vi.fn((path, handler) => routes.push({ method: 'GET', path, handler })),
  put: vi.fn((path, handler) => routes.push({ method: 'PUT', path, handler })),
  delete: vi.fn((path, handler) => routes.push({ method: 'DELETE', path, handler })),
  patch: vi.fn((path, handler) => routes.push({ method: 'PATCH', path, handler })),
  use: vi.fn((middleware) => middlewares.push(middleware)),
};

// Mock express Router to return our mock instance
vi.mock('express', () => ({
  Router: vi.fn(() => mockRouterInstance),
}));

// Helper to simulate route execution
const executeRoute = async (method: string, path: string, reqOverrides: any = {}) => {
  // Clear previous routes
  routes.length = 0;
  middlewares.length = 0;
  
  // Re-import to get the router with mocked Router  
  const { endpointsRouter: testRouter } = await import('../../routes/endpoints');
  
  // Find the matching route
  const route = routes.find(r => r.method === method && r.path === path);
  if (!route) {
    throw new Error(`Route ${method} ${path} not found`);
  }

  // Create mock request and response
  const req = {
    ...createAuthenticatedRequest(),
    ...reqOverrides,
  };

  const res = createMockResponse();

  // Execute the route handler
  await route.handler(req, res);
  
  return { req, res, middlewares };
};

describe('Endpoints Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /', () => {
    const testEndpoints = [
      generateTestData.endpoint({ id: 'endpoint-1', name: 'Endpoint 1' }),
      generateTestData.endpoint({ id: 'endpoint-2', name: 'Endpoint 2' }),
    ];

    it('should get endpoints with default pagination', async () => {
      mockPrisma.endpoint.findMany.mockResolvedValue(testEndpoints);
      mockPrisma.endpoint.count.mockResolvedValue(2);

      const { res } = await executeRoute('GET', '/');

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

      expect(res.json).toHaveBeenCalledWith({
        endpoints: testEndpoints,
        pagination: {
          page: 1,
          limit: 10,
          total: 2,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      });
    });

    it('should handle pagination parameters', async () => {
      mockPrisma.endpoint.findMany.mockResolvedValue([testEndpoints[0]]);
      mockPrisma.endpoint.count.mockResolvedValue(25);

      const { res } = await executeRoute('GET', '/', {
        query: { page: '3', limit: '5' },
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

      expect(res.json).toHaveBeenCalledWith({
        endpoints: [testEndpoints[0]],
        pagination: {
          page: 3,
          limit: 5,
          total: 25,
          totalPages: 5,
          hasNext: true,
          hasPrev: true,
        },
      });
    });

    it('should handle search parameter', async () => {
      mockPrisma.endpoint.findMany.mockResolvedValue([testEndpoints[0]]);
      mockPrisma.endpoint.count.mockResolvedValue(1);

      const { res } = await executeRoute('GET', '/', {
        query: { search: 'test search' },
      });

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

      const { res } = await executeRoute('GET', '/', {
        query: { enabled: 'true' },
      });

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

      const { res } = await executeRoute('GET', '/');

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Failed to fetch endpoints' });
    });

    it('should sanitize pagination parameters', async () => {
      mockPrisma.endpoint.findMany.mockResolvedValue([]);
      mockPrisma.endpoint.count.mockResolvedValue(0);

      const { res } = await executeRoute('GET', '/', {
        query: { page: '0', limit: '200' }, // Invalid values
      });

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

      const { res } = await executeRoute('GET', '/:id', {
        params: { id: 'endpoint-123' },
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

      expect(res.json).toHaveBeenCalledWith(testEndpoint);
    });

    it('should return 404 for non-existent endpoint', async () => {
      mockPrisma.endpoint.findUnique.mockResolvedValue(null);

      const { res } = await executeRoute('GET', '/:id', {
        params: { id: 'non-existent' },
      });

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Endpoint not found' });
    });

    it('should handle database errors', async () => {
      mockPrisma.endpoint.findUnique.mockRejectedValue(new Error('Database error'));

      const { res } = await executeRoute('GET', '/:id', {
        params: { id: 'endpoint-123' },
      });

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Failed to fetch endpoint' });
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

      const { res } = await executeRoute('POST', '/', {
        body: validEndpointData,
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

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(createdEndpoint);
    });

    it('should validate required fields', async () => {
      const { res } = await executeRoute('POST', '/', {
        body: { name: 'Test' }, // Missing targetUrl
      });

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid request data',
        details: expect.any(Array),
      });
      expect(mockPrisma.endpoint.create).not.toHaveBeenCalled();
    });

    it('should validate URL format', async () => {
      const { res } = await executeRoute('POST', '/', {
        body: {
          name: 'Test Endpoint',
          targetUrl: 'invalid-url',
        },
      });

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid request data',
        details: expect.any(Array),
      });
    });

    it('should validate limits constraints', async () => {
      const { res } = await executeRoute('POST', '/', {
        body: {
          name: 'Test Endpoint',
          targetUrl: 'wss://example.com/ws',
          limits: {
            maxConnections: 20000, // Too high
            maxMessageSize: 500, // Too low
          },
        },
      });

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid request data',
        details: expect.any(Array),
      });
    });

    it('should handle database creation errors', async () => {
      mockPrisma.endpoint.create.mockRejectedValue(new Error('Creation failed'));

      const { res } = await executeRoute('POST', '/', {
        body: validEndpointData,
      });

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Failed to create endpoint' });
    });

    it('should use default values for optional fields', async () => {
      const minimalData = {
        name: 'Minimal Endpoint',
        targetUrl: 'wss://example.com/ws',
      };

      mockPrisma.endpoint.create.mockResolvedValue(createdEndpoint);
      mockPrisma.auditLog.create.mockResolvedValue({});

      const { res } = await executeRoute('POST', '/', {
        body: minimalData,
      });

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
      limits: {
        maxConnections: 200,
      },
    };

    it('should update endpoint successfully', async () => {
      mockPrisma.endpoint.findUnique.mockResolvedValue(existingEndpoint);
      mockPrisma.endpoint.update.mockResolvedValue({ ...existingEndpoint, ...updateData });
      mockPrisma.auditLog.create.mockResolvedValue({});

      const { res } = await executeRoute('PATCH', '/:id', {
        params: { id: 'endpoint-123' },
        body: updateData,
      });

      expect(mockPrisma.endpoint.findUnique).toHaveBeenCalledWith({
        where: { id: 'endpoint-123' },
      });

      expect(mockPrisma.endpoint.update).toHaveBeenCalledWith({
        where: { id: 'endpoint-123' },
        data: updateData,
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

      expect(res.json).toHaveBeenCalledWith({ ...existingEndpoint, ...updateData });
    });

    it('should return 404 for non-existent endpoint', async () => {
      mockPrisma.endpoint.findUnique.mockResolvedValue(null);

      const { res } = await executeRoute('PATCH', '/:id', {
        params: { id: 'non-existent' },
        body: updateData,
      });

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Endpoint not found' });
      expect(mockPrisma.endpoint.update).not.toHaveBeenCalled();
    });

    it('should validate partial update data', async () => {
      const { res } = await executeRoute('PATCH', '/:id', {
        params: { id: 'endpoint-123' },
        body: { targetUrl: 'invalid-url' },
      });

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
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

      const { res } = await executeRoute('DELETE', '/:id', {
        params: { id: 'endpoint-123' },
      });

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

      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });

    it('should return 404 for non-existent endpoint', async () => {
      mockPrisma.endpoint.findUnique.mockResolvedValue(null);

      const { res } = await executeRoute('DELETE', '/:id', {
        params: { id: 'non-existent' },
      });

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Endpoint not found' });
      expect(mockPrisma.endpoint.delete).not.toHaveBeenCalled();
    });

    it('should handle database deletion errors', async () => {
      mockPrisma.endpoint.findUnique.mockResolvedValue(existingEndpoint);
      mockPrisma.endpoint.delete.mockRejectedValue(new Error('Deletion failed'));

      const { res } = await executeRoute('DELETE', '/:id', {
        params: { id: 'endpoint-123' },
      });

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Failed to delete endpoint' });
    });
  });

  describe('Authentication and Authorization', () => {
    it('should use authentication middleware', async () => {
      const { middlewares } = await executeRoute('GET', '/');
      
      // Should have authentication middlewares
      expect(middlewares).toHaveLength(2);
    });

    it('should require admin role', async () => {
      const { authenticateToken, requireAdmin } = await import('../../middleware/auth');
      
      await executeRoute('GET', '/');
      
      expect(authenticateToken).toHaveBeenCalled();
      expect(requireAdmin).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle unexpected validation errors', async () => {
      // Mock zod to throw unexpected error
      const { res } = await executeRoute('POST', '/', {
        body: 'invalid-data-type',
      });

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Failed to create endpoint' });
    });

    it('should handle audit log creation failures gracefully', async () => {
      const validEndpointData = {
        name: 'Test Endpoint',
        targetUrl: 'wss://example.com/ws',
      };

      mockPrisma.endpoint.create.mockResolvedValue(generateTestData.endpoint());
      mockPrisma.auditLog.create.mockRejectedValue(new Error('Audit failed'));

      const { res } = await executeRoute('POST', '/', {
        body: validEndpointData,
      });

      // Should still succeed even if audit log fails
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });
});