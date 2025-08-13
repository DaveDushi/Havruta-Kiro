import { Request, Response, NextFunction } from 'express'
import { User } from '@prisma/client'
import { authService } from '../services/authService'

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: User
    }
  }
}

/**
 * Middleware to authenticate JWT tokens and protect routes
 */
export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization
    const token = authHeader && authHeader.split(' ')[1] // Bearer TOKEN

    if (!token) {
      res.status(401).json({
        error: {
          code: 'MISSING_TOKEN',
          message: 'Access token is required'
        },
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      })
      return
    }

    const user = await authService.validateJWT(token)

    if (!user) {
      res.status(401).json({
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid or expired access token'
        },
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      })
      return
    }

    // Update user's last active timestamp
    await authService.updateLastActive(user.id)

    // Attach user to request object
    req.user = user
    next()
  } catch (error) {
    console.error('Authentication middleware error:', error)
    res.status(500).json({
      error: {
        code: 'AUTH_ERROR',
        message: 'Internal authentication error'
      },
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id'] || 'unknown'
    })
  }
}

/**
 * Optional authentication middleware - doesn't fail if no token provided
 * Useful for routes that work for both authenticated and anonymous users
 */
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization
    const token = authHeader && authHeader.split(' ')[1]

    if (token) {
      const user = await authService.validateJWT(token)
      if (user) {
        req.user = user
        await authService.updateLastActive(user.id)
      }
    }

    next()
  } catch (error) {
    console.error('Optional auth middleware error:', error)
    // Don't fail the request, just continue without user
    next()
  }
}

/**
 * Middleware to check if user is authenticated (for use after authenticateToken)
 */
export const requireAuth = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({
      error: {
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication is required for this endpoint'
      },
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id'] || 'unknown'
    })
    return
  }

  next()
}