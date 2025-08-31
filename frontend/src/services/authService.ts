import axios from 'axios'
import { User } from '../types'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

export interface LoginResponse {
  user: User
  token: string
  refreshToken: string
}

class AuthService {
  private token: string | null = null
  private refreshToken: string | null = null

  constructor() {
    // Load tokens from localStorage on initialization
    this.token = localStorage.getItem('authToken')
    this.refreshToken = localStorage.getItem('refreshToken')
    
    // Set up axios interceptor for automatic token inclusion
    this.setupAxiosInterceptors()
  }

  private setupAxiosInterceptors() {
    // Request interceptor to add auth token
    axios.interceptors.request.use(
      (config) => {
        if (this.token) {
          config.headers.Authorization = `Bearer ${this.token}`
        }
        return config
      },
      (error) => Promise.reject(error)
    )

    // Response interceptor to handle token refresh
    axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true

          try {
            const newToken = await this.refreshAccessToken()
            originalRequest.headers.Authorization = `Bearer ${newToken}`
            return axios(originalRequest)
          } catch (refreshError) {
            this.logout()
            window.location.href = '/login'
            return Promise.reject(refreshError)
          }
        }

        return Promise.reject(error)
      }
    )
  }

  async initiateOAuthLogin(provider: 'google' | 'apple'): Promise<void> {
    try {
      // Directly redirect to backend OAuth endpoint
      // The backend will handle the redirect to the OAuth provider
      window.location.href = `${API_BASE_URL}/auth/${provider}`
    } catch (error) {
      console.error('Failed to initiate OAuth login:', error)
      throw new Error('Failed to initiate OAuth login')
    }
  }

  async handleOAuthCallback(code: string, provider: 'google' | 'apple'): Promise<LoginResponse> {
    try {
      const response = await axios.post(`${API_BASE_URL}/auth/oauth/${provider}/callback`, {
        code,
      })

      const { user, token, refreshToken } = response.data

      // Store tokens
      this.setTokens(token, refreshToken)

      return { user, token, refreshToken }
    } catch (error) {
      console.error('OAuth callback failed:', error)
      throw new Error('Authentication failed')
    }
  }

  async refreshAccessToken(): Promise<string> {
    if (!this.refreshToken) {
      throw new Error('No refresh token available')
    }

    try {
      const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
        refreshToken: this.refreshToken,
      })

      const { token } = response.data
      this.setTokens(token, this.refreshToken)

      // Notify socket service about token refresh
      this.notifyTokenRefresh()

      return token
    } catch (error) {
      console.error('Token refresh failed:', error)
      throw new Error('Token refresh failed')
    }
  }

  private notifyTokenRefresh(): void {
    // Dispatch custom event for token refresh
    window.dispatchEvent(new CustomEvent('auth:token-refreshed'))
  }

  async getCurrentUser(): Promise<User | null> {
    if (!this.token) {
      return null
    }

    try {
      const response = await axios.get(`${API_BASE_URL}/auth/me`)
      return response.data.user
    } catch (error) {
      console.error('Failed to get current user:', error)
      return null
    }
  }

  setTokens(token: string, refreshToken: string): void {
    this.token = token
    this.refreshToken = refreshToken
    localStorage.setItem('authToken', token)
    localStorage.setItem('refreshToken', refreshToken)
  }

  logout(): void {
    this.token = null
    this.refreshToken = null
    localStorage.removeItem('authToken')
    localStorage.removeItem('refreshToken')
  }

  isAuthenticated(): boolean {
    return !!this.token
  }

  getToken(): string | null {
    return this.token
  }
}

export const authService = new AuthService()
export default authService