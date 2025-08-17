import { AxiosError } from 'axios'

export interface AppError {
  code: string
  message: string
  details?: any
  statusCode?: number
  timestamp?: string
  requestId?: string
}

export interface ErrorNotification {
  id: string
  type: 'error' | 'warning' | 'info'
  title: string
  message: string
  action?: {
    label: string
    handler: () => void
  }
  autoHide?: boolean
  duration?: number
}

// Error types
export class NetworkError extends Error {
  constructor(message: string = 'Network connection failed') {
    super(message)
    this.name = 'NetworkError'
  }
}

export class AuthenticationError extends Error {
  constructor(message: string = 'Authentication required') {
    super(message)
    this.name = 'AuthenticationError'
  }
}

export class ValidationError extends Error {
  constructor(message: string = 'Invalid input') {
    super(message)
    this.name = 'ValidationError'
  }
}

export class ServiceUnavailableError extends Error {
  constructor(message: string = 'Service temporarily unavailable') {
    super(message)
    this.name = 'ServiceUnavailableError'
  }
}

// Error notification system
class ErrorNotificationManager {
  private notifications: ErrorNotification[] = []
  private listeners: ((notifications: ErrorNotification[]) => void)[] = []

  subscribe(listener: (notifications: ErrorNotification[]) => void): () => void {
    this.listeners.push(listener)
    return () => {
      const index = this.listeners.indexOf(listener)
      if (index > -1) {
        this.listeners.splice(index, 1)
      }
    }
  }

  private notify(): void {
    this.listeners.forEach(listener => listener([...this.notifications]))
  }

