// Define audit action types
export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'ACCESS' | 'EXPORT' | 'CONFIGURE'

// Define entity types  
export type EntityType = 'user' | 'endpoint' | 'session' | 'configuration' | 'system'

// Main audit log entry interface
export interface AuditLogEntry {
  id: string
  timestamp: string
  action: AuditAction
  entityType: EntityType
  entityId: string
  userId?: string
  userName: string
  userRole: string
  ipAddress: string
  userAgent: string
  description: string
  status: 'success' | 'failure' | 'pending'
  severity: 'low' | 'medium' | 'high' | 'critical'
  metadata: Record<string, any>
  changes?: {
    before?: Record<string, any>
    after?: Record<string, any>
  }
  tags?: string[]
}

// Legacy interface for backward compatibility
export interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  details: Record<string, any>;
  timestamp: string;
}

// Filter interface for audit logs
export interface AuditLogFilter {
  actions?: AuditAction[]
  entityTypes?: EntityType[]
  userIds?: string[]
  status?: ('success' | 'failure' | 'pending')[]
  severity?: ('low' | 'medium' | 'high' | 'critical')[]
  dateFrom?: Date
  dateTo?: Date
  search?: string
}

// Legacy filters interface for backward compatibility
export interface AuditLogFilters {
  action?: string;
  entityType?: string;
  entityId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}

// Sort interface for audit logs
export interface AuditLogSort {
  field: keyof AuditLogEntry
  direction: 'asc' | 'desc'
}

// Response interface for audit log API
export interface AuditLogResponse {
  entries: AuditLogEntry[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

// Legacy response interface for backward compatibility
export interface AuditLogResponseLegacy {
  auditLogs: AuditLog[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface AuditMetadata {
  actions: string[];
  entityTypes: string[];
}

// Export request interface for audit logs
export interface AuditExportRequest {
  format: 'csv' | 'json'
  filters?: AuditLogFilter
  fields?: (keyof AuditLogEntry)[]
}