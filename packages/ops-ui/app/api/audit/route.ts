import { NextRequest, NextResponse } from 'next/server'
import { 
  AuditLogEntry, 
  AuditLogResponse, 
  AuditAction, 
  EntityType,
  AuditLogFilter,
  AuditLogSort
} from '@/lib/types/audit'

// Mock data for demonstration - in production, this would connect to your actual audit database
const generateMockAuditData = (): AuditLogEntry[] => {
  const actions: AuditAction[] = ['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'ACCESS', 'EXPORT', 'CONFIGURE']
  const entityTypes: EntityType[] = ['user', 'endpoint', 'session', 'configuration', 'system']
  const users = [
    { id: '1', name: 'John Admin', role: 'admin' },
    { id: '2', name: 'Jane Operator', role: 'operator' },
    { id: '3', name: 'Bob Viewer', role: 'viewer' },
    { id: '4', name: 'Alice Engineer', role: 'operator' }
  ]
  const statuses: ('success' | 'failure' | 'pending')[] = ['success', 'failure', 'pending']
  const severities: ('low' | 'medium' | 'high' | 'critical')[] = ['low', 'medium', 'high', 'critical']

  const entries: AuditLogEntry[] = []
  
  for (let i = 0; i < 500; i++) {
    const user = users[Math.floor(Math.random() * users.length)]
    const action = actions[Math.floor(Math.random() * actions.length)]
    const entityType = entityTypes[Math.floor(Math.random() * entityTypes.length)]
    const status = Math.random() > 0.1 ? 'success' : Math.random() > 0.5 ? 'failure' : 'pending'
    const severity = status === 'failure' ? 
      (Math.random() > 0.5 ? 'high' : 'critical') :
      severities[Math.floor(Math.random() * severities.length)]

    const timestamp = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000) // Last 30 days

    const entry: AuditLogEntry = {
      id: `audit_${i + 1}`,
      timestamp: timestamp.toISOString(),
      action,
      entityType,
      entityId: `${entityType}_${Math.floor(Math.random() * 1000)}`,
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      ipAddress: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      description: generateDescription(action, entityType, user.name),
      status,
      severity,
      metadata: generateMetadata(action, entityType),
      changes: generateChanges(action),
      tags: generateTags(action, entityType, severity)
    }

    entries.push(entry)
  }

  return entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
}

function generateDescription(action: AuditAction, entityType: EntityType, userName: string): string {
  const descriptions: Record<string, string> = {
    'CREATE': `${userName} created a new ${entityType}`,
    'UPDATE': `${userName} updated ${entityType} configuration`,
    'DELETE': `${userName} deleted ${entityType}`,
    'LOGIN': `${userName} logged into the system`,
    'LOGOUT': `${userName} logged out of the system`,
    'ACCESS': `${userName} accessed ${entityType} data`,
    'EXPORT': `${userName} exported ${entityType} data`,
    'CONFIGURE': `${userName} modified ${entityType} settings`
  }
  return descriptions[action] || `${userName} performed ${action} on ${entityType}`
}

function generateMetadata(action: AuditAction, entityType: EntityType): Record<string, any> {
  const metadata: Record<string, any> = {
    source: 'ops-ui',
    sessionId: `session_${Math.random().toString(36).substr(2, 9)}`,
    requestId: `req_${Math.random().toString(36).substr(2, 9)}`
  }

  if (action === 'LOGIN' || action === 'LOGOUT') {
    metadata.loginMethod = 'credentials'
    metadata.sessionDuration = Math.floor(Math.random() * 3600) // seconds
  }

  if (entityType === 'endpoint') {
    metadata.endpointUrl = `wss://example.com:${8000 + Math.floor(Math.random() * 1000)}`
    metadata.protocol = 'websocket'
  }

  return metadata
}

function generateChanges(action: AuditAction): { before?: Record<string, any>, after?: Record<string, any> } | undefined {
  if (action === 'CREATE') {
    return {
      after: {
        name: `Resource ${Math.floor(Math.random() * 1000)}`,
        enabled: true,
        createdAt: new Date().toISOString()
      }
    }
  }

  if (action === 'UPDATE') {
    return {
      before: {
        name: 'Old Resource Name',
        enabled: false,
        timeout: 30
      },
      after: {
        name: 'New Resource Name',
        enabled: true,
        timeout: 60
      }
    }
  }

  if (action === 'DELETE') {
    return {
      before: {
        name: `Deleted Resource ${Math.floor(Math.random() * 1000)}`,
        enabled: true,
        deletedAt: new Date().toISOString()
      }
    }
  }

  return undefined
}

function generateTags(action: AuditAction, entityType: EntityType, severity: string): string[] {
  const tags = [action.toLowerCase(), entityType]
  
  if (severity === 'high' || severity === 'critical') {
    tags.push('security-relevant')
  }
  
  if (action === 'DELETE') {
    tags.push('destructive')
  }
  
  if (action === 'LOGIN' || action === 'LOGOUT') {
    tags.push('authentication')
  }

  return tags
}

