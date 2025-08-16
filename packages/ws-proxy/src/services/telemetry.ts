import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { createLogger } from '../utils/logger';

const logger = createLogger({ name: 'telemetry' });

export interface TelemetryEvent {
  type: string;
  timestamp: string;
  data: any;
}

export interface SessionStartedEvent extends TelemetryEvent {
  type: 'sessionStarted';
  data: {
    sessionId: string;
    endpointId: string;
    clientIP: string;
  };
}

export interface SessionUpdatedEvent extends TelemetryEvent {
  type: 'sessionUpdated';
  data: {
    sessionId: string;
    endpointId: string;
    msgsIn: number;
    msgsOut: number;
    bytesIn: number;
    bytesOut: number;
    latency?: number;
  };
}

export interface SessionEndedEvent extends TelemetryEvent {
  type: 'sessionEnded';
  data: {
    sessionId: string;
    endpointId: string;
    reason: string;
    duration: number;
    finalStats: {
      msgsIn: number;
      msgsOut: number;
      bytesIn: number;
      bytesOut: number;
    };
  };
}

export interface MessageMetaEvent extends TelemetryEvent {
  type: 'messageMeta';
  data: {
    sessionId: string;
    endpointId: string;
    direction: 'inbound' | 'outbound';
    size: number;
    latency?: number;
  };
}

export interface SampledPayloadEvent extends TelemetryEvent {
  type: 'sampledPayload';
  data: {
    sessionId: string;
    endpointId: string;
    direction: 'inbound' | 'outbound';
    size: number;
    content: string;
    timestamp: string;
  };
}

export interface ControlCommand {
  type: string;
  data: any;
}

export interface SessionKillCommand extends ControlCommand {
  type: 'session.kill';
  data: {
    sessionId: string;
  };
}

export class TelemetryService extends EventEmitter {
  private clients = new Set<WebSocket>();
  private isShutdown = false;

  constructor() {
    super();
    this.setMaxListeners(0); // Allow unlimited listeners
  }

