import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SessionState, Direction } from '@prisma/client';
import { SessionManager, getSessionManager, shutdownSessionManager } from '../../services/session-manager';
import { mockDatabaseService } from '../mocks/prisma';
import { MockWebSocket } from '../mocks/websocket';
import { generateTestData } from '../helpers/test-setup';

// Mock dependencies
vi.mock('../../services/database', () => ({
  getDatabaseService: () => mockDatabaseService,
}));

vi.mock('../../utils/logger', () => ({
  loggers: {
    session: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }),
  },
  logError: vi.fn(),
  logMessage: vi.fn(),
}));

describe('SessionManager', () => {
  let sessionManager: SessionManager;
  let mockWebSocket: MockWebSocket;

  beforeEach(() => {
    vi.clearAllMocks();
    sessionManager = new SessionManager();
    mockWebSocket = new MockWebSocket();
    
    // Setup mock responses with unique session IDs
    let sessionCounter = 0;
    mockDatabaseService.createSession.mockImplementation(() => {
      sessionCounter++;
      return Promise.resolve(`session-${sessionCounter}`);
    });
    mockDatabaseService.updateSession.mockResolvedValue(undefined);
    mockDatabaseService.closeSession.mockResolvedValue(undefined);
    mockDatabaseService.getActiveConnectionCount.mockResolvedValue(5);
    mockDatabaseService.createTrafficSample.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Session Lifecycle', () => {
    it('should create session successfully', async () => {
      const endpointId = 'endpoint-123';
      
      const sessionId = await sessionManager.createSession(endpointId, mockWebSocket as any);
      
      expect(mockDatabaseService.createSession).toHaveBeenCalledWith(endpointId);
      expect(sessionId).toBe('session-1');
      
      const connection = sessionManager.getSession(sessionId);
      expect(connection).toEqual(expect.objectContaining({
        sessionId,
        endpointId,
        clientWs: mockWebSocket,
        targetWs: null,
        state: 'connecting',
        metrics: {
          msgsIn: 0,
          msgsOut: 0,
          bytesIn: 0,
          bytesOut: 0,
        },
      }));
    });

    it('should handle session creation database error', async () => {
      const error = new Error('Database error');
      mockDatabaseService.createSession.mockRejectedValue(error);
      
      await expect(
        sessionManager.createSession('endpoint-123', mockWebSocket as any)
      ).rejects.toThrow('Database error');
    });

    it('should close session successfully', async () => {
      const sessionId = await sessionManager.createSession('endpoint-123', mockWebSocket as any);
      
      await sessionManager.closeSession(sessionId, SessionState.CLOSED);
      
      expect(mockDatabaseService.updateSession).toHaveBeenCalled();
      expect(mockDatabaseService.closeSession).toHaveBeenCalledWith(sessionId, SessionState.CLOSED);
      expect(sessionManager.getSession(sessionId)).toBeUndefined();
    });

    it('should handle closing non-existent session', async () => {
      await sessionManager.closeSession('non-existent');
      
      // Should not throw error, just log warning
      expect(mockDatabaseService.closeSession).not.toHaveBeenCalled();
    });

    it('should clean up session even if database update fails', async () => {
      const sessionId = await sessionManager.createSession('endpoint-123', mockWebSocket as any);
      mockDatabaseService.updateSession.mockRejectedValue(new Error('Database error'));
      
      await sessionManager.closeSession(sessionId);
      
      expect(sessionManager.getSession(sessionId)).toBeUndefined();
    });

    it('should get session by id', async () => {
      const sessionId = await sessionManager.createSession('endpoint-123', mockWebSocket as any);
      
      const connection = sessionManager.getSession(sessionId);
      
      expect(connection?.sessionId).toBe(sessionId);
    });

    it('should return undefined for non-existent session', () => {
      const connection = sessionManager.getSession('non-existent');
      expect(connection).toBeUndefined();
    });
  });

  describe('Connection State Management', () => {
    it('should get active session count', () => {
      expect(sessionManager.getActiveSessionCount()).toBe(0);
    });

    it('should get active sessions for endpoint', async () => {
      const sessionId1 = await sessionManager.createSession('endpoint-123', mockWebSocket as any);
      const sessionId2 = await sessionManager.createSession('endpoint-123', new MockWebSocket() as any);
      await sessionManager.createSession('endpoint-456', new MockWebSocket() as any);
      
      const sessions = sessionManager.getActiveSessionsForEndpoint('endpoint-123');
      
      expect(sessions).toHaveLength(2);
      expect(sessions.map(s => s.sessionId)).toContain(sessionId1);
      expect(sessions.map(s => s.sessionId)).toContain(sessionId2);
    });

    it('should update connection state', async () => {
      const sessionId = await sessionManager.createSession('endpoint-123', mockWebSocket as any);
      
      sessionManager.updateConnectionState(sessionId, 'connected');
      
      const connection = sessionManager.getSession(sessionId);
      expect(connection?.state).toBe('connected');
      expect(connection?.lastActivity).toBeInstanceOf(Date);
    });

    it('should set target WebSocket', async () => {
      const sessionId = await sessionManager.createSession('endpoint-123', mockWebSocket as any);
      const targetWs = new MockWebSocket();
      
      sessionManager.setTargetWebSocket(sessionId, targetWs as any);
      
      const connection = sessionManager.getSession(sessionId);
      expect(connection?.targetWs).toBe(targetWs);
      expect(connection?.state).toBe('connected');
    });

    it('should handle state update for non-existent session', () => {
      sessionManager.updateConnectionState('non-existent', 'connected');
      // Should not throw error
    });
  });

  describe('Message Tracking', () => {
    it('should track inbound message', async () => {
      const sessionId = await sessionManager.createSession('endpoint-123', mockWebSocket as any);
      const content = 'test message';
      const sampling = { enabled: false };
      
      await sessionManager.trackMessage(sessionId, 'inbound', 100, 'text', content, sampling);
      
      const connection = sessionManager.getSession(sessionId);
      expect(connection?.metrics.msgsIn).toBe(1);
      expect(connection?.metrics.bytesIn).toBe(100);
      expect(connection?.metrics.msgsOut).toBe(0);
      expect(connection?.metrics.bytesOut).toBe(0);
    });

    it('should track outbound message', async () => {
      const sessionId = await sessionManager.createSession('endpoint-123', mockWebSocket as any);
      const content = Buffer.from('binary data');
      
      await sessionManager.trackMessage(sessionId, 'outbound', 256, 'binary', content);
      
      const connection = sessionManager.getSession(sessionId);
      expect(connection?.metrics.msgsOut).toBe(1);
      expect(connection?.metrics.bytesOut).toBe(256);
      expect(connection?.metrics.msgsIn).toBe(0);
      expect(connection?.metrics.bytesIn).toBe(0);
    });

    it('should handle tracking for non-existent session', async () => {
      await sessionManager.trackMessage('non-existent', 'inbound', 100, 'text');
      
      // Should not throw error, just log warning
      expect(mockDatabaseService.createTrafficSample).not.toHaveBeenCalled();
    });

    it('should sample traffic when enabled', async () => {
      const sessionId = await sessionManager.createSession('endpoint-123', mockWebSocket as any);
      const sampling = { enabled: true, sampleRate: 1.0, storeContent: true, maxSampleSize: 1024 };
      
      // Mock Math.random to always sample
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      
      await sessionManager.trackMessage(sessionId, 'inbound', 100, 'text', 'test content', sampling);
      
      expect(mockDatabaseService.createTrafficSample).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId,
          endpointId: 'endpoint-123',
          direction: Direction.INBOUND,
          sizeBytes: 100,
          content: 'test content',
        })
      );
    });

    it('should not sample when disabled', async () => {
      const sessionId = await sessionManager.createSession('endpoint-123', mockWebSocket as any);
      const sampling = { enabled: false };
      
      await sessionManager.trackMessage(sessionId, 'inbound', 100, 'text', 'test content', sampling);
      
      expect(mockDatabaseService.createTrafficSample).not.toHaveBeenCalled();
    });

    it('should truncate content when exceeding max sample size', async () => {
      const sessionId = await sessionManager.createSession('endpoint-123', mockWebSocket as any);
      const sampling = { enabled: true, sampleRate: 1.0, storeContent: true, maxSampleSize: 10 };
      const longContent = 'this is a very long message that exceeds the limit';
      
      vi.spyOn(Math, 'random').mockReturnValue(0.1);
      
      await sessionManager.trackMessage(sessionId, 'inbound', longContent.length, 'text', longContent, sampling);
      
      expect(mockDatabaseService.createTrafficSample).toHaveBeenCalledWith(
        expect.objectContaining({
          content: longContent.substring(0, 10),
        })
      );
    });

    it('should handle binary content sampling', async () => {
      const sessionId = await sessionManager.createSession('endpoint-123', mockWebSocket as any);
      const sampling = { enabled: true, sampleRate: 1.0, storeContent: true };
      const binaryContent = Buffer.from('binary data');
      
      vi.spyOn(Math, 'random').mockReturnValue(0.1);
      
      await sessionManager.trackMessage(sessionId, 'inbound', binaryContent.length, 'binary', binaryContent, sampling);
      
      expect(mockDatabaseService.createTrafficSample).toHaveBeenCalledWith(
        expect.objectContaining({
          content: binaryContent.toString('base64'),
        })
      );
    });

    it('should update database metrics periodically', async () => {
      const sessionId = await sessionManager.createSession('endpoint-123', mockWebSocket as any);
      
      // Track 10 messages to trigger database update
      for (let i = 0; i < 10; i++) {
        await sessionManager.trackMessage(sessionId, 'inbound', 100, 'text');
      }
      
      expect(mockDatabaseService.updateSession).toHaveBeenCalledWith(
        sessionId,
        expect.objectContaining({
          msgsIn: 10,
          bytesIn: BigInt(1000),
        })
      );
    });
  });

  describe('Rate Limiting', () => {
    it('should allow requests within rate limit', () => {
      const result = sessionManager.checkRateLimit('endpoint-123', 60);
      expect(result).toBe(true);
    });

    it('should allow unlimited requests when no limit set', () => {
      const result = sessionManager.checkRateLimit('endpoint-123');
      expect(result).toBe(true);
    });

    it('should block requests exceeding rate limit', () => {
      const endpointId = 'endpoint-123';
      const limitRpm = 2;
      
      // Make requests up to limit
      expect(sessionManager.checkRateLimit(endpointId, limitRpm)).toBe(true);
      expect(sessionManager.checkRateLimit(endpointId, limitRpm)).toBe(true);
      
      // Next request should be blocked
      expect(sessionManager.checkRateLimit(endpointId, limitRpm)).toBe(false);
    });

    it('should reset rate limit after window expires', () => {
      vi.useFakeTimers();
      const endpointId = 'endpoint-123';
      const limitRpm = 1;
      
      // Exhaust limit
      expect(sessionManager.checkRateLimit(endpointId, limitRpm)).toBe(true);
      expect(sessionManager.checkRateLimit(endpointId, limitRpm)).toBe(false);
      
      // Advance time past window
      vi.advanceTimersByTime(61 * 1000); // 61 seconds
      
      // Should allow requests again
      expect(sessionManager.checkRateLimit(endpointId, limitRpm)).toBe(true);
      
      vi.useRealTimers();
    });
  });

  describe('Connection Limits', () => {
    it('should allow connections within limit', async () => {
      mockDatabaseService.getActiveConnectionCount.mockResolvedValue(5);
      
      const result = await sessionManager.checkConnectionLimit('endpoint-123', 10);
      
      expect(result).toBe(true);
      expect(mockDatabaseService.getActiveConnectionCount).toHaveBeenCalledWith('endpoint-123');
    });

    it('should allow unlimited connections when no limit set', async () => {
      const result = await sessionManager.checkConnectionLimit('endpoint-123');
      expect(result).toBe(true);
    });

    it('should block connections exceeding limit', async () => {
      mockDatabaseService.getActiveConnectionCount.mockResolvedValue(10);
      
      const result = await sessionManager.checkConnectionLimit('endpoint-123', 10);
      
      expect(result).toBe(false);
    });

    it('should handle database errors gracefully', async () => {
      mockDatabaseService.getActiveConnectionCount.mockRejectedValue(new Error('Database error'));
      
      const result = await sessionManager.checkConnectionLimit('endpoint-123', 10);
      
      expect(result).toBe(false);
    });
  });

  describe('Backpressure Monitoring', () => {
    it('should detect no backpressure', async () => {
      const sessionId = await sessionManager.createSession('endpoint-123', mockWebSocket as any);
      mockWebSocket.bufferedAmount = 1000;
      
      const targetWs = new MockWebSocket();
      targetWs.bufferedAmount = 2000;
      sessionManager.setTargetWebSocket(sessionId, targetWs as any);
      
      const hasBackpressure = sessionManager.checkBackpressure(sessionId, 16 * 1024);
      
      expect(hasBackpressure).toBe(false);
    });

    it('should detect client backpressure', async () => {
      const sessionId = await sessionManager.createSession('endpoint-123', mockWebSocket as any);
      mockWebSocket.bufferedAmount = 20 * 1024; // Exceeds threshold
      
      const hasBackpressure = sessionManager.checkBackpressure(sessionId, 16 * 1024);
      
      expect(hasBackpressure).toBe(true);
    });

    it('should detect target backpressure', async () => {
      const sessionId = await sessionManager.createSession('endpoint-123', mockWebSocket as any);
      mockWebSocket.bufferedAmount = 1000;
      
      const targetWs = new MockWebSocket();
      targetWs.bufferedAmount = 20 * 1024; // Exceeds threshold
      sessionManager.setTargetWebSocket(sessionId, targetWs as any);
      
      const hasBackpressure = sessionManager.checkBackpressure(sessionId, 16 * 1024);
      
      expect(hasBackpressure).toBe(true);
    });

    it('should handle non-existent session', () => {
      const hasBackpressure = sessionManager.checkBackpressure('non-existent', 16 * 1024);
      expect(hasBackpressure).toBe(false);
    });
  });

  describe('Force Kill Session', () => {
    it('should force kill active session', async () => {
      const sessionId = await sessionManager.createSession('endpoint-123', mockWebSocket as any);
      mockWebSocket.readyState = 1; // OPEN
      
      const targetWs = new MockWebSocket();
      targetWs.readyState = 1; // OPEN
      sessionManager.setTargetWebSocket(sessionId, targetWs as any);
      
      const result = await sessionManager.killSession(sessionId);
      
      expect(result).toBe(true);
      expect(mockWebSocket.close).toHaveBeenCalledWith(1000, 'Force closed by admin');
      expect(targetWs.close).toHaveBeenCalledWith(1000, 'Force closed by admin');
      expect(mockDatabaseService.closeSession).toHaveBeenCalledWith(sessionId, SessionState.FAILED);
    });

    it('should handle killing non-existent session', async () => {
      const result = await sessionManager.killSession('non-existent');
      expect(result).toBe(false);
    });

    it('should handle force kill errors', async () => {
      const sessionId = await sessionManager.createSession('endpoint-123', mockWebSocket as any);
      mockWebSocket.close.mockImplementation(() => {
        throw new Error('Close failed');
      });
      
      const result = await sessionManager.killSession(sessionId);
      
      expect(result).toBe(false);
    });
  });

  describe('Statistics', () => {
    it('should return empty statistics', () => {
      const stats = sessionManager.getStatistics();
      
      expect(stats).toEqual({
        activeConnections: 0,
        totalSessions: 0,
        endpointStats: {},
      });
    });

    it('should return statistics with active sessions', async () => {
      const sessionId1 = await sessionManager.createSession('endpoint-123', mockWebSocket as any);
      const sessionId2 = await sessionManager.createSession('endpoint-456', new MockWebSocket() as any);
      
      // Add some metrics
      await sessionManager.trackMessage(sessionId1, 'inbound', 100, 'text');
      await sessionManager.trackMessage(sessionId1, 'outbound', 200, 'text');
      await sessionManager.trackMessage(sessionId2, 'inbound', 50, 'text');
      
      const stats = sessionManager.getStatistics();
      
      expect(stats.activeConnections).toBe(2);
      expect(stats.totalSessions).toBe(2);
      expect(stats.endpointStats['endpoint-123']).toEqual({
        sessions: 1,
        totalMessages: 2,
        totalBytes: 300,
      });
      expect(stats.endpointStats['endpoint-456']).toEqual({
        sessions: 1,
        totalMessages: 1,
        totalBytes: 50,
      });
    });
  });

  describe('Cleanup and Maintenance', () => {
    it('should cleanup stale sessions', async () => {
      const sessionId = await sessionManager.createSession('endpoint-123', mockWebSocket as any);
      const connection = sessionManager.getSession(sessionId);
      
      // Set last activity to 35 minutes ago (past threshold)
      connection!.lastActivity = new Date(Date.now() - 35 * 60 * 1000);
      
      // Manually trigger cleanup method using reflection to access private method
      const cleanupMethod = (sessionManager as any).cleanupStaleSessions;
      await cleanupMethod.call(sessionManager);
      
      expect(mockDatabaseService.closeSession).toHaveBeenCalledWith(sessionId, SessionState.FAILED);
    });

    it('should shutdown gracefully', async () => {
      vi.useFakeTimers();
      
      const sessionId = await sessionManager.createSession('endpoint-123', mockWebSocket as any);
      
      const shutdownPromise = sessionManager.shutdown();
      
      // Allow cleanup to run
      vi.runAllTimers();
      await shutdownPromise;
      
      expect(mockDatabaseService.closeSession).toHaveBeenCalledWith(sessionId, SessionState.CLOSED);
      expect(sessionManager.getSession(sessionId)).toBeUndefined();
      
      vi.useRealTimers();
    });
  });

  describe('Singleton Functions', () => {
    it('should return same instance from getSessionManager', () => {
      const manager1 = getSessionManager();
      const manager2 = getSessionManager();
      
      expect(manager1).toBe(manager2);
    });

    it('should shutdown session manager', async () => {
      const shutdownSpy = vi.spyOn(SessionManager.prototype, 'shutdown').mockResolvedValue();
      
      // First get a manager to create the singleton
      getSessionManager();
      
      await shutdownSessionManager();
      
      expect(shutdownSpy).toHaveBeenCalled();
    });

    it('should handle shutdown when no manager exists', async () => {
      // Should not throw error
      await expect(shutdownSessionManager()).resolves.toBeUndefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle message tracking with sampling errors', async () => {
      const sessionId = await sessionManager.createSession('endpoint-123', mockWebSocket as any);
      const sampling = { enabled: true, sampleRate: 1.0 };
      
      mockDatabaseService.createTrafficSample.mockRejectedValue(new Error('Sampling failed'));
      vi.spyOn(Math, 'random').mockReturnValue(0.1);
      
      // Should not throw error
      await expect(
        sessionManager.trackMessage(sessionId, 'inbound', 100, 'text', 'content', sampling)
      ).resolves.toBeUndefined();
      
      // Metrics should still be updated
      const connection = sessionManager.getSession(sessionId);
      expect(connection?.metrics.msgsIn).toBe(1);
    });

    it('should handle metric update errors gracefully', async () => {
      const sessionId = await sessionManager.createSession('endpoint-123', mockWebSocket as any);
      
      mockDatabaseService.updateSession.mockRejectedValue(new Error('Update failed'));
      
      // Track messages to trigger update
      for (let i = 0; i < 10; i++) {
        await sessionManager.trackMessage(sessionId, 'inbound', 100, 'text');
      }
      
      // Should not throw error
      const connection = sessionManager.getSession(sessionId);
      expect(connection?.metrics.msgsIn).toBe(10);
    });

    it('should handle sample rate correctly', async () => {
      const sessionId = await sessionManager.createSession('endpoint-123', mockWebSocket as any);
      const sampling = { enabled: true, sampleRate: 0.5 };
      
      // Mock random to not sample
      vi.spyOn(Math, 'random').mockReturnValue(0.6);
      
      await sessionManager.trackMessage(sessionId, 'inbound', 100, 'text', 'content', sampling);
      
      expect(mockDatabaseService.createTrafficSample).not.toHaveBeenCalled();
    });
  });
});