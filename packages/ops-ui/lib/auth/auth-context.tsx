'use client'

import React, { createContext, useContext, useEffect, useReducer, useCallback } from 'react'
import { apiClient } from './api-client'
import type { AuthState, AuthContextType, LoginCredentials, User } from '@/lib/types/auth'

// Auth reducer for state management
type AuthAction =
  | { type: 'AUTH_START' }
  | { type: 'AUTH_SUCCESS'; payload: { user: User; token: string } }
  | { type: 'AUTH_FAILURE'; payload: string }
  | { type: 'AUTH_LOGOUT' }
  | { type: 'CLEAR_ERROR' }
  | { type: 'SET_LOADING'; payload: boolean }

const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case 'AUTH_START':
      return {
        ...state,
        isLoading: true,
        error: null,
      }
    case 'AUTH_SUCCESS':
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      }
    case 'AUTH_FAILURE':
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: action.payload,
      }
    case 'AUTH_LOGOUT':
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      }
    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null,
      }
    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload,
      }
    default:
      return state
  }
}

const initialState: AuthState = {
  user: null,
  token: null,
  isLoading: true,
  isAuthenticated: false,
  error: null,
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AuthProviderProps {
  children: React.ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, dispatch] = useReducer(authReducer, initialState)

  // Check for existing authentication on mount
  useEffect(() => {
    let isMounted = true

    const checkExistingAuth = async () => {
      const storedToken = apiClient.getStoredToken()
      
      if (!storedToken) {
        dispatch({ type: 'SET_LOADING', payload: false })
        return
      }

      try {
        // Validate the stored token
        const isValid = await apiClient.validateToken()
        
        if (!isMounted) return

        if (isValid) {
          // Token is valid, get user info
          const userResponse = await apiClient.authenticatedRequest<User>('/auth/me')
          
          if (!isMounted) return

          if (userResponse.success && userResponse.data) {
            dispatch({
              type: 'AUTH_SUCCESS',
              payload: {
                user: userResponse.data,
                token: storedToken,
              },
            })
          } else {
            // Token is invalid, clear it
            await apiClient.logout()
            dispatch({ type: 'AUTH_LOGOUT' })
          }
        } else {
          // Token is invalid, clear it
          await apiClient.logout()
          dispatch({ type: 'AUTH_LOGOUT' })
        }
      } catch (error) {
        if (!isMounted) return
        
        // Clear invalid tokens
        await apiClient.logout()
        dispatch({ type: 'AUTH_LOGOUT' })
      } finally {
        if (isMounted) {
          dispatch({ type: 'SET_LOADING', payload: false })
        }
      }
    }

    checkExistingAuth()

    return () => {
      isMounted = false
    }
  }, [])

  const login = useCallback(async (credentials: LoginCredentials) => {
    dispatch({ type: 'AUTH_START' })

    try {
      const response = await apiClient.login(credentials)

      if (response.success && response.data) {
        dispatch({
          type: 'AUTH_SUCCESS',
          payload: {
            user: response.data.user,
            token: response.data.token,
          },
        })
      } else {
        dispatch({
          type: 'AUTH_FAILURE',
          payload: response.error?.message || 'Login failed',
        })
      }
    } catch (error) {
      dispatch({
        type: 'AUTH_FAILURE',
        payload: error instanceof Error ? error.message : 'An unexpected error occurred',
      })
    }
  }, [])

  const logout = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', payload: true })
    
    try {
      await apiClient.logout()
    } catch (error) {
      // Log error but don't block logout
      console.error('Logout error:', error)
    } finally {
      dispatch({ type: 'AUTH_LOGOUT' })
    }
  }, [])

  const refreshToken = useCallback(async () => {
    try {
      await apiClient.refreshTokens()
      
      // Get updated user info after token refresh
      const userResponse = await apiClient.authenticatedRequest<User>('/auth/me')
      
      if (userResponse.success && userResponse.data) {
        const newToken = apiClient.getStoredToken()
        if (newToken) {
          dispatch({
            type: 'AUTH_SUCCESS',
            payload: {
              user: userResponse.data,
              token: newToken,
            },
          })
        }
      }
    } catch (error) {
      // If refresh fails, logout the user
      await logout()
      throw error
    }
  }, [logout])

  const clearError = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR' })
  }, [])

  const contextValue: AuthContextType = {
    ...state,
    login,
    logout,
    refreshToken,
    clearError,
  }

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Hook for checking if user has specific role
export function useRequireRole(requiredRole: 'admin' | 'operator' | 'viewer') {
  const { user, isAuthenticated } = useAuth()
  
  const hasRequiredRole = useCallback(() => {
    if (!isAuthenticated || !user) return false
    
    const roleHierarchy = {
      admin: 3,
      operator: 2,
      viewer: 1,
    }
    
    const userRoleLevel = roleHierarchy[user.role]
    const requiredRoleLevel = roleHierarchy[requiredRole]
    
    return userRoleLevel >= requiredRoleLevel
  }, [user, isAuthenticated, requiredRole])

  return {
    hasRequiredRole: hasRequiredRole(),
    userRole: user?.role,
    isAuthenticated,
  }
}