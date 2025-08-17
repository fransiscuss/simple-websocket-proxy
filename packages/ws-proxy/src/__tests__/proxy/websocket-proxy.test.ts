import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { IncomingMessage } from 'http';
import { SessionState } from '@prisma/client';
import { MockWebSocket } from '../mocks/websocket';
import { mockDatabaseService } from '../mocks/prisma';
import { generateTestData } from '../helpers/test-setup';
import {
  MessageTooLargeError,
} from '../../types';

// Mock dependencies
vi.mock('../../services/database', () => ({
  getDatabaseService: () => mockDatabaseService,
}));

const mockSessionManager = {
  createSession: vi.fn(),
  closeSession: vi.fn(),
  getSession: vi.fn(),
  setTargetWebSocket: vi.fn(),
  updateConnectionState: vi.fn(),
  checkConnectionLimit: vi.fn(),
  checkRateLimit: vi.fn(),
  checkBackpressure: vi.fn(),
  trackMessage: vi.fn(),
  getActiveSessionCount: vi.fn(),
  getStatistics: vi.fn(),
  killSession: vi.fn(),
};

vi.mock('../../services/session-manager', () => ({
  getSessionManager: () => mockSessionManager,
}));

vi.mock('../../utils/logger', () => ({
  loggers: {
    proxy: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }),
  },
  logError: vi.fn(),
  logConnectionEvent: vi.fn(),
  logBackpressure: vi.fn(),
}));

// Mock WebSocket constructor with inline implementation
vi.mock('ws', async () => {
  const { EventEmitter } = await import('events');
  
  class MockWS extends EventEmitter {
    public readyState = 1; // OPEN
    public bufferedAmount = 0;
    public url: string;
    
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;

    constructor(url?: string) {
      super();
      this.url = url || 'ws://localhost';
      
      setTimeout(() => {
        this.readyState = MockWS.OPEN;
        this.emit('open');
      }, 10);
    }

    send = vi.fn((data) => {
      this.emit('message', data, false);
    });

    close = vi.fn((code = 1000, reason = '') => {
      this.readyState = MockWS.CLOSED;
      this.emit('close', code, Buffer.from(reason));
    });

    ping = vi.fn();
    pong = vi.fn();
    
    simulateMessage(data, isBinary = false) {
      this.emit('message', data, isBinary);
    }
    
    simulateError(error) {
      this.emit('error', error);
    }
    
    simulateClose(code = 1000, reason = '') {
      this.readyState = MockWS.CLOSED;
      this.emit('close', code, Buffer.from(reason));
    }
    
    simulatePong() {
      this.emit('pong');
    }
  }
  
  const MockWebSocketClass = vi.fn().mockImplementation((url, options) => {
    const ws = new MockWS(url);
    (ws as any).options = options;
    return ws;
  });
  
  return {
    default: MockWebSocketClass,
    __esModule: true,
  };
});

// Import WebSocketProxy after mocks are set up
import { WebSocketProxy, getWebSocketProxy, shutdownWebSocketProxy } from '../../proxy/websocket-proxy';

