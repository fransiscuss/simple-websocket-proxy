export interface User {
  id: string
  email: string
  name: string
  role: 'admin' | 'operator' | 'viewer'
  createdAt: string
  updatedAt: string
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface LoginResponse {
  success: boolean
  token: string
  refreshToken?: string
  user: User
  expiresIn: number
}

export interface RefreshTokenResponse {
  success: boolean
  token: string
  expiresIn: number
}

export interface AuthError {
  message: string
  code: string
  details?: Record<string, string[]>
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: AuthError
}

export interface AuthState {
  user: User | null
  token: string | null
  isLoading: boolean
  isAuthenticated: boolean
  error: string | null
}

export interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>
  logout: () => void
  refreshToken: () => Promise<void>
  clearError: () => void
}