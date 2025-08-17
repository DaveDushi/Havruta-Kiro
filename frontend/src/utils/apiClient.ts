import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'
import { handleError, withRetry } from './errorHandler'

class ApiClient {
  private client: AxiosInstance
  private baseURL: string

  constructor() {
    this.baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
    
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 30000, // 30 seconds
      headers: {
        'Content-Type': 'application/json'
      }
    })

    this.setupInterceptors()
  }

  private setupInterceptors(): void {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        // Add auth token if available
        const token = localStorage.getItem('token')
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
        }

        // Add request ID for tracking
        config.headers['X-Request-ID'] = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

        // Log request in development
        if (import.meta.env.DEV) {
          console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`, {
            headers: config.headers,
            data: config.data
          })
        }

        return config
      },
      (error) => {
        console.error('Request interceptor error:', error)
        return Promise.reject(error)
      }
    )

    // Response interceptor
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        // Log response in development
        if (import.meta.env.DEV) {
          console.log(`API Response: ${response.status} ${response.config.url}`, {
            data: response.data,
            headers: response.headers
          })
        }

        return response
      },
      (error) => {
        // Log error
        console.error('API Error:', {
          url: error.config?.url,
          method: error.config?.method,
          status: error.response?.status,
          data: error.response?.data,
          message: error.message
        })

        // Handle token expiration
        if (error.response?.status === 401) {
          const errorCode = error.response?.data?.error?.code
          if (errorCode === 'TOKEN_EXPIRED' || errorCode === 'INVALID_TOKEN') {
            localStorage.removeItem('token')
            localStorage.removeItem('user')
            
            // Don't redirect if already on login page
            if (!window.location.pathname.includes('/login')) {
              window.location.href = '/login'
            }
          }
        }

        return Promise.reject(error)
      }
    )
  }

  // Generic request method with error handling and retry
  private async request<T>(
    config: AxiosRequestConfig,
    retryOptions?: { maxRetries?: number; delay?: number }
  ): Promise<T> {
    try {
      const response = await withRetry(
        () => this.client.request<T>(config),
        retryOptions?.maxRetries,
        retryOptions?.delay
      )
      return response.data
    } catch (error) {
      handleError(error, `API ${config.method?.toUpperCase()} ${config.url}`)
      throw error
    }
  }

  // HTTP methods
  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>({ ...config, method: 'GET', url })
  }

  async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>({ ...config, method: 'POST', url, data })
  }

  async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>({ ...config, method: 'PUT', url, data })
  }

  async patch<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>({ ...config, method: 'PATCH', url, data })
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>({ ...config, method: 'DELETE', url })
  }

  // File upload with progress
  async uploadFile<T>(
    url: string, 
    file: File, 
    onProgress?: (progress: number) => void,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const formData = new FormData()
    formData.append('file', file)

    return this.request<T>({
      ...config,
      method: 'POST',
      url,
      data: formData,
      headers: {
        ...config?.headers,
        'Content-Type': 'multipart/form-data'
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          onProgress(progress)
        }
      }
    })
  }

  // Health check
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    return this.get('/health')
  }

  // Set auth token
  setAuthToken(token: string): void {
    localStorage.setItem('token', token)
    this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`
  }

  // Clear auth token
  clearAuthToken(): void {
    localStorage.removeItem('token')
    delete this.client.defaults.headers.common['Authorization']
  }

  // Get current base URL
  getBaseURL(): string {
    return this.baseURL
  }

  // Update base URL
  setBaseURL(url: string): void {
    this.baseURL = url
    this.client.defaults.baseURL = url
  }
}

// Create singleton instance
export const apiClient = new ApiClient()

// Export for use in services
export default apiClient