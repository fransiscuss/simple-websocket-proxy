// Endpoint configuration types
export interface EndpointLimits {
  maxConnections?: number
  maxMessageSize?: number
  connectionTimeoutMs?: number
  idleTimeoutMs?: number
  rateLimitRpm?: number
}

export interface EndpointSampling {
  enabled: boolean
  sampleRate?: number // 0.0 to 1.0
  maxSampleSize?: number
  storeContent?: boolean
}

export interface Endpoint {
  id: string
  name: string
  targetUrl: string
  limits: EndpointLimits
  sampling: EndpointSampling
  enabled: boolean
  createdAt: Date
  updatedAt: Date
}

// Form types for creating/editing endpoints
export interface CreateEndpointRequest {
  name: string
  targetUrl: string
  limits: EndpointLimits
  sampling: EndpointSampling
  enabled: boolean
}

export interface UpdateEndpointRequest {
  name?: string
  targetUrl?: string
  limits?: EndpointLimits
  sampling?: EndpointSampling
  enabled?: boolean
}

// API response types
export interface EndpointListResponse {
  endpoints: Endpoint[]
  total: number
  page: number
  limit: number
  hasNext: boolean
  hasPrev: boolean
}

export interface EndpointResponse {
  endpoint: Endpoint
}

export interface EndpointStatsResponse {
  endpointId: string
  activeConnections: number
  totalConnections: number
  messagesIn: number
  messagesOut: number
  bytesIn: bigint
  bytesOut: bigint
  avgConnectionDuration: number
  errorRate: number
  lastActivity: Date | null
}

export interface EndpointSessionResponse {
  sessions: Array<{
    id: string
    endpointId: string
    startedAt: Date
    lastSeen: Date
    msgsIn: number
    msgsOut: number
    bytesIn: bigint
    bytesOut: bigint
    state: 'connecting' | 'connected' | 'closing' | 'closed'
  }>
  total: number
}

// Query parameters for filtering/pagination
export interface EndpointListParams {
  page?: number
  limit?: number
  search?: string
  enabled?: boolean
  sortBy?: 'name' | 'createdAt' | 'updatedAt' | 'activeConnections'
  sortOrder?: 'asc' | 'desc'
}

// Validation schemas
export interface EndpointValidationErrors {
  name?: string[]
  targetUrl?: string[]
  'limits.maxConnections'?: string[]
  'limits.maxMessageSize'?: string[]
  'limits.connectionTimeoutMs'?: string[]
  'limits.idleTimeoutMs'?: string[]
  'limits.rateLimitRpm'?: string[]
  'sampling.sampleRate'?: string[]
  'sampling.maxSampleSize'?: string[]
}

// UI state types
export interface EndpointTableRow extends Endpoint {
  activeConnections?: number
  totalConnections?: number
  lastActivity?: Date | null
  status: 'online' | 'offline' | 'error'
}

export type EndpointAction = 'view' | 'edit' | 'delete' | 'enable' | 'disable' | 'clone'

// Form field types
export interface EndpointFormData {
  name: string
  targetUrl: string
  enabled: boolean
  limits: {
    maxConnections: number | undefined
    maxMessageSize: number | undefined
    connectionTimeoutMs: number | undefined
    idleTimeoutMs: number | undefined
    rateLimitRpm: number | undefined
  }
  sampling: {
    enabled: boolean
    sampleRate: number | undefined
    maxSampleSize: number | undefined
    storeContent: boolean
  }
}