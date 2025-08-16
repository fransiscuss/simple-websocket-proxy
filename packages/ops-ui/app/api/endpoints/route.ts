import { NextRequest, NextResponse } from 'next/server'

// Mock data for development
const mockEndpoints = [
  {
    id: 'endpoint-1',
    name: 'Production WebSocket',
    targetUrl: 'wss://api.example.com/websocket',
    enabled: true,
    limits: {
      maxConnections: 100,
      maxMessageSize: 1048576,
      connectionTimeoutMs: 30000,
      idleTimeoutMs: 300000,
      rateLimitRpm: 1000,
    },
    sampling: {
      enabled: true,
      sampleRate: 0.1,
      maxSampleSize: 4096,
      storeContent: false,
    },
    createdAt: new Date('2024-01-15T10:00:00Z'),
    updatedAt: new Date('2024-01-20T14:30:00Z'),
  },
  {
    id: 'endpoint-2',
    name: 'Development Server',
    targetUrl: 'ws://localhost:8080/websocket',
    enabled: false,
    limits: {
      maxConnections: 10,
      maxMessageSize: 512000,
    },
    sampling: {
      enabled: false,
      storeContent: false,
    },
    createdAt: new Date('2024-01-10T09:15:00Z'),
    updatedAt: new Date('2024-01-18T16:45:00Z'),
  },
  {
    id: 'endpoint-3',
    name: 'Testing Environment',
    targetUrl: 'wss://test-api.example.com/ws',
    enabled: true,
    limits: {
      maxConnections: 50,
      maxMessageSize: 2097152,
      connectionTimeoutMs: 60000,
      rateLimitRpm: 500,
    },
    sampling: {
      enabled: true,
      sampleRate: 0.5,
      maxSampleSize: 8192,
      storeContent: true,
    },
    createdAt: new Date('2024-01-12T11:30:00Z'),
    updatedAt: new Date('2024-01-22T08:20:00Z'),
  },
]

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '10')
  const search = searchParams.get('search')
  const enabled = searchParams.get('enabled')

  // Filter endpoints based on search and enabled status
  let filteredEndpoints = mockEndpoints

  if (search) {
    filteredEndpoints = filteredEndpoints.filter(endpoint =>
      endpoint.name.toLowerCase().includes(search.toLowerCase()) ||
      endpoint.targetUrl.toLowerCase().includes(search.toLowerCase())
    )
  }

  if (enabled !== null) {
    const isEnabled = enabled === 'true'
    filteredEndpoints = filteredEndpoints.filter(endpoint => endpoint.enabled === isEnabled)
  }

  // Pagination
  const total = filteredEndpoints.length
  const startIndex = (page - 1) * limit
  const endIndex = startIndex + limit
  const paginatedEndpoints = filteredEndpoints.slice(startIndex, endIndex)

  return NextResponse.json({
    endpoints: paginatedEndpoints,
    total,
    page,
    limit,
    hasNext: endIndex < total,
    hasPrev: page > 1,
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Mock endpoint creation
    const newEndpoint = {
      id: `endpoint-${Date.now()}`,
      ...body,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    // In a real implementation, this would save to database
    console.log('Creating endpoint:', newEndpoint)

    return NextResponse.json({ endpoint: newEndpoint }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { message: 'Invalid request body' },
      { status: 400 }
    )
  }
}