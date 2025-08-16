import { AuditLog, AuditLogFilters, AuditLogResponse, AuditLogResponseLegacy, AuditMetadata } from '@/lib/types/audit';
import { apiClient } from './client';

export const auditApi = {
  async getAuditLogs(
    page: number = 1,
    limit: number = 50,
    filters: AuditLogFilters = {}
  ): Promise<AuditLogResponse | AuditLogResponseLegacy> {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      ...Object.fromEntries(
        Object.entries(filters).filter(([_, value]) => value !== undefined && value !== '')
      ),
    });

    const response = await apiClient.get(`/api/audit?${params}`);
    return response.json();
  },

  async getAuditMetadata(): Promise<AuditMetadata> {
    const [actionsResponse, entityTypesResponse] = await Promise.all([
      apiClient.get('/api/audit/actions'),
      apiClient.get('/api/audit/entity-types'),
    ]);

    const [actionsData, entityTypesData] = await Promise.all([
      actionsResponse.json(),
      entityTypesResponse.json(),
    ]);

    return {
      actions: actionsData.actions || [],
      entityTypes: entityTypesData.entityTypes || [],
    };
  },

  async exportAuditLogs(
    format: 'csv' | 'json',
    filters: AuditLogFilters = {}
  ): Promise<Blob> {
    const params = new URLSearchParams({
      format,
      ...Object.fromEntries(
        Object.entries(filters).filter(([_, value]) => value !== undefined && value !== '')
      ),
    });

    const response = await apiClient.get(`/api/audit/export?${params}`);
    return response.blob();
  },
};