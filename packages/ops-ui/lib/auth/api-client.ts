'use client'

import type { 
  LoginCredentials, 
  LoginResponse, 
  RefreshTokenResponse, 
  ApiResponse 
} from '@/lib/types/auth'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'

class TokenManager {
  private readonly TOKEN_KEY = 'auth_token'
  private readonly REFRESH_TOKEN_KEY = 'refresh_token'
  private readonly TOKEN_EXPIRY_KEY = 'token_expiry'

  getToken(): string | null {
    if (typeof window === 'undefined') return null
    return localStorage.getItem(this.TOKEN_KEY)
  }

  getRefreshToken(): string | null {
    if (typeof window === 'undefined') return null
    return localStorage.getItem(this.REFRESH_TOKEN_KEY)
  }

  setTokens(token: string, refreshToken?: string, expiresIn?: number): void {
    if (typeof window === 'undefined') return
    
    localStorage.setItem(this.TOKEN_KEY, token)
    
    if (refreshToken) {
      localStorage.setItem(this.REFRESH_TOKEN_KEY, refreshToken)
    }
    
    if (expiresIn) {
      const expiryTime = Date.now() + (expiresIn * 1000)
      localStorage.setItem(this.TOKEN_EXPIRY_KEY, expiryTime.toString())
    }
  }

  clearTokens(): void {
    if (typeof window === 'undefined') return
    
    localStorage.removeItem(this.TOKEN_KEY)
    localStorage.removeItem(this.REFRESH_TOKEN_KEY)
    localStorage.removeItem(this.TOKEN_EXPIRY_KEY)
  }

  isTokenExpired(): boolean {
    if (typeof window === 'undefined') return true
    
    const expiryTime = localStorage.getItem(this.TOKEN_EXPIRY_KEY)
    if (!expiryTime) return true
    
    return Date.now() >= parseInt(expiryTime)
  }
}

class ApiClient {
  private tokenManager = new TokenManager()
  private refreshPromise: Promise<void> | null = null

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${API_BASE_URL}${endpoint}`
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    }

    const token = this.tokenManager.getToken()
    if (token && !this.tokenManager.isTokenExpired()) {
      headers.Authorization = `Bearer ${token}`
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      })

      const data = await response.json()

      if (!response.ok) {
        return {
          success: false,
          error: {
            message: data.message || 'An error occurred',
            code: data.code || 'UNKNOWN_ERROR',
            details: data.details,
          },
        }
      }

      return {
        success: true,
        data,
      }
    } catch (error) {
      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Network error',
          code: 'NETWORK_ERROR',
        },
      }
    }
  }

  private async requestWithRetry<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    // First attempt
    let response = await this.request<T>(endpoint, options)

    // If unauthorized and we have a refresh token, try to refresh
    if (
      !response.success &&
      response.error?.code === 'UNAUTHORIZED' &&
      this.tokenManager.getRefreshToken()
    ) {
      if (!this.refreshPromise) {
        this.refreshPromise = this.refreshTokens()
      }

      try {
        await this.refreshPromise
        this.refreshPromise = null
        
        // Retry the original request
        response = await this.request<T>(endpoint, options)
      } catch {
        this.refreshPromise = null
        // Refresh failed, clear tokens
        this.tokenManager.clearTokens()
      }
    }

    return response
  }

  async login(credentials: LoginCredentials): Promise<ApiResponse<LoginResponse>> {
    const response = await this.request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    })

    if (response.success && response.data) {
      this.tokenManager.setTokens(
        response.data.token,
        response.data.refreshToken,
        response.data.expiresIn
      )
    }

    return response
  }

  async refreshTokens(): Promise<void> {
    const refreshToken = this.tokenManager.getRefreshToken()
    if (!refreshToken) {
      throw new Error('No refresh token available')
    }

    const response = await this.request<RefreshTokenResponse>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    })

    if (response.success && response.data) {
      this.tokenManager.setTokens(
        response.data.token,
        undefined,
        response.data.expiresIn
      )
    } else {
      this.tokenManager.clearTokens()
      throw new Error(response.error?.message || 'Token refresh failed')
    }
  }

  async logout(): Promise<void> {
    const token = this.tokenManager.getToken()
    if (token) {
      // Attempt to logout on server (best effort)
      await this.request('/auth/logout', {
        method: 'POST',
      })
    }
    
    this.tokenManager.clearTokens()
  }

  async validateToken(): Promise<boolean> {
    const token = this.tokenManager.getToken()
    if (!token) return false

    if (this.tokenManager.isTokenExpired()) {
      try {
        await this.refreshTokens()
        return true
      } catch {
        return false
      }
    }

    const response = await this.request('/auth/validate', {
      method: 'GET',
    })

    return response.success
  }

  // Generic authenticated request method for other API calls
  async authenticatedRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    return this.requestWithRetry<T>(endpoint, options)
  }

  getStoredToken(): string | null {
    return this.tokenManager.getToken()
  }

  hasValidToken(): boolean {
    const token = this.tokenManager.getToken()
    return token !== null && !this.tokenManager.isTokenExpired()
  }
}

export const apiClient = new ApiClient()
export { TokenManager }