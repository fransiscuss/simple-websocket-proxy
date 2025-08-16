'use client'

import { apiClient as authApiClient } from '@/lib/auth/api-client'

// Simple wrapper around the authenticated API client for general API calls
class ApiClient {
  async get(endpoint: string): Promise<Response> {
    const response = await authApiClient.authenticatedRequest(endpoint, {
      method: 'GET',
    })

    if (!response.success) {
      throw new Error(response.error?.message || 'API request failed')
    }

    // Return a mock Response object with json() and blob() methods
    return {
      json: async () => response.data,
      blob: async () => {
        // For blob responses, we'd need to handle this differently in a real implementation
        if (response.data instanceof Blob) {
          return response.data
        }
        // Convert string/object data to blob
        const jsonString = typeof response.data === 'string' ? response.data : JSON.stringify(response.data)
        return new Blob([jsonString], { type: 'application/json' })
      },
      ok: true,
      status: 200,
      statusText: 'OK',
    } as Response
  }

  async post(endpoint: string, data?: any): Promise<Response> {
    const response = await authApiClient.authenticatedRequest(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    })

    if (!response.success) {
      throw new Error(response.error?.message || 'API request failed')
    }

    return {
      json: async () => response.data,
      blob: async () => {
        if (response.data instanceof Blob) {
          return response.data
        }
        const jsonString = typeof response.data === 'string' ? response.data : JSON.stringify(response.data)
        return new Blob([jsonString], { type: 'application/json' })
      },
      ok: true,
      status: 200,
      statusText: 'OK',
    } as Response
  }

  async put(endpoint: string, data?: any): Promise<Response> {
    const response = await authApiClient.authenticatedRequest(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    })

    if (!response.success) {
      throw new Error(response.error?.message || 'API request failed')
    }

    return {
      json: async () => response.data,
      blob: async () => {
        if (response.data instanceof Blob) {
          return response.data
        }
        const jsonString = typeof response.data === 'string' ? response.data : JSON.stringify(response.data)
        return new Blob([jsonString], { type: 'application/json' })
      },
      ok: true,
      status: 200,
      statusText: 'OK',
    } as Response
  }

  async delete(endpoint: string): Promise<Response> {
    const response = await authApiClient.authenticatedRequest(endpoint, {
      method: 'DELETE',
    })

    if (!response.success) {
      throw new Error(response.error?.message || 'API request failed')
    }

    return {
      json: async () => response.data,
      blob: async () => {
        if (response.data instanceof Blob) {
          return response.data
        }
        const jsonString = typeof response.data === 'string' ? response.data : JSON.stringify(response.data)
        return new Blob([jsonString], { type: 'application/json' })
      },
      ok: true,
      status: 200,
      statusText: 'OK',
    } as Response
  }
}

export const apiClient = new ApiClient()