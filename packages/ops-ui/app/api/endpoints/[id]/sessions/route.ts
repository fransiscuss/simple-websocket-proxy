import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '50')

  // Mock active sessions
  const mockSessions = Array.from({ length: Math.floor(Math.random() * 20) + 5 }, (_, i) => ({
    id: `session-${params.id}-${i + 1}`,
    endpointId: params.id,
    startedAt: new Date(Date.now() - Math.floor(Math.random() * 3600000)), // Started within last hour
    lastSeen: new Date(Date.now() - Math.floor(Math.random() * 60000)), // Active within last minute
    msgsIn: Math.floor(Math.random() * 100),
    msgsOut: Math.floor(Math.random() * 100),
    bytesIn: BigInt(Math.floor(Math.random() * 50000)),
    bytesOut: BigInt(Math.floor(Math.random() * 50000)),
    state: ['connected', 'connecting', 'closing'][Math.floor(Math.random() * 3)] as 'connected' | 'connecting' | 'closing',
  }))

  // Pagination
  const total = mockSessions.length
  const startIndex = (page - 1) * limit
  const endIndex = startIndex + limit
  const paginatedSessions = mockSessions.slice(startIndex, endIndex)

  return NextResponse.json({
    sessions: paginatedSessions,
    total,
  })
}