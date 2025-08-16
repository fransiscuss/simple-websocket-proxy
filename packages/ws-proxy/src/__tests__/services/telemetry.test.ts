import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TelemetryService, getTelemetryService, shutdownTelemetryService } from '../../services/telemetry';
import { MockWebSocket } from '../mocks/websocket';

// Mock logger
vi.mock('../../utils/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Mock session manager
const mockSessionManager = {
  getStatistics: vi.fn(),
  getActiveSessions: vi.fn(),
  killSession: vi.fn(),
};

vi.mock('../../services/session-manager', () => ({
  getSessionManager: () => mockSessionManager,
}));

describe('TelemetryService', () => {
  let telemetryService: TelemetryService;
  let mockClient: MockWebSocket;

  beforeEach(() => {
    vi.clearAllMocks();
    telemetryService = new TelemetryService();
    mockClient = new MockWebSocket();
    
    // Setup default mock responses
    mockSessionManager.getStatistics.mockReturnValue({
      activeConnections: 5,
      totalSessions: 10,
      endpointStats: {
        'endpoint-1': { sessions: 3, totalMessages: 100, totalBytes: 50000 },
        'endpoint-2': { sessions: 2, totalMessages: 50, totalBytes: 25000 },
      },
    });

    mockSessionManager.getActiveSessions.mockReturnValue(new Map([
      ['session-1', {
        sessionId: 'session-1',
        endpointId: 'endpoint-1',
        lastActivity: new Date(),
        metrics: { msgsIn: 10, msgsOut: 5, bytesIn: 1024, bytesOut: 512 },
        state: 'connected',
      }],
      ['session-2', {
        sessionId: 'session-2',
        endpointId: 'endpoint-2',
        lastActivity: new Date(),
        metrics: { msgsIn: 20, msgsOut: 15, bytesIn: 2048, bytesOut: 1024 },
        state: 'connected',
      }],
    ]));

    mockSessionManager.killSession.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Client Management', () => {
    it('should add client and send current stats', async () => {
      const sendSpy = vi.spyOn(mockClient, 'send');
      
      telemetryService.addClient(mockClient as any);
      
      // Wait for stats to be sent
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(sendSpy).toHaveBeenCalledWith(
        expect.stringContaining('"type":"currentStats"')
      );
      
      const sentData = JSON.parse(sendSpy.mock.calls[0][0]);
      expect(sentData.type).toBe('currentStats');
      expect(sentData.data.statistics).toEqual(
        expect.objectContaining({
          activeConnections: 5,
          totalSessions: 10,
        })
      );
    });

    it('should remove client on close', () => {
      telemetryService.addClient(mockClient as any);
      expect(telemetryService.getClientCount()).toBe(1);
      
      mockClient.emit('close');
      
      expect(telemetryService.getClientCount()).toBe(0);
    });

    it('should remove client on error', () => {
      telemetryService.addClient(mockClient as any);
      expect(telemetryService.getClientCount()).toBe(1);
      
      mockClient.emit('error', new Error('Test error'));
      
      expect(telemetryService.getClientCount()).toBe(0);
    });

    it('should reject client when shutting down', () => {
      const closeSpy = vi.spyOn(mockClient, 'close');
      
      // Start shutdown
      telemetryService.shutdown();
      
      telemetryService.addClient(mockClient as any);
      
      expect(closeSpy).toHaveBeenCalledWith(1001, 'Service shutting down');
    });

    it('should get correct client count', () => {
      expect(telemetryService.getClientCount()).toBe(0);
      
      telemetryService.addClient(mockClient as any);
      expect(telemetryService.getClientCount()).toBe(1);
      
      telemetryService.addClient(new MockWebSocket() as any);
      expect(telemetryService.getClientCount()).toBe(2);
    });
  });

  describe('Control Commands', () => {
    it('should handle session kill command', async () => {
      const sendSpy = vi.spyOn(mockClient, 'send');
      telemetryService.addClient(mockClient as any);
      
      const command = {
        type: 'session.kill',
        data: { sessionId: 'session-123' },
      };
      
      mockClient.emit('message', Buffer.from(JSON.stringify(command)));
      
      // Wait for command processing
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(mockSessionManager.killSession).toHaveBeenCalledWith('session-123');
      
      // Should broadcast result
      const broadcastCall = sendSpy.mock.calls.find(call => 
        call[0].includes('"type":"commandResult"')
      );
      expect(broadcastCall).toBeTruthy();
      
      const result = JSON.parse(broadcastCall![0]);
      expect(result.data.success).toBe(true);
    });

    it('should handle unknown command type', () => {
      const sendSpy = vi.spyOn(mockClient, 'send');
      telemetryService.addClient(mockClient as any);
      
      const command = {
        type: 'unknown.command',
        data: {},
      };
      
      mockClient.emit('message', Buffer.from(JSON.stringify(command)));
      
      // Should not crash or cause errors
      expect(mockSessionManager.killSession).not.toHaveBeenCalled();
    });

    it('should handle invalid command format', () => {
      const sendSpy = vi.spyOn(mockClient, 'send');
      telemetryService.addClient(mockClient as any);
      
      mockClient.emit('message', Buffer.from('invalid json'));
      
      // Should send error response
      const errorCall = sendSpy.mock.calls.find(call => 
        call[0].includes('"type":"error"')
      );
      expect(errorCall).toBeTruthy();
    });

    it('should handle session kill failure', async () => {
      const sendSpy = vi.spyOn(mockClient, 'send');
      telemetryService.addClient(mockClient as any);
      
      mockSessionManager.killSession.mockResolvedValue(false);
      
      const command = {
        type: 'session.kill',
        data: { sessionId: 'session-123' },
      };
      
      mockClient.emit('message', Buffer.from(JSON.stringify(command)));
      
      // Wait for command processing
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const broadcastCall = sendSpy.mock.calls.find(call => 
        call[0].includes('"type":"commandResult"')
      );
      expect(broadcastCall).toBeTruthy();
      
      const result = JSON.parse(broadcastCall![0]);
      expect(result.data.success).toBe(false);
    });

    it('should handle session kill error', async () => {
      const sendSpy = vi.spyOn(mockClient, 'send');
      telemetryService.addClient(mockClient as any);
      
      mockSessionManager.killSession.mockRejectedValue(new Error('Kill failed'));
      
      const command = {
        type: 'session.kill',
        data: { sessionId: 'session-123' },
      };
      
      mockClient.emit('message', Buffer.from(JSON.stringify(command)));
      
      // Wait for command processing
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const broadcastCall = sendSpy.mock.calls.find(call => 
        call[0].includes('"type":"commandError"')
      );
      expect(broadcastCall).toBeTruthy();
    });
  });

  describe('Event Broadcasting', () => {
    it('should broadcast events to all clients', () => {
      const client1 = new MockWebSocket();
      const client2 = new MockWebSocket();
      const sendSpy1 = vi.spyOn(client1, 'send');
      const sendSpy2 = vi.spyOn(client2, 'send');
      
      telemetryService.addClient(client1 as any);
      telemetryService.addClient(client2 as any);
      
      const event = {
        type: 'sessionStarted',
        timestamp: new Date().toISOString(),
        data: { sessionId: 'session-123', endpointId: 'endpoint-123', clientIP: '192.168.1.1' },
      };
      
      telemetryService.broadcast(event);
      
      const expectedMessage = JSON.stringify(event);
      expect(sendSpy1).toHaveBeenCalledWith(expectedMessage);
      expect(sendSpy2).toHaveBeenCalledWith(expectedMessage);
    });

    it('should clean up dead clients during broadcast', () => {
      const client1 = new MockWebSocket();
      const client2 = new MockWebSocket();
      
      // Make client2 closed
      client2.readyState = 3; // CLOSED
      
      telemetryService.addClient(client1 as any);
      telemetryService.addClient(client2 as any);
      
      expect(telemetryService.getClientCount()).toBe(2);
      
      const event = {
        type: 'test',
        timestamp: new Date().toISOString(),
        data: {},
      };
      
      telemetryService.broadcast(event);
      
      // Dead client should be removed
      expect(telemetryService.getClientCount()).toBe(1);
    });

    it('should handle send errors during broadcast', () => {
      const client1 = new MockWebSocket();
      const client2 = new MockWebSocket();
      
      // Make client1 throw error on send
      vi.spyOn(client1, 'send').mockImplementation(() => {
        throw new Error('Send failed');
      });
      
      telemetryService.addClient(client1 as any);
      telemetryService.addClient(client2 as any);
      
      const event = {
        type: 'test',
        timestamp: new Date().toISOString(),
        data: {},
      };
      
      telemetryService.broadcast(event);
      
      // Error client should be removed
      expect(telemetryService.getClientCount()).toBe(1);
    });

    it('should not broadcast when shutting down', () => {
      const client = new MockWebSocket();
      const sendSpy = vi.spyOn(client, 'send');
      
      telemetryService.addClient(client as any);
      telemetryService.shutdown();
      
      const event = {
        type: 'test',
        timestamp: new Date().toISOString(),
        data: {},
      };
      
      telemetryService.broadcast(event);
      
      // Should not send (except for currentStats sent during addClient)
      expect(sendSpy).toHaveBeenCalledTimes(1); // Only currentStats
    });
  });

  describe('Convenience Event Methods', () => {
    it('should emit session started event', () => {
      const broadcastSpy = vi.spyOn(telemetryService, 'broadcast');
      
      telemetryService.emitSessionStarted('session-123', 'endpoint-123', '192.168.1.1');
      
      expect(broadcastSpy).toHaveBeenCalledWith({
        type: 'sessionStarted',
        timestamp: expect.any(String),
        data: {
          sessionId: 'session-123',
          endpointId: 'endpoint-123',
          clientIP: '192.168.1.1',
        },
      });
    });

    it('should emit session updated event', () => {
      const broadcastSpy = vi.spyOn(telemetryService, 'broadcast');
      
      telemetryService.emitSessionUpdated('session-123', 'endpoint-123', 10, 5, 1024, 512, 50);
      
      expect(broadcastSpy).toHaveBeenCalledWith({
        type: 'sessionUpdated',
        timestamp: expect.any(String),
        data: {
          sessionId: 'session-123',
          endpointId: 'endpoint-123',
          msgsIn: 10,
          msgsOut: 5,
          bytesIn: 1024,
          bytesOut: 512,
          latency: 50,
        },
      });
    });

    it('should emit session ended event', () => {
      const broadcastSpy = vi.spyOn(telemetryService, 'broadcast');
      
      const finalStats = { msgsIn: 100, msgsOut: 50, bytesIn: 10240, bytesOut: 5120 };
      telemetryService.emitSessionEnded('session-123', 'endpoint-123', 'normal_closure', 60000, finalStats);
      
      expect(broadcastSpy).toHaveBeenCalledWith({
        type: 'sessionEnded',
        timestamp: expect.any(String),
        data: {
          sessionId: 'session-123',
          endpointId: 'endpoint-123',
          reason: 'normal_closure',
          duration: 60000,
          finalStats,
        },
      });
    });

    it('should emit message meta event', () => {
      const broadcastSpy = vi.spyOn(telemetryService, 'broadcast');
      
      telemetryService.emitMessageMeta('session-123', 'endpoint-123', 'inbound', 1024, 25);
      
      expect(broadcastSpy).toHaveBeenCalledWith({
        type: 'messageMeta',
        timestamp: expect.any(String),
        data: {
          sessionId: 'session-123',
          endpointId: 'endpoint-123',
          direction: 'inbound',
          size: 1024,
          latency: 25,
        },
      });
    });

    it('should emit sampled payload event', () => {
      const broadcastSpy = vi.spyOn(telemetryService, 'broadcast');
      
      telemetryService.emitSampledPayload('session-123', 'endpoint-123', 'outbound', 512, 'sample content');
      
      expect(broadcastSpy).toHaveBeenCalledWith({
        type: 'sampledPayload',
        timestamp: expect.any(String),
        data: {
          sessionId: 'session-123',
          endpointId: 'endpoint-123',
          direction: 'outbound',
          size: 512,
          content: 'sample content',
          timestamp: expect.any(String),
        },
      });
    });
  });

  describe('Shutdown', () => {
    it('should shutdown gracefully', async () => {
      const client1 = new MockWebSocket();
      const client2 = new MockWebSocket();
      const closeSpy1 = vi.spyOn(client1, 'close');
      const closeSpy2 = vi.spyOn(client2, 'close');
      
      telemetryService.addClient(client1 as any);
      telemetryService.addClient(client2 as any);
      
      await telemetryService.shutdown();
      
      expect(closeSpy1).toHaveBeenCalledWith(1001, 'Service shutting down');
      expect(closeSpy2).toHaveBeenCalledWith(1001, 'Service shutting down');
      expect(telemetryService.getClientCount()).toBe(0);
    });

    it('should handle close errors during shutdown', async () => {
      const client = new MockWebSocket();
      vi.spyOn(client, 'close').mockImplementation(() => {
        throw new Error('Close failed');
      });
      
      telemetryService.addClient(client as any);
      
      // Should not throw error
      await expect(telemetryService.shutdown()).resolves.toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle stats sending errors', async () => {
      mockSessionManager.getStatistics.mockImplementation(() => {
        throw new Error('Stats error');
      });
      
      const client = new MockWebSocket();
      telemetryService.addClient(client as any);
      
      // Should not crash or throw error
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    it('should handle session manager import errors', async () => {
      vi.doMock('../../services/session-manager', () => {
        throw new Error('Import failed');
      });
      
      const client = new MockWebSocket();
      telemetryService.addClient(client as any);
      
      // Should not crash
      await new Promise(resolve => setTimeout(resolve, 10));
    });
  });

  describe('Singleton Functions', () => {
    it('should return same instance from getTelemetryService', () => {
      const service1 = getTelemetryService();
      const service2 = getTelemetryService();
      
      expect(service1).toBe(service2);
    });

    it('should shutdown telemetry service', async () => {
      const shutdownSpy = vi.spyOn(TelemetryService.prototype, 'shutdown').mockResolvedValue();
      
      // First get a service to create the singleton
      getTelemetryService();
      
      await shutdownTelemetryService();
      
      expect(shutdownSpy).toHaveBeenCalled();
    });

    it('should handle shutdown when no service exists', async () => {
      // Should not throw error
      await expect(shutdownTelemetryService()).resolves.toBeUndefined();
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle multiple clients with different commands', async () => {
      const client1 = new MockWebSocket();
      const client2 = new MockWebSocket();
      const sendSpy1 = vi.spyOn(client1, 'send');
      const sendSpy2 = vi.spyOn(client2, 'send');
      
      telemetryService.addClient(client1 as any);
      telemetryService.addClient(client2 as any);
      
      // Client1 sends kill command
      const killCommand = {
        type: 'session.kill',
        data: { sessionId: 'session-123' },
      };
      client1.emit('message', Buffer.from(JSON.stringify(killCommand)));
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Both clients should receive the result broadcast
      const broadcastCall1 = sendSpy1.mock.calls.find(call => 
        call[0].includes('"type":"commandResult"')
      );
      const broadcastCall2 = sendSpy2.mock.calls.find(call => 
        call[0].includes('"type":"commandResult"')
      );
      
      expect(broadcastCall1).toBeTruthy();
      expect(broadcastCall2).toBeTruthy();
    });

    it('should handle rapid client connections and disconnections', () => {
      const clients: MockWebSocket[] = [];
      
      // Add many clients
      for (let i = 0; i < 10; i++) {
        const client = new MockWebSocket();
        clients.push(client);
        telemetryService.addClient(client as any);
      }
      
      expect(telemetryService.getClientCount()).toBe(10);
      
      // Disconnect half
      for (let i = 0; i < 5; i++) {
        clients[i].emit('close');
      }
      
      expect(telemetryService.getClientCount()).toBe(5);
      
      // Broadcast event to remaining clients
      const remainingSendSpies = clients.slice(5).map(client => vi.spyOn(client, 'send'));
      
      telemetryService.emitSessionStarted('session-123', 'endpoint-123', '192.168.1.1');
      
      // All remaining clients should receive the event
      remainingSendSpies.forEach(spy => {
        expect(spy).toHaveBeenCalledWith(
          expect.stringContaining('"type":"sessionStarted"')
        );
      });
    });
  });
});