describe('WebSocketProxy', () => {
  let proxy: WebSocketProxy;
  let mockClientWs: MockWebSocket;
  let mockRequest: IncomingMessage;
  let testEndpoint: any;

  beforeEach(() => {
    vi.clearAllMocks();
    proxy = new WebSocketProxy();
    mockClientWs = new MockWebSocket();
    
    mockRequest = {
      headers: {
        'user-agent': 'test-client',
        'x-forwarded-for': '192.168.1.100',
      },
      socket: {
        remoteAddress: '192.168.1.100',
      },
    } as any;

    testEndpoint = generateTestData.endpoint({
      id: 'endpoint-123',
      targetUrl: 'wss://target.example.com/ws',
      limits: {
        maxConnections: 100,
        maxMessageSize: 1048576,
        connectionTimeoutMs: 10000,
        idleTimeoutMs: 300000,
        rateLimitRpm: 60,
      },
      sampling: {
        enabled: false,
      },
      enabled: true,
    });

    // Setup default mock responses
    mockDatabaseService.getEndpoint.mockResolvedValue(testEndpoint);
    mockSessionManager.createSession.mockResolvedValue('session-123');
    mockSessionManager.checkConnectionLimit.mockResolvedValue(true);
    mockSessionManager.checkRateLimit.mockReturnValue(true);
    mockSessionManager.checkBackpressure.mockReturnValue(false);
    mockSessionManager.getSession.mockReturnValue({
      sessionId: 'session-123',
      endpointId: 'endpoint-123',
      clientWs: mockClientWs,
      targetWs: null,
      metrics: { msgsIn: 0, msgsOut: 0, bytesIn: 0, bytesOut: 0 },
      lastActivity: new Date(),
      state: 'connecting',
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Connection Handling', () => {
    it('should handle successful connection', async () => {
      const targetWs = new MockWebSocket();
      const WebSocketMock = vi.mocked(await import('ws')).default;
      WebSocketMock.mockReturnValue(targetWs as any);

      await proxy.handleConnection(mockClientWs as any, mockRequest, 'endpoint-123');

      expect(mockDatabaseService.getEndpoint).toHaveBeenCalledWith('endpoint-123');
      expect(mockSessionManager.createSession).toHaveBeenCalledWith('endpoint-123', mockClientWs);
      expect(mockSessionManager.checkConnectionLimit).toHaveBeenCalledWith('endpoint-123', 100);
      expect(mockSessionManager.checkRateLimit).toHaveBeenCalledWith('endpoint-123', 60);
      
      // Should create target WebSocket
      expect(WebSocketMock).toHaveBeenCalledWith('wss://target.example.com/ws', {
        handshakeTimeout: 10000,
        perMessageDeflate: false,
        maxPayload: 1048576,
      });

      // Should set up WebSocket handlers
      expect(mockClientWs.listenerCount('message')).toBeGreaterThan(0);
      expect(mockClientWs.listenerCount('close')).toBeGreaterThan(0);
      expect(mockClientWs.listenerCount('error')).toBeGreaterThan(0);
    });

    it('should handle endpoint not found', async () => {
      mockDatabaseService.getEndpoint.mockResolvedValue(null);

      await proxy.handleConnection(mockClientWs as any, mockRequest, 'non-existent');

      expect(mockClientWs.close).toHaveBeenCalledWith(1002, expect.stringContaining('not found'));
      expect(mockSessionManager.createSession).not.toHaveBeenCalled();
    });

    it('should handle disabled endpoint', async () => {
      const disabledEndpoint = { ...testEndpoint, enabled: false };
      mockDatabaseService.getEndpoint.mockResolvedValue(disabledEndpoint);

      await proxy.handleConnection(mockClientWs as any, mockRequest, 'endpoint-123');

      expect(mockClientWs.close).toHaveBeenCalledWith(1011, expect.stringContaining('disabled'));
      expect(mockSessionManager.createSession).not.toHaveBeenCalled();
    });

    it('should handle connection limit exceeded', async () => {
      mockSessionManager.checkConnectionLimit.mockResolvedValue(false);

      await proxy.handleConnection(mockClientWs as any, mockRequest, 'endpoint-123');

      expect(mockClientWs.close).toHaveBeenCalledWith(1011, expect.stringContaining('limit exceeded'));
      expect(mockSessionManager.createSession).not.toHaveBeenCalled();
    });

    it('should handle rate limit exceeded', async () => {
      mockSessionManager.checkRateLimit.mockReturnValue(false);

      await proxy.handleConnection(mockClientWs as any, mockRequest, 'endpoint-123');

      expect(mockClientWs.close).toHaveBeenCalledWith(1011, expect.stringContaining('Rate limit'));
      expect(mockSessionManager.createSession).not.toHaveBeenCalled();
    });

    it('should handle target connection timeout', async () => {
      const targetWs = new MockWebSocket();
      MockWebSocketClass.mockReturnValue(targetWs);
      
      // Don't emit 'open' event to simulate timeout
      vi.useFakeTimers();

      const connectionPromise = proxy.handleConnection(mockClientWs as any, mockRequest, 'endpoint-123');
      
      // Advance time past timeout
      vi.advanceTimersByTime(15000);
      
      await expect(connectionPromise).rejects.toThrow();
      expect(mockSessionManager.closeSession).toHaveBeenCalledWith('session-123', SessionState.FAILED);

      vi.useRealTimers();
    });

    it('should handle target connection error', async () => {
      const targetWs = new MockWebSocket();
      MockWebSocketClass.mockReturnValue(targetWs);

      const connectionPromise = proxy.handleConnection(mockClientWs as any, mockRequest, 'endpoint-123');
      
      // Simulate connection error
      setTimeout(() => {
        targetWs.emit('error', new Error('Connection failed'));
      }, 10);

      await expect(connectionPromise).rejects.toThrow('Connection failed');
      expect(mockSessionManager.closeSession).toHaveBeenCalledWith('session-123', SessionState.FAILED);
    });

    it('should extract client IP from x-forwarded-for header', async () => {
      mockRequest.headers['x-forwarded-for'] = '203.0.113.195, 70.41.3.18, 150.172.238.178';
      
      const targetWs = new MockWebSocket();
      MockWebSocketClass.mockReturnValue(targetWs);

      await proxy.handleConnection(mockClientWs as any, mockRequest, 'endpoint-123');

      // Should use first IP from x-forwarded-for
      expect(mockSessionManager.createSession).toHaveBeenCalledWith('endpoint-123', mockClientWs);
    });

    it('should handle missing client IP', async () => {
      delete mockRequest.headers['x-forwarded-for'];
      delete (mockRequest.socket as any).remoteAddress;
      
      const targetWs = new MockWebSocket();
      MockWebSocketClass.mockReturnValue(targetWs);

      await proxy.handleConnection(mockClientWs as any, mockRequest, 'endpoint-123');

      // Should still work with unknown IP
      expect(mockSessionManager.createSession).toHaveBeenCalled();
    });
  });

  describe('Message Handling', () => {
    beforeEach(async () => {
      const targetWs = new MockWebSocket();
      MockWebSocketClass.mockReturnValue(targetWs);
      
      // Set up connection
      mockSessionManager.getSession.mockReturnValue({
        sessionId: 'session-123',
        endpointId: 'endpoint-123',
        clientWs: mockClientWs,
        targetWs,
        metrics: { msgsIn: 0, msgsOut: 0, bytesIn: 0, bytesOut: 0 },
        lastActivity: new Date(),
        state: 'connected',
      });

      await proxy.handleConnection(mockClientWs as any, mockRequest, 'endpoint-123');
    });

    it('should forward text message from client to target', async () => {
      const connection = mockSessionManager.getSession('session-123');
      const targetSendSpy = vi.spyOn(connection.targetWs, 'send');

      mockClientWs.simulateMessage('Hello World', false);

      expect(targetSendSpy).toHaveBeenCalledWith('Hello World');
      expect(mockSessionManager.trackMessage).toHaveBeenCalledWith(
        'session-123',
        'inbound',
        11, // 'Hello World'.length
        'text',
        'Hello World',
        testEndpoint.sampling
      );
    });

    it('should forward binary message from client to target', async () => {
      const connection = mockSessionManager.getSession('session-123');
      const targetSendSpy = vi.spyOn(connection.targetWs, 'send');
      const binaryData = Buffer.from('binary data');

      mockClientWs.simulateMessage(binaryData, true);

      expect(targetSendSpy).toHaveBeenCalledWith(binaryData);
      expect(mockSessionManager.trackMessage).toHaveBeenCalledWith(
        'session-123',
        'inbound',
        binaryData.length,
        'binary',
        binaryData,
        testEndpoint.sampling
      );
    });

    it('should forward message from target to client', async () => {
      const connection = mockSessionManager.getSession('session-123');
      const clientSendSpy = vi.spyOn(mockClientWs, 'send');

      connection.targetWs.simulateMessage('Response from target', false);

      expect(clientSendSpy).toHaveBeenCalledWith('Response from target');
      expect(mockSessionManager.trackMessage).toHaveBeenCalledWith(
        'session-123',
        'outbound',
        19, // 'Response from target'.length
        'text',
        'Response from target',
        testEndpoint.sampling
      );
    });

    it('should reject oversized messages', async () => {
      const largeMessage = 'x'.repeat(testEndpoint.limits.maxMessageSize + 1);

      await expect(async () => {
        mockClientWs.simulateMessage(largeMessage, false);
      }).rejects.toThrow(MessageTooLargeError);
    });

    it('should handle backpressure', async () => {
      mockSessionManager.checkBackpressure.mockReturnValue(true);
      const connection = mockSessionManager.getSession('session-123');
      
      // Simulate high buffered amount
      connection.targetWs.bufferedAmount = 70000; // > 64KB threshold
      
      const targetSendSpy = vi.spyOn(connection.targetWs, 'send');

      mockClientWs.simulateMessage('test message', false);

      // Message should be dropped due to severe backpressure
      expect(targetSendSpy).not.toHaveBeenCalled();
    });

    it('should handle message when target not connected', async () => {
      mockSessionManager.getSession.mockReturnValue({
        sessionId: 'session-123',
        endpointId: 'endpoint-123',
        clientWs: mockClientWs,
        targetWs: null, // No target connection
        metrics: { msgsIn: 0, msgsOut: 0, bytesIn: 0, bytesOut: 0 },
        lastActivity: new Date(),
        state: 'connecting',
      });

      // Should not throw error, just log warning
      mockClientWs.simulateMessage('test message', false);
      expect(mockSessionManager.trackMessage).not.toHaveBeenCalled();
    });

    it('should handle message when client not connected', async () => {
      const connection = mockSessionManager.getSession('session-123');
      mockClientWs.readyState = 3; // CLOSED
      
      const clientSendSpy = vi.spyOn(mockClientWs, 'send');

      connection.targetWs.simulateMessage('response', false);

      // Should not send to closed client
      expect(clientSendSpy).not.toHaveBeenCalled();
    });

    it('should process ArrayBuffer messages', async () => {
      const connection = mockSessionManager.getSession('session-123');
      const arrayBuffer = new ArrayBuffer(8);
      const view = new Uint8Array(arrayBuffer);
      view.set([1, 2, 3, 4, 5, 6, 7, 8]);

      const targetSendSpy = vi.spyOn(connection.targetWs, 'send');

      mockClientWs.simulateMessage(arrayBuffer, true);

      expect(targetSendSpy).toHaveBeenCalled();
      expect(mockSessionManager.trackMessage).toHaveBeenCalledWith(
        'session-123',
        'inbound',
        8,
        'binary',
        expect.any(Buffer),
        testEndpoint.sampling
      );
    });

    it('should process array of buffers', async () => {
      const connection = mockSessionManager.getSession('session-123');
      const buffers = [Buffer.from('hello'), Buffer.from(' '), Buffer.from('world')];
      
      const targetSendSpy = vi.spyOn(connection.targetWs, 'send');

      mockClientWs.simulateMessage(buffers, true);

      expect(targetSendSpy).toHaveBeenCalled();
      expect(mockSessionManager.trackMessage).toHaveBeenCalledWith(
        'session-123',
        'inbound',
        11, // Combined length
        'binary',
        expect.any(Buffer),
        testEndpoint.sampling
      );
    });
  });

  describe('Connection Lifecycle', () => {
    it('should handle client disconnect', async () => {
      const targetWs = new MockWebSocket();
      MockWebSocketClass.mockReturnValue(targetWs);

      await proxy.handleConnection(mockClientWs as any, mockRequest, 'endpoint-123');

      mockClientWs.simulateClose(1000, 'Normal closure');

      expect(mockSessionManager.closeSession).toHaveBeenCalledWith('session-123', SessionState.CLOSED);
    });

    it('should handle client error', async () => {
      const targetWs = new MockWebSocket();
      MockWebSocketClass.mockReturnValue(targetWs);

      await proxy.handleConnection(mockClientWs as any, mockRequest, 'endpoint-123');

      mockClientWs.simulateError(new Error('Client error'));

      expect(mockSessionManager.closeSession).toHaveBeenCalledWith('session-123', SessionState.FAILED);
    });

    it('should handle target disconnect', async () => {
      const targetWs = new MockWebSocket();
      MockWebSocketClass.mockReturnValue(targetWs);

      await proxy.handleConnection(mockClientWs as any, mockRequest, 'endpoint-123');

      targetWs.simulateClose(1000, 'Target closed');

      // Should close the session
      expect(mockSessionManager.closeSession).toHaveBeenCalled();
    });

    it('should handle target error', async () => {
      const targetWs = new MockWebSocket();
      MockWebSocketClass.mockReturnValue(targetWs);

      await proxy.handleConnection(mockClientWs as any, mockRequest, 'endpoint-123');

      targetWs.simulateError(new Error('Target error'));

      expect(mockSessionManager.closeSession).toHaveBeenCalledWith('session-123', SessionState.FAILED);
    });

    it('should handle pong from client', async () => {
      const targetWs = new MockWebSocket();
      MockWebSocketClass.mockReturnValue(targetWs);

      await proxy.handleConnection(mockClientWs as any, mockRequest, 'endpoint-123');

      mockClientWs.simulatePong();

      // Should update last activity
      const connection = mockSessionManager.getSession('session-123');
      expect(connection.lastActivity).toBeInstanceOf(Date);
    });
  });

  describe('Idle Timeout', () => {
    it('should set up idle timeout when configured', async () => {
      vi.useFakeTimers();
      
      const targetWs = new MockWebSocket();
      MockWebSocketClass.mockReturnValue(targetWs);

      await proxy.handleConnection(mockClientWs as any, mockRequest, 'endpoint-123');

      // Advance time past idle timeout
      vi.advanceTimersByTime(testEndpoint.limits.idleTimeoutMs + 1000);

      // Should close connection due to idle timeout
      expect(mockSessionManager.closeSession).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should reset idle timeout on message', async () => {
      vi.useFakeTimers();
      
      const targetWs = new MockWebSocket();
      MockWebSocketClass.mockReturnValue(targetWs);

      await proxy.handleConnection(mockClientWs as any, mockRequest, 'endpoint-123');

      // Send message to reset timer
      mockClientWs.simulateMessage('keep alive', false);

      // Advance time but not past the reset timeout
      vi.advanceTimersByTime(testEndpoint.limits.idleTimeoutMs - 1000);

      // Should not close yet
      expect(mockSessionManager.closeSession).not.toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

  describe('Statistics and Health', () => {
    it('should get active connections count', () => {
      mockSessionManager.getActiveSessionCount.mockReturnValue(5);

      const count = proxy.getActiveConnections();

      expect(count).toBe(5);
      expect(mockSessionManager.getActiveSessionCount).toHaveBeenCalled();
    });

    it('should get statistics', () => {
      const mockStats = {
        activeConnections: 10,
        totalSessions: 25,
        endpointStats: {
          'endpoint-1': { sessions: 5, totalMessages: 100, totalBytes: 50000 },
        },
      };
      mockSessionManager.getStatistics.mockReturnValue(mockStats);

      const stats = proxy.getStatistics();

      expect(stats).toEqual(mockStats);
      expect(mockSessionManager.getStatistics).toHaveBeenCalled();
    });
  });

  describe('Shutdown', () => {
    it('should shutdown gracefully', async () => {
      vi.useFakeTimers();
      
      mockSessionManager.getStatistics.mockReturnValue({
        activeConnections: 3,
        totalSessions: 3,
        endpointStats: {},
      });

      const shutdownPromise = proxy.shutdown();
      
      // Advance time for graceful shutdown
      vi.advanceTimersByTime(6000);
      
      await shutdownPromise;

      expect(mockSessionManager.getStatistics).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should shutdown immediately when no active connections', async () => {
      mockSessionManager.getStatistics.mockReturnValue({
        activeConnections: 0,
        totalSessions: 0,
        endpointStats: {},
      });

      await proxy.shutdown();

      expect(mockSessionManager.getStatistics).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle session creation errors', async () => {
      mockSessionManager.createSession.mockRejectedValue(new Error('Session creation failed'));

      await proxy.handleConnection(mockClientWs as any, mockRequest, 'endpoint-123');

      expect(mockClientWs.close).toHaveBeenCalledWith(1011, expect.any(String));
    });

    it('should handle message forwarding errors', async () => {
      const targetWs = new MockWebSocket();
      MockWebSocketClass.mockReturnValue(targetWs);

      await proxy.handleConnection(mockClientWs as any, mockRequest, 'endpoint-123');

      // Make target.send throw error
      vi.spyOn(targetWs, 'send').mockImplementation(() => {
        throw new Error('Send failed');
      });

      // Should handle error gracefully
      mockClientWs.simulateMessage('test', false);
      expect(mockSessionManager.closeSession).toHaveBeenCalledWith('session-123', SessionState.FAILED);
    });

    it('should handle tracking errors gracefully', async () => {
      const targetWs = new MockWebSocket();
      MockWebSocketClass.mockReturnValue(targetWs);

      await proxy.handleConnection(mockClientWs as any, mockRequest, 'endpoint-123');

      mockSessionManager.trackMessage.mockRejectedValue(new Error('Tracking failed'));

      // Should not crash on tracking error
      mockClientWs.simulateMessage('test', false);
      expect(mockSessionManager.closeSession).toHaveBeenCalledWith('session-123', SessionState.FAILED);
    });
  });

  describe('Singleton Functions', () => {
    it('should return same instance from getWebSocketProxy', () => {
      const proxy1 = getWebSocketProxy();
      const proxy2 = getWebSocketProxy();

      expect(proxy1).toBe(proxy2);
    });

    it('should shutdown WebSocket proxy', async () => {
      const shutdownSpy = vi.spyOn(WebSocketProxy.prototype, 'shutdown').mockResolvedValue();

      // First get a proxy to create the singleton
      getWebSocketProxy();

      await shutdownWebSocketProxy();

      expect(shutdownSpy).toHaveBeenCalled();
    });

    it('should handle shutdown when no proxy exists', async () => {
      // Should not throw error
      await expect(shutdownWebSocketProxy()).resolves.toBeUndefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle connection when session manager returns null', async () => {
      mockSessionManager.getSession.mockReturnValue(null);

      const targetWs = new MockWebSocket();
      MockWebSocketClass.mockReturnValue(targetWs);

      await proxy.handleConnection(mockClientWs as any, mockRequest, 'endpoint-123');

      // Should handle gracefully
      expect(mockClientWs.close).toHaveBeenCalled();
    });

    it('should handle empty message content', async () => {
      const targetWs = new MockWebSocket();
      MockWebSocketClass.mockReturnValue(targetWs);

      await proxy.handleConnection(mockClientWs as any, mockRequest, 'endpoint-123');

      const targetSendSpy = vi.spyOn(targetWs, 'send');

      mockClientWs.simulateMessage('', false);

      expect(targetSendSpy).toHaveBeenCalledWith('');
    });

    it('should handle malformed endpoint limits', async () => {
      const malformedEndpoint = {
        ...testEndpoint,
        limits: null,
      };
      mockDatabaseService.getEndpoint.mockResolvedValue(malformedEndpoint);

      await proxy.handleConnection(mockClientWs as any, mockRequest, 'endpoint-123');

      // Should use default values and not crash
      expect(mockSessionManager.createSession).toHaveBeenCalled();
    });
  });
});