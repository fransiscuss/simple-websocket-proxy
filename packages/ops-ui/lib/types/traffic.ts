export interface SessionMetrics {
  messagesIn: number
  messagesOut: number
  bytesIn: number
  bytesOut: number
  latencyMs: number
  lastActivityAt: string
}

export interface SessionInfo {
  id: string
  clientEndpoint: string
  targetEndpoint: string
  clientIp: string
  userAgent?: string
  startedAt: string
  status: 'active' | 'closing' | 'closed' | 'error'
  metrics: SessionMetrics
  tags?: string[]
}

export interface MessageSample {
  id: string
  sessionId: string
  direction: 'inbound' | 'outbound'
  timestamp: string
  size: number
  type: 'text' | 'binary'
  preview?: string // First 100 chars for text messages
}

export interface TelemetryEvent {
  type: 'sessionStarted' | 'sessionUpdated' | 'sessionEnded' | 'messageMeta'
  timestamp: string
  data: any
}

export interface SessionStartedEvent extends TelemetryEvent {
  type: 'sessionStarted'
  data: {
    session: SessionInfo
  }
}

export interface SessionUpdatedEvent extends TelemetryEvent {
  type: 'sessionUpdated'
  data: {
    sessionId: string
    metrics: Partial<SessionMetrics>
  }
}

export interface SessionEndedEvent extends TelemetryEvent {
  type: 'sessionEnded'
  data: {
    sessionId: string
    reason: 'client_disconnect' | 'target_disconnect' | 'error' | 'killed'
    finalMetrics: SessionMetrics
  }
}

export interface MessageMetaEvent extends TelemetryEvent {
  type: 'messageMeta'
  data: {
    sessionId: string
    direction: 'inbound' | 'outbound'
    size: number
    type: 'text' | 'binary'
    preview?: string
  }
}

export type TrafficTelemetryEvent = 
  | SessionStartedEvent 
  | SessionUpdatedEvent 
  | SessionEndedEvent 
  | MessageMetaEvent

export interface TrafficOverviewData {
  totalConnections: number
  activeConnections: number
  totalBytesTransferred: number
  totalMessages: number
  averageLatency: number
  uptime: number
  errorRate: number
}

export interface TrafficStats {
  connectionsPerSecond: number
  messagesPerSecond: number
  bytesPerSecond: number
  timestamp: string
}

export interface WebSocketConnectionState {
  status: 'connecting' | 'connected' | 'disconnected' | 'error'
  lastConnected?: string
  reconnectAttempts: number
  error?: string
}

export interface ControlCommand {
  type: 'killSession' | 'killAllSessions' | 'getSessionDetails'
  sessionId?: string
  timestamp: string
}

export interface SessionDetailsResponse {
  session: SessionInfo
  recentMessages: MessageSample[]
  metrics: SessionMetrics
}