import { NextRequest, NextResponse } from 'next/server'
import { AuditLogEntry, AuditLogFilter, AuditExportRequest } from '@/lib/types/audit'

// Import the same mock data and filtering logic from the main route
// In a real application, this would be extracted to a shared service
function generateMockAuditData(): AuditLogEntry[] {
  // This is a simplified version - in production you'd import from a shared service
  const entries: AuditLogEntry[] = []
  
  // Generate some sample data for export
  for (let i = 0; i < 100; i++) {
    const entry: AuditLogEntry = {
      id: `audit_${i + 1}`,
      timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
      action: ['CREATE', 'UPDATE', 'DELETE', 'LOGIN'][Math.floor(Math.random() * 4)] as any,
      entityType: ['user', 'endpoint', 'session'][Math.floor(Math.random() * 3)] as any,
      entityId: `entity_${i}`,
      userId: `user_${Math.floor(Math.random() * 5) + 1}`,
      userName: `User ${Math.floor(Math.random() * 5) + 1}`,
      userRole: ['admin', 'operator', 'viewer'][Math.floor(Math.random() * 3)] as any,
      ipAddress: `192.168.1.${Math.floor(Math.random() * 255)}`,
      userAgent: 'Mozilla/5.0 (Sample Browser)',
      description: `Sample audit log entry ${i + 1}`,
      status: ['success', 'failure'][Math.floor(Math.random() * 2)] as any,
      severity: ['low', 'medium', 'high', 'critical'][Math.floor(Math.random() * 4)] as any,
      metadata: { sample: true, entryId: i + 1 },
      tags: ['sample', 'export']
    }
    entries.push(entry)
  }
  
  return entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
}

function applyFilters(entries: AuditLogEntry[], filter: AuditLogFilter): AuditLogEntry[] {
  return entries.filter(entry => {
    if (filter.actions?.length && !filter.actions.includes(entry.action)) return false
    if (filter.entityTypes?.length && !filter.entityTypes.includes(entry.entityType)) return false
    if (filter.userIds?.length && entry.userId && !filter.userIds.includes(entry.userId)) return false
    if (filter.status?.length && !filter.status.includes(entry.status)) return false
    if (filter.severity?.length && !filter.severity.includes(entry.severity)) return false
    
    const entryDate = new Date(entry.timestamp)
    if (filter.dateFrom && entryDate < filter.dateFrom) return false
    if (filter.dateTo && entryDate > filter.dateTo) return false
    
    if (filter.search) {
      const searchLower = filter.search.toLowerCase()
      const searchableFields = [
        entry.action, entry.entityType, entry.entityId, entry.userName,
        entry.userRole, entry.description, entry.ipAddress, entry.status, entry.severity
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

function exportToCsv(entries: AuditLogEntry[], fields?: (keyof AuditLogEntry)[]): string {
  const defaultFields: (keyof AuditLogEntry)[] = [
    'timestamp', 'action', 'entityType', 'entityId', 
    'userName', 'userRole', 'description', 'status', 'severity', 'ipAddress'
  ]
  
  const exportFields = fields || defaultFields
  const headers = exportFields.map(field => field.toString()).join(',')
  
  const rows = entries.map(entry => 
    exportFields.map(field => {
      const value = entry[field]
      if (value === null || value === undefined) return ''
      if (typeof value === 'object') return `"${JSON.stringify(value).replace(/"/g, '""')}"`
      return `"${String(value).replace(/"/g, '""')}"`
    }).join(',')
  )
  
  return [headers, ...rows].join('\n')
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const format = searchParams.get('format') || 'json'
    
    // Parse filters (same as main route)
    const filter: AuditLogFilter = {}
    
    if (searchParams.get('actions')) {
      filter.actions = searchParams.get('actions')!.split(',') as any[]
    }
    if (searchParams.get('entityTypes')) {
      filter.entityTypes = searchParams.get('entityTypes')!.split(',') as any[]
    }
    if (searchParams.get('userIds')) {
      filter.userIds = searchParams.get('userIds')!.split(',')
    }
    if (searchParams.get('status')) {
      filter.status = searchParams.get('status')!.split(',') as any[]
    }
    if (searchParams.get('severity')) {
      filter.severity = searchParams.get('severity')!.split(',') as any[]
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
    
    // Parse fields for export
    const fields = searchParams.get('fields')?.split(',') as (keyof AuditLogEntry)[] || undefined
    
    // Get and filter data
    const allEntries = generateMockAuditData()
    const filteredEntries = applyFilters(allEntries, filter)
    
    if (format === 'csv') {
      const csvData = exportToCsv(filteredEntries, fields)
      const filename = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`
      
      return new NextResponse(csvData, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      })
    } else {
      // JSON format
      const filename = `audit-logs-${new Date().toISOString().split('T')[0]}.json`
      const jsonData = JSON.stringify({
        exportedAt: new Date().toISOString(),
        totalRecords: filteredEntries.length,
        filters: filter,
        entries: filteredEntries
      }, null, 2)
      
      return new NextResponse(jsonData, {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      })
    }
  } catch (error) {
    console.error('Audit export error:', error)
    return NextResponse.json(
      { error: 'Failed to export audit logs' },
      { status: 500 }
    )
  }
}