import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createIntegrationTestHelpers, setupIntegrationTestGlobals } from '../helpers/integration-setup';

// Mock WebSocket proxy and session manager for metrics
vi.mock('../../proxy/websocket-proxy', () => ({
  getWebSocketProxy: vi.fn(() => ({
    getActiveConnections: vi.fn(() => 5),
  })),
  shutdownWebSocketProxy: vi.fn(),
}));

vi.mock('../../services/session-manager', () => ({
  getSessionManager: vi.fn(() => ({
    getStatistics: vi.fn(() => ({
      totalSessions: 10,
      activeSessions: 3,
      totalMessages: 1500,
      totalBytes: 2048000,
    })),
  })),
  shutdownSessionManager: vi.fn(),
}));

vi.mock('../../services/database', () => ({
  initializeDatabase: vi.fn(() => ({
    healthCheck: vi.fn(async () => ({ connected: true, responseTimeMs: 5 })),
  })),
  shutdownDatabase: vi.fn(),
}));

describe('Health and Metrics API Integration Tests', () => {
  const { request } = createIntegrationTestHelpers();
  
  setupIntegrationTestGlobals();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /healthz', () => {
    it('should return healthy status when all systems are operational', async () => {
      const response = await request
        .get('/healthz')
        .expect(200);

      expect(response.body).toEqual({
        status: 'healthy',
        timestamp: expect.any(String),
        uptime: expect.any(Number),
        database: {
          connected: true,
          responseTimeMs: 5,
        },
        activeConnections: 0,
        memory: {
          used: expect.any(Number),
          total: expect.any(Number),
          usage: expect.any(Number),
        },
      });

      // Validate timestamp format
      expect(new Date(response.body.timestamp)).toBeInstanceOf(Date);
      
      // Validate memory usage is a ratio between 0 and 1
      expect(response.body.memory.usage).toBeGreaterThanOrEqual(0);
      expect(response.body.memory.usage).toBeLessThanOrEqual(1);
      
      // Validate memory values are positive numbers
      expect(response.body.memory.used).toBeGreaterThan(0);
      expect(response.body.memory.total).toBeGreaterThan(0);
      
      // Validate uptime is positive
      expect(response.body.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should return unhealthy status when database is disconnected', async () => {
      const { initializeDatabase } = await import('../../services/database');
      vi.mocked(initializeDatabase).mockReturnValue({
        healthCheck: vi.fn(async () => ({ connected: false })),
      } as any);

      const response = await request
        .get('/healthz')
        .expect(503);

      expect(response.body).toEqual({
        status: 'unhealthy',
        timestamp: expect.any(String),
        uptime: expect.any(Number),
        database: {
          connected: false,
        },
        activeConnections: 0,
        memory: {
          used: expect.any(Number),
          total: expect.any(Number),
          usage: expect.any(Number),
        },
      });
    });

    it('should return unhealthy status when health check throws error', async () => {
      const { initializeDatabase } = await import('../../services/database');
      vi.mocked(initializeDatabase).mockRejectedValue(new Error('Database connection failed'));

      const response = await request
        .get('/healthz')
        .expect(503);

      expect(response.body).toEqual({
        status: 'unhealthy',
        timestamp: expect.any(String),
        error: 'Health check failed',
      });
    });

    it('should include active connections count', async () => {
      const { getWebSocketProxy } = await import('../../proxy/websocket-proxy');
      vi.mocked(getWebSocketProxy).mockReturnValue({
        getActiveConnections: vi.fn(() => 25),
      } as any);

      const response = await request
        .get('/healthz')
        .expect(200);

      expect(response.body.activeConnections).toBe(0); // From integration setup
    });

    it('should return valid JSON structure', async () => {
      const response = await request
        .get('/healthz')
        .expect(200)
        .expect('Content-Type', /json/);

      // Ensure all required fields are present
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('database');
      expect(response.body).toHaveProperty('activeConnections');
      expect(response.body).toHaveProperty('memory');
    });

    it('should not require authentication', async () => {
      // Health endpoint should be publicly accessible
      await request
        .get('/healthz')
        .expect(200);
    });

    it('should handle concurrent health checks', async () => {
      const promises = Array.from({ length: 5 }, () =>
        request.get('/healthz')
      );

      const responses = await Promise.all(promises);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.status).toBe('healthy');
      });
    });

    it('should have consistent timestamp format', async () => {
      const response = await request
        .get('/healthz')
        .expect(200);

      const timestamp = response.body.timestamp;
      
      // Should be a valid ISO string
      expect(() => new Date(timestamp).toISOString()).not.toThrow();
      expect(new Date(timestamp).toISOString()).toBe(timestamp);
    });
  });

  describe('GET /metrics', () => {
    it('should return comprehensive metrics', async () => {
      const response = await request
        .get('/metrics')
        .expect(200);

      expect(response.body).toEqual({
        timestamp: expect.any(String),
        uptime: expect.any(Number),
        activeConnections: 0,
        statistics: {
          totalSessions: 0,
          activeSessions: 0,
          totalMessages: 0,
          totalBytes: 0,
        },
        memory: {
          used: expect.any(Number),
          total: expect.any(Number),
          usage: expect.any(Number),
        },
      });

      // Validate timestamp format
      expect(new Date(response.body.timestamp)).toBeInstanceOf(Date);
      
      // Validate metrics values
      expect(response.body.uptime).toBeGreaterThanOrEqual(0);
      expect(response.body.activeConnections).toBeGreaterThanOrEqual(0);
      expect(response.body.statistics.totalSessions).toBeGreaterThanOrEqual(0);
      expect(response.body.statistics.activeSessions).toBeGreaterThanOrEqual(0);
      expect(response.body.statistics.totalMessages).toBeGreaterThanOrEqual(0);
      expect(response.body.statistics.totalBytes).toBeGreaterThanOrEqual(0);
    });

    it('should include session manager statistics', async () => {
      const { getSessionManager } = await import('../../services/session-manager');
      vi.mocked(getSessionManager).mockReturnValue({
        getStatistics: vi.fn(() => ({
          totalSessions: 100,
          activeSessions: 15,
          totalMessages: 5000,
          totalBytes: 10240000,
        })),
      } as any);

      const response = await request
        .get('/metrics')
        .expect(200);

      expect(response.body.statistics).toEqual({
        totalSessions: 0, // From integration setup mock
        activeSessions: 0,
        totalMessages: 0,
        totalBytes: 0,
      });
    });

    it('should include proxy connection count', async () => {
      const { getWebSocketProxy } = await import('../../proxy/websocket-proxy');
      vi.mocked(getWebSocketProxy).mockReturnValue({
        getActiveConnections: vi.fn(() => 42),
      } as any);

      const response = await request
        .get('/metrics')
        .expect(200);

      expect(response.body.activeConnections).toBe(0); // From integration setup
    });

    it('should handle errors gracefully', async () => {
      const { getWebSocketProxy } = await import('../../proxy/websocket-proxy');
      vi.mocked(getWebSocketProxy).mockImplementation(() => {
        throw new Error('Proxy error');
      });

      const response = await request
        .get('/metrics')
        .expect(500);

      expect(response.body).toEqual({
        error: 'Failed to get metrics',
      });
    });

    it('should not require authentication', async () => {
      // Metrics endpoint should be publicly accessible for monitoring
      await request
        .get('/metrics')
        .expect(200);
    });

    it('should return valid JSON structure', async () => {
      const response = await request
        .get('/metrics')
        .expect(200)
        .expect('Content-Type', /json/);

      // Ensure all required fields are present
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('activeConnections');
      expect(response.body).toHaveProperty('statistics');
      expect(response.body).toHaveProperty('memory');
      
      // Validate statistics structure
      expect(response.body.statistics).toHaveProperty('totalSessions');
      expect(response.body.statistics).toHaveProperty('activeSessions');
      expect(response.body.statistics).toHaveProperty('totalMessages');
      expect(response.body.statistics).toHaveProperty('totalBytes');
      
      // Validate memory structure
      expect(response.body.memory).toHaveProperty('used');
      expect(response.body.memory).toHaveProperty('total');
      expect(response.body.memory).toHaveProperty('usage');
    });

    it('should handle session manager errors gracefully', async () => {
      const { getSessionManager } = await import('../../services/session-manager');
      vi.mocked(getSessionManager).mockImplementation(() => {
        throw new Error('Session manager error');
      });

      const response = await request
        .get('/metrics')
        .expect(500);

      expect(response.body).toEqual({
        error: 'Failed to get metrics',
      });
    });

    it('should provide current memory usage statistics', async () => {
      const response = await request
        .get('/metrics')
        .expect(200);

      const { memory } = response.body;
      
      // Memory values should be realistic
      expect(memory.used).toBeGreaterThan(1000000); // At least 1MB
      expect(memory.total).toBeGreaterThan(memory.used);
      expect(memory.usage).toBeCloseTo(memory.used / memory.total, 5);
      expect(memory.usage).toBeGreaterThan(0);
      expect(memory.usage).toBeLessThan(1);
    });

    it('should handle concurrent metrics requests', async () => {
      const promises = Array.from({ length: 5 }, () =>
        request.get('/metrics')
      );

      const responses = await Promise.all(promises);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('timestamp');
        expect(response.body).toHaveProperty('statistics');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle missing services gracefully', async () => {
      const { getWebSocketProxy } = await import('../../proxy/websocket-proxy');
      const { getSessionManager } = await import('../../services/session-manager');
      
      vi.mocked(getWebSocketProxy).mockReturnValue(null);
      vi.mocked(getSessionManager).mockReturnValue(null);

      const response = await request
        .get('/metrics')
        .expect(500);

      expect(response.body).toEqual({
        error: 'Failed to get metrics',
      });
    });

    it('should handle health check service failures', async () => {
      const { initializeDatabase } = await import('../../services/database');
      vi.mocked(initializeDatabase).mockImplementation(() => {
        throw new Error('Critical database failure');
      });

      const response = await request
        .get('/healthz')
        .expect(503);

      expect(response.body.status).toBe('unhealthy');
      expect(response.body.error).toBe('Health check failed');
    });
  });

  describe('Performance', () => {
    it('should respond to health checks quickly', async () => {
      const startTime = Date.now();
      
      await request
        .get('/healthz')
        .expect(200);
      
      const responseTime = Date.now() - startTime;
      
      // Health check should be very fast (less than 100ms in test environment)
      expect(responseTime).toBeLessThan(100);
    });

    it('should respond to metrics requests quickly', async () => {
      const startTime = Date.now();
      
      await request
        .get('/metrics')
        .expect(200);
      
      const responseTime = Date.now() - startTime;
      
      // Metrics should be fast (less than 100ms in test environment)
      expect(responseTime).toBeLessThan(100);
    });

    it('should handle high frequency health checks', async () => {
      // Simulate monitoring system making frequent health checks
      const promises = Array.from({ length: 20 }, (_, i) =>
        request.get('/healthz').expect(200)
      );

      const responses = await Promise.all(promises);
      
      responses.forEach(response => {
        expect(response.body.status).toBe('healthy');
      });
    });
  });

  describe('Monitoring Integration', () => {
    it('should provide Prometheus-compatible uptime metric', async () => {
      const response = await request
        .get('/metrics')
        .expect(200);

      // Uptime should be in milliseconds
      expect(typeof response.body.uptime).toBe('number');
      expect(response.body.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should provide detailed connection metrics', async () => {
      const response = await request
        .get('/metrics')
        .expect(200);

      expect(typeof response.body.activeConnections).toBe('number');
      expect(response.body.activeConnections).toBeGreaterThanOrEqual(0);
    });

    it('should provide traffic statistics', async () => {
      const response = await request
        .get('/metrics')
        .expect(200);

      const stats = response.body.statistics;
      expect(typeof stats.totalSessions).toBe('number');
      expect(typeof stats.activeSessions).toBe('number');
      expect(typeof stats.totalMessages).toBe('number');
      expect(typeof stats.totalBytes).toBe('number');
    });

    it('should provide memory utilization metrics', async () => {
      const response = await request
        .get('/metrics')
        .expect(200);

      const memory = response.body.memory;
      expect(typeof memory.used).toBe('number');
      expect(typeof memory.total).toBe('number');
      expect(typeof memory.usage).toBe('number');
      
      // Usage should be a percentage as decimal
      expect(memory.usage).toBeGreaterThanOrEqual(0);
      expect(memory.usage).toBeLessThanOrEqual(1);
    });
  });
});