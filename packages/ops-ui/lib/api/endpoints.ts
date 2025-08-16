import type {
  Endpoint,
  CreateEndpointRequest,
  UpdateEndpointRequest,
  EndpointListResponse,
  EndpointResponse,
  EndpointStatsResponse,
  EndpointSessionResponse,
  EndpointListParams,
} from '@/lib/types/endpoint'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080'

class EndpointApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public details?: any
  ) {
    super(message)
    this.name = 'EndpointApiError'
  }
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`
  
  const defaultHeaders = {
    'Content-Type': 'application/json',
  }

  const config: RequestInit = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  }

  try {
    const response = await fetch(url, config)
    
    if (!response.ok) {
      let errorMessage = `Request failed with status ${response.status}`
      let errorDetails = null
      
      try {
        const errorData = await response.json()
        errorMessage = errorData.message || errorMessage
        errorDetails = errorData.details || errorData
      } catch {
        // Ignore JSON parsing errors for error responses
      }
      
      throw new EndpointApiError(
        errorMessage,
        response.status,
        response.statusText,
        errorDetails
      )
    }

    // Handle 204 No Content responses
    if (response.status === 204) {
      return {} as T
    }

    return await response.json()
  } catch (error) {
    if (error instanceof EndpointApiError) {
      throw error
    }
    
    // Network or other errors
    throw new EndpointApiError(
      error instanceof Error ? error.message : 'Network error',
      0,
      'NETWORK_ERROR'
    )
  }
}

export const endpointApi = {
  // List endpoints with optional filtering and pagination
  async list(params: EndpointListParams = {}): Promise<EndpointListResponse> {
    const searchParams = new URLSearchParams()
    
    if (params.page !== undefined) searchParams.set('page', params.page.toString())
    if (params.limit !== undefined) searchParams.set('limit', params.limit.toString())
    if (params.search) searchParams.set('search', params.search)
    if (params.enabled !== undefined) searchParams.set('enabled', params.enabled.toString())
    if (params.sortBy) searchParams.set('sortBy', params.sortBy)
    if (params.sortOrder) searchParams.set('sortOrder', params.sortOrder)

    const query = searchParams.toString()
    const endpoint = `/api/endpoints${query ? `?${query}` : ''}`
    
    return apiRequest<EndpointListResponse>(endpoint)
  },

  // Get a single endpoint by ID
  async get(id: string): Promise<EndpointResponse> {
    return apiRequest<EndpointResponse>(`/api/endpoints/${id}`)
  },

  // Create a new endpoint
  async create(data: CreateEndpointRequest): Promise<EndpointResponse> {
    return apiRequest<EndpointResponse>('/api/endpoints', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  // Update an existing endpoint
  async update(id: string, data: UpdateEndpointRequest): Promise<EndpointResponse> {
    return apiRequest<EndpointResponse>(`/api/endpoints/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },

  // Delete an endpoint
  async delete(id: string): Promise<void> {
    await apiRequest<void>(`/api/endpoints/${id}`, {
      method: 'DELETE',
    })
  },

  // Enable/disable an endpoint
  async setEnabled(id: string, enabled: boolean): Promise<EndpointResponse> {
    return apiRequest<EndpointResponse>(`/api/endpoints/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ enabled }),
    })
  },

  // Get endpoint statistics
  async getStats(id: string): Promise<EndpointStatsResponse> {
    return apiRequest<EndpointStatsResponse>(`/api/endpoints/${id}/stats`)
  },

  // Get active sessions for an endpoint
  async getSessions(id: string, page = 1, limit = 50): Promise<EndpointSessionResponse> {
    const searchParams = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    })
    
    return apiRequest<EndpointSessionResponse>(`/api/endpoints/${id}/sessions?${searchParams}`)
  },

  // Test endpoint connectivity
  async testConnection(targetUrl: string): Promise<{ success: boolean; message: string; responseTime?: number }> {
    return apiRequest<{ success: boolean; message: string; responseTime?: number }>('/api/endpoints/test-connection', {
      method: 'POST',
      body: JSON.stringify({ targetUrl }),
    })
  },

  // Clone an endpoint
  async clone(id: string, newName: string): Promise<EndpointResponse> {
    return apiRequest<EndpointResponse>(`/api/endpoints/${id}/clone`, {
      method: 'POST',
      body: JSON.stringify({ name: newName }),
    })
  },
}

export { EndpointApiError }
export type { EndpointListParams }