// Cache for mock data
let mockData: AuditLogEntry[] | null = null

function getMockData(): AuditLogEntry[] {
  if (!mockData) {
    mockData = generateMockAuditData()
  }
  return mockData
}

function applyFilters(entries: AuditLogEntry[], filter: AuditLogFilter): AuditLogEntry[] {
  return entries.filter(entry => {
    // Action filter
    if (filter.actions?.length && !filter.actions.includes(entry.action)) {
      return false
    }

    // Entity type filter
    if (filter.entityTypes?.length && !filter.entityTypes.includes(entry.entityType)) {
      return false
    }

    // User filter
    if (filter.userIds?.length && entry.userId && !filter.userIds.includes(entry.userId)) {
      return false
    }

    // Status filter
    if (filter.status?.length && !filter.status.includes(entry.status)) {
      return false
    }

    // Severity filter
    if (filter.severity?.length && !filter.severity.includes(entry.severity)) {
      return false
    }

    // Date range filter
    const entryDate = new Date(entry.timestamp)
    if (filter.dateFrom && entryDate < filter.dateFrom) {
      return false
    }
    if (filter.dateTo && entryDate > filter.dateTo) {
      return false
    }

    // Search filter
    if (filter.search) {
      const searchLower = filter.search.toLowerCase()
      const searchableFields = [
        entry.action,
        entry.entityType,
        entry.entityId,
        entry.userName,
        entry.userRole,
        entry.description,
        entry.ipAddress,
        entry.status,
        entry.severity
      ]
      
      const matches = searchableFields.some(field => 
        field?.toLowerCase().includes(searchLower)
      ) || (entry.tags && entry.tags.some(tag => 
        tag.toLowerCase().includes(searchLower)
      ))

      if (!matches) return false
    }

    return true
  })
}

function applySorting(entries: AuditLogEntry[], sort?: AuditLogSort): AuditLogEntry[] {
  if (!sort) {
    return entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }

  return [...entries].sort((a, b) => {
    const aValue = a[sort.field]
    const bValue = b[sort.field]

    if (sort.field === 'timestamp') {
      const aTime = new Date(aValue as string).getTime()
      const bTime = new Date(bValue as string).getTime()
      return sort.direction === 'asc' ? aTime - bTime : bTime - aTime
    }

    const aStr = String(aValue || '').toLowerCase()
    const bStr = String(bValue || '').toLowerCase()

    if (sort.direction === 'asc') {
      return aStr.localeCompare(bStr)
    } else {
      return bStr.localeCompare(aStr)
    }
  })
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '50')

    // Parse filters
    const filter: AuditLogFilter = {}
    
    if (searchParams.get('actions')) {
      filter.actions = searchParams.get('actions')!.split(',') as AuditAction[]
    }
    
    if (searchParams.get('entityTypes')) {
      filter.entityTypes = searchParams.get('entityTypes')!.split(',') as EntityType[]
    }
    
    if (searchParams.get('userIds')) {
      filter.userIds = searchParams.get('userIds')!.split(',')
    }
    
    if (searchParams.get('status')) {
      filter.status = searchParams.get('status')!.split(',') as ('success' | 'failure' | 'pending')[]
    }
    
    if (searchParams.get('severity')) {
      filter.severity = searchParams.get('severity')!.split(',') as ('low' | 'medium' | 'high' | 'critical')[]
    }
    
    if (searchParams.get('dateFrom')) {
      filter.dateFrom = new Date(searchParams.get('dateFrom')!)
    }
    
    if (searchParams.get('dateTo')) {
      filter.dateTo = new Date(searchParams.get('dateTo')!)
    }
    
    if (searchParams.get('search')) {
      filter.search = searchParams.get('search')!
    }

    // Parse sorting
    let sort: AuditLogSort | undefined
    if (searchParams.get('sortField')) {
      sort = {
        field: searchParams.get('sortField') as keyof AuditLogEntry,
        direction: (searchParams.get('sortDirection') || 'desc') as 'asc' | 'desc'
      }
    }

    // Get and process data
    const allEntries = getMockData()
    const filteredEntries = applyFilters(allEntries, filter)
    const sortedEntries = applySorting(filteredEntries, sort)

    // Apply pagination
    const startIndex = (page - 1) * pageSize
    const endIndex = startIndex + pageSize
    const paginatedEntries = sortedEntries.slice(startIndex, endIndex)

    const response: AuditLogResponse = {
      entries: paginatedEntries,
      total: filteredEntries.length,
      page,
      pageSize,
      hasMore: endIndex < filteredEntries.length
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Audit log API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch audit logs' },
      { status: 500 }
    )
  }
}