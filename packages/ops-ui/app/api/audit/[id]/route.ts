import { NextRequest, NextResponse } from 'next/server'
import { AuditLogEntry } from '@/lib/types/audit'

// Mock data for individual audit log entry
function getMockAuditEntry(id: string): AuditLogEntry | null {
  // In production, this would query your database
  const mockEntry: AuditLogEntry = {
    id,
    timestamp: new Date().toISOString(),
    action: 'UPDATE',
    entityType: 'endpoint',
    entityId: 'endpoint_123',
    userId: 'user_1',
    userName: 'John Admin',
    userRole: 'admin',
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    description: 'Updated endpoint configuration for enhanced security',
    status: 'success',
    severity: 'medium',
    metadata: {
      source: 'ops-ui',
      sessionId: 'session_abc123',
      requestId: 'req_xyz789',
      endpointUrl: 'wss://api.example.com:8080',
      protocol: 'websocket',
      changes: ['timeout', 'retries', 'ssl_verify'],
      affectedConnections: 15,
      backupCreated: true
    },
    changes: {
      before: {
        name: 'Production API Endpoint',
        url: 'wss://api.example.com:8080',
        timeout: 30,
        retries: 3,
        sslVerify: false,
        enabled: true,
        rateLimit: 1000,
        maxConnections: 50
      },
      after: {
        name: 'Production API Endpoint',
        url: 'wss://api.example.com:8080',
        timeout: 60,
        retries: 5,
        sslVerify: true,
        enabled: true,
        rateLimit: 1000,
        maxConnections: 50
      }
    },
    tags: ['configuration', 'security', 'endpoint-management', 'production']
  }

  // Return null if not found (in production, check database)
  return mockEntry
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    
    if (!id) {
      return NextResponse.json(
        { error: 'Audit log ID is required' },
        { status: 400 }
      )
    }

    const entry = getMockAuditEntry(id)
    
    if (!entry) {
      return NextResponse.json(
        { error: 'Audit log entry not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(entry)
  } catch (error) {
    console.error('Get audit entry error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch audit log entry' },
      { status: 500 }
    )
  }
}