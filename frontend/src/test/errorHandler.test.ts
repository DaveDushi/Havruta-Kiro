import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AxiosError } from 'axios'
import {
  parseError,
  getUserFriendlyMessage,
  getRecoverySuggestions,
  handleError,
  withRetry,
  errorNotificationManager,
  NetworkError,
  AuthenticationError,
  ValidationError
} from '../utils/errorHandler'

describe('Error Handler Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock console.error
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('parseError', () => {
    it('should parse AxiosError with response data', () => {
      const axiosError = {
        isAxiosError: true,
        response: {
          status: 400,
          data: {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid input',
              details: { field: 'email' }
            },
            timestamp: '2023-01-01T00:00:00Z',
            requestId: 'req-123'
          }
        }
      } as AxiosError

      const result = parseError(axiosError)

      expect(result).toEqual({
        code: 'VALIDATION_ERROR',
        message: 'Invalid input',
        details: { field: 'email' },
        statusCode: 400,
        timestamp: '2023-01-01T00:00:00Z',
        requestId: 'req-123'
      })
    })

    it('should parse network error', () => {
      const networkError = {
        isAxiosError: true,
        code: 'NETWORK_ERROR',
        message: 'Network Error'
      } as AxiosError

      const result = parseError(networkError)

      expect(result).toEqual({
        code: 'NETWORK_ERROR',
        message: 'Unable to connect to the server. Please check your internet connection.',
        statusCode: 0
      })
    })

    it('should parse timeout error', () => {
      const timeoutError = {
        isAxiosError: true,
        code: 'ECONNABORTED',
        message: 'timeout of 5000ms exceeded'
      } as AxiosError

      const result = parseError(timeoutError)

      expect(result).toEqual({
        code: 'TIMEOUT_ERROR',
        message: 'Request timed out. Please try again.',
        statusCode: 408
      })
    })

    it('should parse custom app errors', () => {
      const customError = new ValidationError('Invalid email format')

      const result = parseError(customError)

      expect(result).toEqual({
        code: 'VALIDATION_ERROR',
        message: 'Invalid email format'
      })
    })

    it('should parse generic Error', () => {
      const genericError = new Error('Something went wrong')

      const result = parseError(genericError)

      expect(result).toEqual({
        code: 'ERROR_ERROR',
        message: 'Something went wrong'
      })
    })

    it('should parse unknown error types', () => {
      const unknownError = 'string error'

      const result = parseError(unknownError)

      expect(result).toEqual({
        code: 'UNKNOWN_ERROR',
        message: 'An unexpected error occurred'
      })
    })
  })

  describe('getUserFriendlyMessage', () => {
    it('should return user-friendly message for network error', () => {
      const error = { code: 'NETWORK_ERROR', message: 'Network failed' }
      const result = getUserFriendlyMessage(error)
      
      expect(result).toBe('Unable to connect to the server. Please check your internet connection and try again.')
    })

    it('should return user-friendly message for authentication error', () => {
      const error = { code: 'AUTHENTICATION_ERROR', message: 'Auth failed' }
      const result = getUserFriendlyMessage(error)
      
      expect(result).toBe('Your session has expired. Please sign in again.')
    })

    it('should return user-friendly message for validation error', () => {
      const error = { code: 'VALIDATION_ERROR', message: 'Invalid input' }
      const result = getUserFriendlyMessage(error)
      
      expect(result).toBe('Please check your input and try again.')
    })

    it('should return original message for unknown error codes', () => {
      const error = { code: 'UNKNOWN_CODE', message: 'Custom error message' }
      const result = getUserFriendlyMessage(error)
      
      expect(result).toBe('Custom error message')
    })

    it('should return default message when no message provided', () => {
      const error = { code: 'UNKNOWN_CODE', message: '' }
      const result = getUserFriendlyMessage(error)
      
      expect(result).toBe('An unexpected error occurred. Please try again.')
    })
  })

  describe('getRecoverySuggestions', () => {
    it('should return network error suggestions', () => {
      const error = { code: 'NETWORK_ERROR', message: 'Network failed' }
      const suggestions = getRecoverySuggestions(error)
      
      expect(suggestions).toContain('Check your internet connection')
      expect(suggestions).toContain('Try refreshing the page')
    })

    it('should return authentication error suggestions', () => {
      const error = { code: 'AUTHENTICATION_ERROR', message: 'Auth failed' }
      const suggestions = getRecoverySuggestions(error)
      
      expect(suggestions).toContain('Sign in again')
      expect(suggestions).toContain('Clear your browser cache')
    })

    it('should return validation error suggestions', () => {
      const error = { code: 'VALIDATION_ERROR', message: 'Invalid input' }
      const suggestions = getRecoverySuggestions(error)
      
      expect(suggestions).toContain('Check all required fields are filled')
      expect(suggestions).toContain('Verify the format of your input')
    })

    it('should return default suggestions for unknown errors', () => {
      const error = { code: 'UNKNOWN_CODE', message: 'Unknown error' }
      const suggestions = getRecoverySuggestions(error)
      
      expect(suggestions).toContain('Try refreshing the page')
      expect(suggestions).toContain('Try again in a few minutes')
    })
  })

  describe('handleError', () => {
    it('should log error and show notification', () => {
      const mockAddNotification = vi.spyOn(errorNotificationManager, 'addNotification')
      const error = new ValidationError('Test error')

      handleError(error, 'Test context')

      expect(console.error).toHaveBeenCalledWith(
        'Error occurred:',
        expect.objectContaining({
          context: 'Test context',
          error: expect.objectContaining({
            code: 'VALIDATION_ERROR',
            message: 'Test error'
          })
        })
      )

      expect(mockAddNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          title: 'Error',
          message: 'Please check your input and try again.'
        })
      )
    })

    it('should redirect to login for authentication errors', () => {
      vi.useFakeTimers()
      
      // Mock window.location
      delete (window as any).location
      window.location = { href: '' } as any

      const error = new AuthenticationError('Token expired')
      handleError(error)

      // Fast-forward time
      vi.advanceTimersByTime(2000)

      expect(window.location.href).toBe('/login')
      
      vi.useRealTimers()
    })
  })

  describe('withRetry', () => {
    it('should retry failed operations', async () => {
      let attempts = 0
      const operation = vi.fn().mockImplementation(() => {
        attempts++
        if (attempts < 3) {
          throw new Error('Temporary failure')
        }
        return 'success'
      })

      const result = await withRetry(operation, 3, 10)

      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledTimes(3)
    })

    it('should not retry authentication errors', async () => {
      const operation = vi.fn().mockRejectedValue(new AuthenticationError('Auth failed'))

      await expect(withRetry(operation, 3, 10)).rejects.toThrow('Auth failed')
      expect(operation).toHaveBeenCalledTimes(1)
    })

    it('should not retry validation errors', async () => {
      const operation = vi.fn().mockRejectedValue(new ValidationError('Invalid input'))

      await expect(withRetry(operation, 3, 10)).rejects.toThrow('Invalid input')
      expect(operation).toHaveBeenCalledTimes(1)
    })

    it('should throw last error after max retries', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Persistent failure'))

      await expect(withRetry(operation, 2, 10)).rejects.toThrow('Persistent failure')
      expect(operation).toHaveBeenCalledTimes(2)
    })
  })

  describe('ErrorNotificationManager', () => {
    it('should add and notify about new notifications', () => {
      const listener = vi.fn()
      const unsubscribe = errorNotificationManager.subscribe(listener)

      const notificationId = errorNotificationManager.addNotification({
        type: 'error',
        title: 'Test Error',
        message: 'Test message'
      })

      expect(listener).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: notificationId,
            type: 'error',
            title: 'Test Error',
            message: 'Test message'
          })
        ])
      )

      unsubscribe()
    })

    it('should remove notifications', () => {
      const listener = vi.fn()
      errorNotificationManager.subscribe(listener)

      const notificationId = errorNotificationManager.addNotification({
        type: 'error',
        title: 'Test Error',
        message: 'Test message'
      })

      errorNotificationManager.removeNotification(notificationId)

      expect(listener).toHaveBeenLastCalledWith([])
    })

    it('should auto-remove notifications after duration', () => {
      vi.useFakeTimers()
      
      const listener = vi.fn()
      errorNotificationManager.subscribe(listener)

      errorNotificationManager.addNotification({
        type: 'error',
        title: 'Test Error',
        message: 'Test message',
        autoHide: true,
        duration: 1000
      })

      expect(listener).toHaveBeenCalledWith(expect.arrayContaining([expect.any(Object)]))

      vi.advanceTimersByTime(1000)

      expect(listener).toHaveBeenLastCalledWith([])
      
      vi.useRealTimers()
    })

    it('should clear all notifications', () => {
      const listener = vi.fn()
      errorNotificationManager.subscribe(listener)

      errorNotificationManager.addNotification({
        type: 'error',
        title: 'Error 1',
        message: 'Message 1'
      })

      errorNotificationManager.addNotification({
        type: 'warning',
        title: 'Warning 1',
        message: 'Message 2'
      })

      errorNotificationManager.clearAll()

      expect(listener).toHaveBeenLastCalledWith([])
    })
  })
})