import express from 'express';
import request from 'supertest';
import { beforeEach, afterEach, vi } from 'vitest';
import { authRouter } from '../../routes/auth';
import { endpointsRouter } from '../../routes/endpoints';
import { sessionsRouter } from '../../routes/sessions';
import { auditRouter } from '../../routes/audit';
import { generateTestJWT, generateTestData } from './test-setup';

// Create a test application for integration tests
export const createTestApp = () => {
  const app = express();
  
  // Setup middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  
  // Add routes
  app.use('/auth', authRouter);
  app.use('/api/endpoints', endpointsRouter);
  app.use('/api/sessions', sessionsRouter);
  app.use('/api/audit', auditRouter);
  
  // Health endpoint
  app.get('/healthz', async (req, res) => {
    try {
      // Mock database health check for integration tests
      const healthStatus = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: 1000,
        database: { connected: true, responseTimeMs: 5 },
        activeConnections: 0,
        memory: {
          used: process.memoryUsage().heapUsed,
          total: process.memoryUsage().heapTotal,
          usage: process.memoryUsage().heapUsed / process.memoryUsage().heapTotal
        }
      };
      res.status(200).json(healthStatus);
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Health check failed'
      });
    }
  });
  
  // Metrics endpoint
  app.get('/metrics', (req, res) => {
    try {
      res.json({
        timestamp: new Date().toISOString(),
        uptime: 1000,
        activeConnections: 0,
        statistics: {
          totalSessions: 0,
          activeSessions: 0,
          totalMessages: 0,
          totalBytes: 0
        },
        memory: {
          used: process.memoryUsage().heapUsed,
          total: process.memoryUsage().heapTotal,
          usage: process.memoryUsage().heapUsed / process.memoryUsage().heapTotal
        }
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get metrics' });
    }
  });
  
  // 404 handler
  app.use('*', (req, res) => {
    res.status(404).json({ 
      error: 'Not Found',
      message: `Route ${req.method} ${req.originalUrl} not found`
    });
  });
  
  // Error handler
  app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred'
    });
  });
  
  return app;
};

// Helper to create authenticated request headers
export const createAuthHeaders = (userOverrides: any = {}) => {
  const token = generateTestJWT(userOverrides);
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
};

// Helper to create unauthenticated request headers
export const createUnAuthHeaders = () => ({
  'Content-Type': 'application/json'
});

// Setup integration test environment
export const setupIntegrationTest = () => {
  // Mock environment variables
  process.env.JWT_SECRET = 'test-jwt-secret';
  process.env.JWT_EXPIRES_IN = '1h';
  process.env.LOG_LEVEL = 'silent';
  process.env.NODE_ENV = 'test';
  
  // Clear all mocks
  vi.clearAllMocks();
};

// Helper to wait for async operations
export const waitFor = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Request helper type definitions
export interface IntegrationTestHelpers {
  app: express.Application;
  request: request.SuperTest<request.Test>;
  authHeaders: () => Record<string, string>;
  unAuthHeaders: () => Record<string, string>;
  createUser: (overrides?: any) => any;
  createEndpoint: (overrides?: any) => any;
  createSession: (overrides?: any) => any;
  createAuditLog: (overrides?: any) => any;
}

// Create integration test helpers
export const createIntegrationTestHelpers = (): IntegrationTestHelpers => {
  const app = createTestApp();
  const testRequest = request(app);
  
  return {
    app,
    request: testRequest,
    authHeaders: createAuthHeaders,
    unAuthHeaders: createUnAuthHeaders,
    createUser: generateTestData.user,
    createEndpoint: generateTestData.endpoint,
    createSession: generateTestData.session,
    createAuditLog: generateTestData.auditLog,
  };
};

// Database helpers for integration tests
export const setupTestDatabase = async () => {
  // Mock database setup for integration tests
  // In a real scenario, you'd set up a test database here
  console.log('Setting up test database...');
};

export const teardownTestDatabase = async () => {
  // Mock database teardown for integration tests
  // In a real scenario, you'd clean up the test database here
  console.log('Tearing down test database...');
};

// Global integration test setup
export const setupIntegrationTestGlobals = () => {
  beforeEach(async () => {
    setupIntegrationTest();
    await setupTestDatabase();
  });
  
  afterEach(async () => {
    await teardownTestDatabase();
    vi.clearAllMocks();
  });
};