  addNotification(notification: Omit<ErrorNotification, 'id'>): string {
    const id = `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const fullNotification: ErrorNotification = {
      id,
      autoHide: true,
      duration: 5000,
      ...notification
    }

    this.notifications.push(fullNotification)
    this.notify()

    // Auto-remove notification if specified
    if (fullNotification.autoHide) {
      setTimeout(() => {
        this.removeNotification(id)
      }, fullNotification.duration)
    }

    return id
  }

  removeNotification(id: string): void {
    const index = this.notifications.findIndex(n => n.id === id)
    if (index > -1) {
      this.notifications.splice(index, 1)
      this.notify()
    }
  }

  clearAll(): void {
    this.notifications = []
    this.notify()
  }
}

export const errorNotificationManager = new ErrorNotificationManager()

// Error parsing and handling
export const parseError = (error: unknown): AppError => {
  // Handle Axios errors
  if (error instanceof AxiosError) {
    const response = error.response
    
    if (response?.data?.error) {
      return {
        code: response.data.error.code || 'API_ERROR',
        message: response.data.error.message || 'An error occurred',
        details: response.data.error.details,
        statusCode: response.status,
        timestamp: response.data.timestamp,
        requestId: response.data.requestId
      }
    }

    // Handle network errors
    if (error.code === 'NETWORK_ERROR' || !response) {
      return {
        code: 'NETWORK_ERROR',
        message: 'Unable to connect to the server. Please check your internet connection.',
        statusCode: 0
      }
    }

    // Handle timeout errors
    if (error.code === 'ECONNABORTED') {
      return {
        code: 'TIMEOUT_ERROR',
        message: 'Request timed out. Please try again.',
        statusCode: 408
      }
    }

    return {
      code: 'HTTP_ERROR',
      message: error.message || 'An HTTP error occurred',
      statusCode: response?.status || 500
    }
  }

  // Handle custom app errors
  if (error instanceof Error) {
    return {
      code: error.name.toUpperCase().replace('ERROR', '') + '_ERROR',
      message: error.message
    }
  }

  // Handle unknown errors
  return {
    code: 'UNKNOWN_ERROR',
    message: 'An unexpected error occurred'
  }
}

// User-friendly error messages
export const getUserFriendlyMessage = (error: AppError): string => {
  switch (error.code) {
    case 'NETWORK_ERROR':
      return 'Unable to connect to the server. Please check your internet connection and try again.'
    
    case 'AUTHENTICATION_ERROR':
    case 'INVALID_TOKEN':
    case 'TOKEN_EXPIRED':
      return 'Your session has expired. Please sign in again.'
    
    case 'AUTHORIZATION_ERROR':
      return 'You don\'t have permission to perform this action.'
    
    case 'VALIDATION_ERROR':
      return 'Please check your input and try again.'
    
    case 'NOT_FOUND_ERROR':
      return 'The requested resource could not be found.'
    
    case 'CONFLICT_ERROR':
      return 'This action conflicts with existing data. Please refresh and try again.'
    
    case 'RATE_LIMIT_ERROR':
      return 'Too many requests. Please wait a moment before trying again.'
    
    case 'EXTERNAL_SERVICE_ERROR':
      return 'An external service is temporarily unavailable. Please try again later.'
    
    case 'DATABASE_ERROR':
      return 'A database error occurred. Please try again.'
    
    case 'FILE_UPLOAD_ERROR':
      return 'File upload failed. Please check the file size and format.'
    
    case 'TIMEOUT_ERROR':
      return 'The request timed out. Please try again.'
    
    default:
      return error.message || 'An unexpected error occurred. Please try again.'
  }
}

// Recovery suggestions
export const getRecoverySuggestions = (error: AppError): string[] => {
  const suggestions: string[] = []

  switch (error.code) {
    case 'NETWORK_ERROR':
      suggestions.push('Check your internet connection')
      suggestions.push('Try refreshing the page')
      suggestions.push('Contact support if the problem persists')
      break
    
    case 'AUTHENTICATION_ERROR':
    case 'INVALID_TOKEN':
    case 'TOKEN_EXPIRED':
      suggestions.push('Sign in again')
      suggestions.push('Clear your browser cache')
      break
    
    case 'VALIDATION_ERROR':
      suggestions.push('Check all required fields are filled')
      suggestions.push('Verify the format of your input')
      break
    
    case 'RATE_LIMIT_ERROR':
      suggestions.push('Wait a few minutes before trying again')
      suggestions.push('Reduce the frequency of your requests')
      break
    
    case 'EXTERNAL_SERVICE_ERROR':
      suggestions.push('Try again in a few minutes')
      suggestions.push('Check our status page for service updates')
      break
    
    default:
      suggestions.push('Try refreshing the page')
      suggestions.push('Try again in a few minutes')
      suggestions.push('Contact support if the problem continues')
  }

  return suggestions
}

// Main error handler
export const handleError = (error: unknown, context?: string): void => {
  const parsedError = parseError(error)
  const userMessage = getUserFriendlyMessage(parsedError)
  const suggestions = getRecoverySuggestions(parsedError)

  // Log error for debugging
  console.error('Error occurred:', {
    context,
    error: parsedError,
    originalError: error
  })

  // Show user notification
  errorNotificationManager.addNotification({
    type: 'error',
    title: 'Error',
    message: userMessage,
    action: suggestions.length > 0 ? {
      label: 'View Suggestions',
      handler: () => {
        alert(`Suggestions:\n${suggestions.map(s => `• ${s}`).join('\n')}`)
      }
    } : undefined
  })

  // Handle specific error types
  if (parsedError.code === 'AUTHENTICATION_ERROR' || 
      parsedError.code === 'INVALID_TOKEN' || 
      parsedError.code === 'TOKEN_EXPIRED') {
    // Redirect to login after a short delay
    setTimeout(() => {
      window.location.href = '/login'
    }, 2000)
  }
}

// Retry mechanism
export const withRetry = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> => {
  let lastError: unknown

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      
      const parsedError = parseError(error)
      
      // Don't retry certain error types
      if (parsedError.code === 'AUTHENTICATION_ERROR' ||
          parsedError.code === 'AUTHORIZATION_ERROR' ||
          parsedError.code === 'VALIDATION_ERROR' ||
          parsedError.statusCode === 404) {
        throw error
      }

      if (attempt === maxRetries) {
        break
      }

      // Exponential backoff
      const waitTime = delay * Math.pow(2, attempt - 1)
      await new Promise(resolve => setTimeout(resolve, waitTime))
    }
  }

  throw lastError
}

// Global error handler setup
export const setupGlobalErrorHandling = (): void => {
  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason)
    handleError(event.reason, 'Unhandled Promise Rejection')
    event.preventDefault()
  })

  // Handle global errors
  window.addEventListener('error', (event) => {
    console.error('Global error:', event.error)
    handleError(event.error, 'Global Error')
  })
}