import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Mock endpoint statistics
  const mockStats = {
    endpointId: params.id,
    activeConnections: Math.floor(Math.random() * 50),
    totalConnections: Math.floor(Math.random() * 1000) + 500,
    messagesIn: Math.floor(Math.random() * 10000) + 5000,
    messagesOut: Math.floor(Math.random() * 10000) + 5000,
    bytesIn: BigInt(Math.floor(Math.random() * 1000000) + 500000),
    bytesOut: BigInt(Math.floor(Math.random() * 1000000) + 500000),
    avgConnectionDuration: Math.floor(Math.random() * 300000) + 60000, // 1-6 minutes
    errorRate: Math.random() * 0.05, // 0-5% error rate
    lastActivity: new Date(Date.now() - Math.floor(Math.random() * 3600000)), // Within last hour
  }

  return NextResponse.json(mockStats)
}