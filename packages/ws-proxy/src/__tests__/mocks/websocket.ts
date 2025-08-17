import { vi } from 'vitest';
import { EventEmitter } from 'events';

// Mock WebSocket class
export class MockWebSocket extends EventEmitter {
  public readyState: number = 1; // OPEN
  public bufferedAmount: number = 0;
  public url: string;
  
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  constructor(url?: string) {
    super();
    this.url = url || 'ws://localhost';
    
    // Simulate connection opening
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      this.emit('open');
    }, 10);
  }

  send = vi.fn((data: any) => {
    // Simulate successful send
    this.emit('message', data, false);
  });

  close = vi.fn((code?: number, reason?: string) => {
    this.readyState = MockWebSocket.CLOSED;
    this.emit('close', code || 1000, Buffer.from(reason || ''));
  });

  ping = vi.fn();
  pong = vi.fn();
  
  // Helper methods for testing
  simulateMessage(data: any, isBinary: boolean = false) {
    this.emit('message', data, isBinary);
  }
  
  simulateError(error: Error) {
    this.emit('error', error);
  }
  
  simulateClose(code: number = 1000, reason: string = '') {
    this.readyState = MockWebSocket.CLOSED;
    this.emit('close', code, Buffer.from(reason));
  }
  
  simulatePong() {
    this.emit('pong');
  }
}

// Mock WebSocket Server
export class MockWebSocketServer extends EventEmitter {
  clients = new Set();
  
  constructor() {
    super();
  }
  
  close = vi.fn((callback?: () => void) => {
    if (callback) callback();
  });
  
  handleUpgrade = vi.fn();
  
  // Helper to simulate new connection
  simulateConnection(ws: MockWebSocket) {
    this.clients.add(ws);
    this.emit('connection', ws);
  }
}

// Helper to create mock WebSocket with common setup
export const createMockWebSocket = (url?: string): MockWebSocket => {
  return new MockWebSocket(url);
};

// Helper to create mock WebSocket server
export const createMockWebSocketServer = (): MockWebSocketServer => {
  return new MockWebSocketServer();
};