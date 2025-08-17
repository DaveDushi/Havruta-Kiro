import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import request from 'supertest'
import express from 'express'
import { 
  errorHandler, 
  CustomError, 
  ValidationError, 
  AuthenticationError,
  NotFoundError,
  requestIdMiddleware,
  asyncHandler
} from '../middleware/errorHandler'
import { logger } from '../utils/logger'

// Mock logger
vi.mock('../utils/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  }
}))

describe('Error Handling Middleware', () => {
  let app: express.Application

  beforeEach(() => {
    app = express()
    app.use(express.json())
    app.use(requestIdMiddleware)
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('CustomError classes', () => {
    it('should create ValidationError with correct properties', () => {
      const error = new ValidationError('Invalid input')
      
      expect(error.message).toBe('Invalid input')
      expect(error.statusCode).toBe(400)
      expect(error.code).toBe('VALIDATION_ERROR')
      expect(error.isOperational).toBe(true)
      expect(error.name).toBe('ValidationError')
    })

    it('should create AuthenticationError with correct properties', () => {
      const error = new AuthenticationError('Token expired')
      
      expect(error.message).toBe('Token expired')
      expect(error.statusCode).toBe(401)
      expect(error.code).toBe('AUTHENTICATION_ERROR')
      expect(error.name).toBe('AuthenticationError')
    })

    it('should create NotFoundError with correct properties', () => {
      const error = new NotFoundError('User not found')
      
      expect(error.message).toBe('User not found')
      expect(error.statusCode).toBe(404)
      expect(error.code).toBe('NOT_FOUND_ERROR')
      expect(error.name).toBe('NotFoundError')
    })
  })

  describe('Request ID Middleware', () => {
    it('should add request ID to request object', async () => {
      app.get('/test', (req, res) => {
        res.json({ requestId: req.requestId })
      })

      const response = await request(app).get('/test')
      
      expect(response.body.requestId).toBeDefined()
      expect(typeof response.body.requestId).toBe('string')
      expect(response.headers['x-request-id']).toBeDefined()
    })

    it('should use provided X-Request-ID header', async () => {
      const customRequestId = 'custom-request-id-123'
      
      app.get('/test', (req, res) => {
        res.json({ requestId: req.requestId })
      })

      const response = await request(app)
        .get('/test')
        .set('X-Request-ID', customRequestId)
      
      expect(response.body.requestId).toBe(customRequestId)
      expect(response.headers['x-request-id']).toBe(customRequestId)
    })
  })

  describe('Error Handler Middleware', () => {
    beforeEach(() => {
      // Clear any existing routes
      app._router = undefined
      app.use(express.json())
      app.use(requestIdMiddleware)
    })

    it('should handle CustomError correctly', async () => {
      app.get('/test', (req, res, next) => {
        try {
          throw new ValidationError('Test validation error')
        } catch (error) {
          next(error)
        }
      })
      
      app.use(errorHandler)

      const response = await request(app).get('/test')
      
      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
      expect(response.body.error.message).toBe('Test validation error')
      expect(response.body.timestamp).toBeDefined()
      expect(response.body.requestId).toBeDefined()
      expect(response.body.path).toBe('/test')
    })

    it('should handle generic Error correctly', async () => {
      app.get('/test', (req, res, next) => {
        try {
          throw new Error('Generic error')
        } catch (error) {
          next(error)
        }
      })
      
      app.use(errorHandler)

      const response = await request(app).get('/test')
      
      expect(response.status).toBe(500)
      expect(response.body.error.code).toBe('INTERNAL_ERROR')
      expect(response.body.error.message).toBe('An unexpected error occurred')
    })

    it('should handle JWT errors correctly', async () => {
      app.get('/test', (req, res, next) => {
        try {
          const error = new Error('Invalid token')
          error.name = 'JsonWebTokenError'
          throw error
        } catch (error) {
          next(error)
        }
      })
      
      app.use(errorHandler)

      const response = await request(app).get('/test')
      
      expect(response.status).toBe(401)
      expect(response.body.error.code).toBe('INVALID_TOKEN')
      expect(response.body.error.message).toBe('Invalid authentication token')
    })

    it('should log errors correctly', async () => {
      app.get('/test', (req, res, next) => {
        try {
          throw new ValidationError('Test error')
        } catch (error) {
          next(error)
        }
      })
      
      app.use(errorHandler)

      await request(app).get('/test')
      
      expect(logger.error).toHaveBeenCalledWith(
        'Request error',
        expect.objectContaining({
          statusCode: 400,
          code: 'VALIDATION_ERROR',
          message: 'Test error'
        }),
        expect.objectContaining({
          requestId: expect.any(String),
          error: expect.any(ValidationError)
        })
      )
    })

    it('should include stack trace in development', async () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'development'

      app.get('/test', (req, res, next) => {
        try {
          throw new Error('Test error')
        } catch (error) {
          next(error)
        }
      })
      
      app.use(errorHandler)

      const response = await request(app).get('/test')
      
      expect(response.body.error.stack).toBeDefined()
      
      process.env.NODE_ENV = originalEnv
    })

    it('should not include stack trace in production', async () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'production'

      app.get('/test', (req, res, next) => {
        try {
          throw new Error('Test error')
        } catch (error) {
          next(error)
        }
      })
      
      app.use(errorHandler)

      const response = await request(app).get('/test')
      
      expect(response.body.error.stack).toBeUndefined()
      
      process.env.NODE_ENV = originalEnv
    })
  })

  describe('Async Handler', () => {
    it('should catch async errors', async () => {
      app.get('/test', asyncHandler(async () => {
        await new Promise(resolve => setTimeout(resolve, 10))
        throw new ValidationError('Async error')
      }))
      
      app.use(errorHandler)

      const response = await request(app).get('/test')
      
      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
      expect(response.body.error.message).toBe('Async error')
    })

    it('should handle async function that resolves normally', async () => {
      app.get('/test', asyncHandler(async (req, res) => {
        await new Promise(resolve => setTimeout(resolve, 10))
        res.json({ success: true })
      }))

      const response = await request(app).get('/test')
      
      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
    })
  })
})