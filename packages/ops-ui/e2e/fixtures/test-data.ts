// Test data and mock data for E2E tests

export const TEST_ADMIN_CREDENTIALS = {
  email: 'admin@example.com',
  password: 'admin123'
}

export const INVALID_CREDENTIALS = [
  {
    email: 'invalid@example.com',
    password: 'wrongpassword',
    expectedError: 'Invalid credentials'
  },
  {
    email: 'notanemail',
    password: 'admin123',
    expectedError: 'Please enter a valid email address'
  },
  {
    email: 'admin@example.com',
    password: 'short',
    expectedError: 'Password must be at least 8 characters'
  },
  {
    email: '',
    password: 'admin123',
    expectedError: 'Email is required'
  },
  {
    email: 'admin@example.com',
    password: '',
    expectedError: 'Password is required'
  }
]

export const MOCK_ENDPOINTS = [
  {
    id: 'endpoint-1',
    name: 'Test WebSocket Endpoint',
    targetUrl: 'wss://echo.websocket.org',
    enabled: true,
    limits: {
      maxConnections: 100,
      maxMessageSize: 1024,
      connectionTimeoutMs: 30000,
      idleTimeoutMs: 60000,
      rateLimitRpm: 100
    },
    sampling: {
      enabled: true,
      sampleRate: 0.1,
      maxSampleSize: 1000,
      storeContent: true
    },
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z')
  },
  {
    id: 'endpoint-2',
    name: 'Production API Gateway',
    targetUrl: 'wss://api.production.com/ws',
    enabled: false,
    limits: {
      maxConnections: 1000,
      maxMessageSize: 2048,
      connectionTimeoutMs: 45000,
      idleTimeoutMs: 120000,
      rateLimitRpm: 500
    },
    sampling: {
      enabled: false,
      sampleRate: 0.05,
      maxSampleSize: 500,
      storeContent: false
    },
    createdAt: new Date('2024-01-15T00:00:00Z'),
    updatedAt: new Date('2024-01-20T00:00:00Z')
  }
]

export const VALID_ENDPOINT_DATA = {
  name: 'New Test Endpoint',
  targetUrl: 'wss://test.example.com/websocket',
  enabled: true,
  limits: {
    maxConnections: 50,
    maxMessageSize: 512,
    connectionTimeoutMs: 15000,
    idleTimeoutMs: 30000,
    rateLimitRpm: 60
  },
  sampling: {
    enabled: true,
    sampleRate: 0.2,
    maxSampleSize: 100,
    storeContent: true
  }
}

export const INVALID_ENDPOINT_DATA = [
  {
    name: '',
    targetUrl: 'wss://test.example.com',
    expectedErrors: ['Name is required']
  },
  {
    name: 'Test',
    targetUrl: '',
    expectedErrors: ['Target URL is required']
  },
  {
    name: 'Test',
    targetUrl: 'invalid-url',
    expectedErrors: ['Please enter a valid WebSocket URL']
  },
  {
    name: 'Test',
    targetUrl: 'http://example.com',
    expectedErrors: ['URL must use ws:// or wss:// protocol']
  },
  {
    name: 'Test',
    targetUrl: 'wss://test.example.com',
    limits: {
      maxConnections: -1
    },
    expectedErrors: ['Max connections must be a positive number']
  },
  {
    name: 'Test',
    targetUrl: 'wss://test.example.com',
    sampling: {
      sampleRate: 1.5
    },
    expectedErrors: ['Sample rate must be between 0 and 1']
  }
]

export const MOCK_TRAFFIC_DATA = {
  sessions: [
    {
      id: 'session-1',
      endpointId: 'endpoint-1',
      startedAt: new Date(Date.now() - 30000),
      lastSeen: new Date(),
      msgsIn: 25,
      msgsOut: 20,
      bytesIn: 5120n,
      bytesOut: 4096n,
      state: 'connected' as const
    },
    {
      id: 'session-2',
      endpointId: 'endpoint-1',
      startedAt: new Date(Date.now() - 60000),
      lastSeen: new Date(Date.now() - 5000),
      msgsIn: 10,
      msgsOut: 8,
      bytesIn: 2048n,
      bytesOut: 1536n,
      state: 'closing' as const
    }
  ],
  metrics: {
    totalConnections: 150,
    activeConnections: 45,
    messagesPerSecond: 12.5,
    bytesPerSecond: 2048,
    errorRate: 0.02
  }
}

export const MOCK_AUDIT_LOGS = [
  {
    id: 'audit-1',
    action: 'endpoint.created',
    resourceType: 'endpoint',
    resourceId: 'endpoint-1',
    userId: 'admin-1',
    userEmail: 'admin@example.com',
    details: {
      name: 'New Endpoint',
      targetUrl: 'wss://test.example.com'
    },
    timestamp: new Date(Date.now() - 3600000),
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0 (Chrome/120.0.0.0)'
  },
  {
    id: 'audit-2',
    action: 'endpoint.updated',
    resourceType: 'endpoint',
    resourceId: 'endpoint-1',
    userId: 'admin-1',
    userEmail: 'admin@example.com',
    details: {
      changes: {
        enabled: { from: false, to: true }
      }
    },
    timestamp: new Date(Date.now() - 1800000),
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0 (Chrome/120.0.0.0)'
  }
]

export const API_ENDPOINTS = {
  AUTH: '/api/auth',
  ENDPOINTS: '/api/endpoints',
  AUDIT: '/api/audit',
  SESSIONS: '/api/sessions',
  HEALTHZ: '/api/healthz'
}

export const ROUTE_PATHS = {
  LOGIN: '/login',
  DASHBOARD: '/dashboard',
  ENDPOINTS: '/endpoints',
  ENDPOINTS_NEW: '/endpoints/new',
  TRAFFIC: '/traffic',
  AUDIT: '/audit',
  UNAUTHORIZED: '/unauthorized'
}