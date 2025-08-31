import { Request, Response, NextFunction } from 'express'
import { logger } from '../utils/logger'
import { ZodError } from 'zod'
import { Prisma } from '@prisma/client'

export interface AppError extends Error {
  statusCode?: number
  code?: string
  isOperational?: boolean
}

export class CustomError extends Error implements AppError {
  statusCode: number
  code: string
  isOperational: boolean

  constructor(message: string, statusCode: number = 500, code: string = 'INTERNAL_ERROR') {
    super(message)
    this.statusCode = statusCode
    this.code = code
    this.isOperational = true
    this.name = 'CustomError'

    Error.captureStackTrace(this, this.constructor)
  }
}

// Predefined error types
export class ValidationError extends CustomError {
  constructor(message: string = 'Validation failed') {
    super(message, 400, 'VALIDATION_ERROR')
    this.name = 'ValidationError'
  }
}

export class AuthenticationError extends CustomError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR')
    this.name = 'AuthenticationError'
  }
}

export class AuthorizationError extends CustomError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403, 'AUTHORIZATION_ERROR')
    this.name = 'AuthorizationError'
  }
}

export class NotFoundError extends CustomError {
  constructor(message: string = 'Resource not found') {
    super(message, 404, 'NOT_FOUND_ERROR')
    this.name = 'NotFoundError'
  }
}

export class ConflictError extends CustomError {
  constructor(message: string = 'Resource conflict') {
    super(message, 409, 'CONFLICT_ERROR')
    this.name = 'ConflictError'
  }
}

export class RateLimitError extends CustomError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 429, 'RATE_LIMIT_ERROR')
    this.name = 'RateLimitError'
  }
}

export class ExternalServiceError extends CustomError {
  constructor(message: string = 'External service error', service?: string) {
    super(message, 502, 'EXTERNAL_SERVICE_ERROR')
    this.name = 'ExternalServiceError'
    if (service) {
      this.message = `${service}: ${message}`
    }
  }
}

// Error response interface
interface ErrorResponse {
  error: {
    code: string
    message: string
    details?: any
    stack?: string
  }
  timestamp: string
  requestId: string
  path: string
}

// Request ID middleware
export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  req.requestId = req.get('X-Request-ID') || 
                  `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  res.setHeader('X-Request-ID', req.requestId)
  next()
}

// Request logging middleware
export const requestLoggingMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = Date.now()
  
  // Log request start
  logger.info('Request started', {
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.connection.remoteAddress
  }, {
    requestId: req.requestId,
    userId: req.user?.id
  })

  // Override res.end to log when request completes
  const originalEnd = res.end
  res.end = function(chunk?: any, encoding?: any) {
    const duration = Date.now() - startTime
    logger.logRequest(req, res, duration)
    originalEnd.call(this, chunk, encoding)
  }

  next()
}

// Main error handler middleware
export const errorHandler = (
  error: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let statusCode = 500
  let code = 'INTERNAL_ERROR'
  let message = 'An unexpected error occurred'
  let details: any = undefined

  // Handle different error types
  if (error instanceof CustomError) {
    statusCode = error.statusCode
    code = error.code
    message = error.message
  } else if (error instanceof ZodError) {
    statusCode = 400
    code = 'VALIDATION_ERROR'
    message = 'Invalid input data'
    details = error.errors.map(err => ({
      field: err.path.join('.'),
      message: err.message,
      code: err.code
    }))
  } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
    statusCode = 400
    code = 'DATABASE_ERROR'
    
    switch (error.code) {
      case 'P2002':
        message = 'A record with this information already exists'
        details = { constraint: error.meta?.target }
        break
      case 'P2025':
        statusCode = 404
        message = 'Record not found'
        break
      case 'P2003':
        message = 'Invalid reference to related record'
        break
      default:
        message = 'Database operation failed'
    }
  } else if (error instanceof Prisma.PrismaClientValidationError) {
    statusCode = 400
    code = 'VALIDATION_ERROR'
    message = 'Invalid data provided'
  } else if (error.name === 'JsonWebTokenError') {
    statusCode = 401
    code = 'INVALID_TOKEN'
    message = 'Invalid authentication token'
  } else if (error.name === 'TokenExpiredError') {
    statusCode = 401
    code = 'TOKEN_EXPIRED'
    message = 'Authentication token has expired'
  } else if (error.name === 'MulterError') {
    statusCode = 400
    code = 'FILE_UPLOAD_ERROR'
    message = 'File upload failed'
  }

  // Log the error
  logger.error('Request error', {
    statusCode,
    code,
    message: error.message,
    url: req.url,
    method: req.method,
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.connection.remoteAddress,
    body: req.body,
    params: req.params,
    query: req.query
  }, {
    requestId: req.requestId,
    userId: req.user?.id,
    error
  })

  // Prepare error response
  const errorResponse: ErrorResponse = {
    error: {
      code,
      message,
      ...(details && { details }),
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    },
    timestamp: new Date().toISOString(),
    requestId: req.requestId || 'unknown',
    path: req.url
  }

  res.status(statusCode).json(errorResponse)
}

// 404 handler
export const notFoundHandler = (req: Request, res: Response): void => {
  const error = new NotFoundError(`Route ${req.method} ${req.url} not found`)
  
  logger.warn('Route not found', {
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.connection.remoteAddress
  }, {
    requestId: req.requestId,
    userId: req.user?.id
  })

  const errorResponse: ErrorResponse = {
    error: {
      code: error.code,
      message: error.message
    },
    timestamp: new Date().toISOString(),
    requestId: req.requestId || 'unknown',
    path: req.url
  }

  res.status(404).json(errorResponse)
}

// Async error wrapper
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}

// Graceful shutdown handler
export const gracefulShutdown = (server: any, websocketService?: any) => {
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, starting graceful shutdown`)
    
    server.close(async () => {
      logger.info('HTTP server closed')
      
      // Close WebSocket service and Redis connections
      if (websocketService) {
        try {
          await websocketService.shutdown()
          logger.info('WebSocket service shutdown completed')
        } catch (error) {
          logger.error('Error shutting down WebSocket service:', error)
        }
      }
      
      // Close database connections
      // Close any other resources
      
      logger.info('Graceful shutdown completed')
      process.exit(0)
    })

    // Force shutdown after 30 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after timeout')
      process.exit(1)
    }, 30000)
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
}