  addClient(ws: WebSocket): void {
    if (this.isShutdown) {
      ws.close(1001, 'Service shutting down');
      return;
    }

    this.clients.add(ws);

    ws.on('close', () => {
      this.clients.delete(ws);
      logger.debug('Telemetry client disconnected', { 
        totalClients: this.clients.size 
      });
    });

    ws.on('error', (error) => {
      logger.warn('Telemetry client error', { error });
      this.clients.delete(ws);
    });

    ws.on('message', (data) => {
      try {
        const command: ControlCommand = JSON.parse(data.toString());
        this.handleControlCommand(command);
      } catch (error) {
        logger.warn('Invalid control command received', { error, data: data.toString() });
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Invalid command format'
        }));
      }
    });

    logger.debug('Telemetry client connected', { 
      totalClients: this.clients.size 
    });

    // Send current stats to new client
    this.sendCurrentStats(ws);
  }

  private async sendCurrentStats(ws: WebSocket): Promise<void> {
    try {
      const { getSessionManager } = await import('./session-manager');
      const sessionManager = getSessionManager();
      const stats = sessionManager.getStatistics();
      const activeSessions = sessionManager.getActiveSessions();

      ws.send(JSON.stringify({
        type: 'currentStats',
        timestamp: new Date().toISOString(),
        data: {
          statistics: stats,
          activeSessions: Array.from(activeSessions.values()).map(session => ({
            sessionId: session.sessionId,
            endpointId: session.endpointId,
            startedAt: session.lastActivity,
            msgsIn: session.metrics.msgsIn,
            msgsOut: session.metrics.msgsOut,
            bytesIn: session.metrics.bytesIn,
            bytesOut: session.metrics.bytesOut,
            state: session.state
          }))
        }
      }));
    } catch (error) {
      logger.error('Failed to send current stats', { error });
    }
  }

  private async handleControlCommand(command: ControlCommand): Promise<void> {
    logger.info('Control command received', { command });

    try {
      switch (command.type) {
        case 'session.kill':
          await this.handleSessionKill(command as SessionKillCommand);
          break;
        default:
          logger.warn('Unknown control command type', { type: command.type });
          break;
      }
    } catch (error) {
      logger.error('Failed to handle control command', { error, command });
    }
  }

  private async handleSessionKill(command: SessionKillCommand): Promise<void> {
    try {
      const { getSessionManager } = await import('./session-manager');
      const sessionManager = getSessionManager();
      
      const success = await sessionManager.killSession(command.data.sessionId);
      
      this.broadcast({
        type: 'commandResult',
        timestamp: new Date().toISOString(),
        data: {
          command: 'session.kill',
          sessionId: command.data.sessionId,
          success
        }
      });

      logger.info('Session kill command executed', { 
        sessionId: command.data.sessionId,
        success 
      });
    } catch (error) {
      logger.error('Failed to kill session', { 
        error, 
        sessionId: command.data.sessionId 
      });
      
      this.broadcast({
        type: 'commandError',
        timestamp: new Date().toISOString(),
        data: {
          command: 'session.kill',
          sessionId: command.data.sessionId,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    }
  }

  broadcast(event: TelemetryEvent): void {
    if (this.isShutdown) {
      return;
    }

    const message = JSON.stringify(event);
    const deadClients = new Set<WebSocket>();

    for (const client of this.clients) {
      try {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        } else {
          deadClients.add(client);
        }
      } catch (error) {
        logger.warn('Failed to send telemetry event to client', { error });
        deadClients.add(client);
      }
    }

    // Clean up dead clients
    for (const deadClient of deadClients) {
      this.clients.delete(deadClient);
    }

    logger.debug('Telemetry event broadcasted', { 
      type: event.type,
      clientCount: this.clients.size 
    });
  }

  // Convenience methods for specific event types
  emitSessionStarted(sessionId: string, endpointId: string, clientIP: string): void {
    this.broadcast({
      type: 'sessionStarted',
      timestamp: new Date().toISOString(),
      data: { sessionId, endpointId, clientIP }
    });
  }

  emitSessionUpdated(
    sessionId: string, 
    endpointId: string, 
    msgsIn: number, 
    msgsOut: number, 
    bytesIn: number, 
    bytesOut: number,
    latency?: number
  ): void {
    this.broadcast({
      type: 'sessionUpdated',
      timestamp: new Date().toISOString(),
      data: { sessionId, endpointId, msgsIn, msgsOut, bytesIn, bytesOut, latency }
    });
  }

  emitSessionEnded(
    sessionId: string, 
    endpointId: string, 
    reason: string, 
    duration: number,
    finalStats: { msgsIn: number; msgsOut: number; bytesIn: number; bytesOut: number }
  ): void {
    this.broadcast({
      type: 'sessionEnded',
      timestamp: new Date().toISOString(),
      data: { sessionId, endpointId, reason, duration, finalStats }
    });
  }

  emitMessageMeta(
    sessionId: string, 
    endpointId: string, 
    direction: 'inbound' | 'outbound', 
    size: number,
    latency?: number
  ): void {
    this.broadcast({
      type: 'messageMeta',
      timestamp: new Date().toISOString(),
      data: { sessionId, endpointId, direction, size, latency }
    });
  }

  emitSampledPayload(
    sessionId: string, 
    endpointId: string, 
    direction: 'inbound' | 'outbound', 
    size: number, 
    content: string
  ): void {
    this.broadcast({
      type: 'sampledPayload',
      timestamp: new Date().toISOString(),
      data: { 
        sessionId, 
        endpointId, 
        direction, 
        size, 
        content,
        timestamp: new Date().toISOString()
      }
    });
  }

  getClientCount(): number {
    return this.clients.size;
  }

  async shutdown(): Promise<void> {
    logger.info('Shutting down telemetry service');
    this.isShutdown = true;

    // Close all client connections
    for (const client of this.clients) {
      try {
        client.close(1001, 'Service shutting down');
      } catch (error) {
        logger.warn('Error closing telemetry client', { error });
      }
    }

    this.clients.clear();
    this.removeAllListeners();
    
    logger.info('Telemetry service shutdown complete');
  }
}

let telemetryService: TelemetryService | null = null;

export function getTelemetryService(): TelemetryService {
  if (!telemetryService) {
    telemetryService = new TelemetryService();
  }
  return telemetryService;
}

export async function shutdownTelemetryService(): Promise<void> {
  if (telemetryService) {
    await telemetryService.shutdown();
    telemetryService = null;
  }
}