import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { Request, Response, NextFunction } from 'express'
import { authenticateToken, optionalAuth, requireAuth } from '../middleware/auth'
import { authService } from '../services/authService'

// Mock authService
vi.mock('../services/authService', () => ({
  authService: {
    validateJWT: vi.fn(),
    updateLastActive: vi.fn()
  }
}))

describe('Auth Middleware', () => {
  let mockReq: Partial<Request>
  let mockRes: Partial<Response>
  let mockNext: NextFunction
  let jsonSpy: ReturnType<typeof vi.fn>
  let statusSpy: ReturnType<typeof vi.fn>

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    profilePicture: null,
    oauthProvider: 'google' as const,
    oauthId: 'google-123',
    createdAt: new Date(),
    lastActiveAt: new Date()
  }

  beforeEach(() => {
    jsonSpy = vi.fn()
    statusSpy = vi.fn().mockReturnValue({ json: jsonSpy })
    
    mockReq = {
      headers: {},
      user: undefined
    }
    
    mockRes = {
      status: statusSpy,
      json: jsonSpy
    }
    
    mockNext = vi.fn()
    
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('authenticateToken', () => {
    it('should authenticate valid token and attach user to request', async () => {
      mockReq.headers = {
        authorization: 'Bearer valid-token'
      }
      
      vi.mocked(authService.validateJWT).mockResolvedValue(mockUser)
      vi.mocked(authService.updateLastActive).mockResolvedValue()
      
      await authenticateToken(mockReq as Request, mockRes as Response, mockNext)
      
      expect(authService.validateJWT).toHaveBeenCalledWith('valid-token')
      expect(authService.updateLastActive).toHaveBeenCalledWith(mockUser.id)
      expect(mockReq.user).toEqual(mockUser)
      expect(mockNext).toHaveBeenCalled()
      expect(statusSpy).not.toHaveBeenCalled()
    })

    it('should return 401 when no authorization header provided', async () => {
      mockReq.headers = {}
      
      await authenticateToken(mockReq as Request, mockRes as Response, mockNext)
      
      expect(statusSpy).toHaveBeenCalledWith(401)
      expect(jsonSpy).toHaveBeenCalledWith({
        error: {
          code: 'MISSING_TOKEN',
          message: 'Access token is required'
        },
        timestamp: expect.any(String),
        requestId: 'unknown'
      })
      expect(mockNext).not.toHaveBeenCalled()
    })

    it('should return 401 when authorization header is malformed', async () => {
      mockReq.headers = {
        authorization: 'InvalidFormat'
      }
      
      await authenticateToken(mockReq as Request, mockRes as Response, mockNext)
      
      expect(statusSpy).toHaveBeenCalledWith(401)
      expect(jsonSpy).toHaveBeenCalledWith({
        error: {
          code: 'MISSING_TOKEN',
          message: 'Access token is required'
        },
        timestamp: expect.any(String),
        requestId: 'unknown'
      })
    })

    it('should return 401 when token is invalid', async () => {
      mockReq.headers = {
        authorization: 'Bearer invalid-token'
      }
      
      vi.mocked(authService.validateJWT).mockResolvedValue(null)
      
      await authenticateToken(mockReq as Request, mockRes as Response, mockNext)
      
      expect(statusSpy).toHaveBeenCalledWith(401)
      expect(jsonSpy).toHaveBeenCalledWith({
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid or expired access token'
        },
        timestamp: expect.any(String),
        requestId: 'unknown'
      })
      expect(mockNext).not.toHaveBeenCalled()
    })

    it('should return 500 when authentication service throws error', async () => {
      mockReq.headers = {
        authorization: 'Bearer valid-token'
      }
      
      vi.mocked(authService.validateJWT).mockRejectedValue(new Error('Service error'))
      
      await authenticateToken(mockReq as Request, mockRes as Response, mockNext)
      
      expect(statusSpy).toHaveBeenCalledWith(500)
      expect(jsonSpy).toHaveBeenCalledWith({
        error: {
          code: 'AUTH_ERROR',
          message: 'Internal authentication error'
        },
        timestamp: expect.any(String),
        requestId: 'unknown'
      })
    })

    it('should use request ID from headers when available', async () => {
      mockReq.headers = {
        'x-request-id': 'test-request-123'
      }
      
      await authenticateToken(mockReq as Request, mockRes as Response, mockNext)
      
      expect(jsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 'test-request-123'
        })
      )
    })
  })

  describe('optionalAuth', () => {
    it('should attach user when valid token provided', async () => {
      mockReq.headers = {
        authorization: 'Bearer valid-token'
      }
      
      vi.mocked(authService.validateJWT).mockResolvedValue(mockUser)
      vi.mocked(authService.updateLastActive).mockResolvedValue()
      
      await optionalAuth(mockReq as Request, mockRes as Response, mockNext)
      
      expect(mockReq.user).toEqual(mockUser)
      expect(authService.updateLastActive).toHaveBeenCalledWith(mockUser.id)
      expect(mockNext).toHaveBeenCalled()
      expect(statusSpy).not.toHaveBeenCalled()
    })

    it('should continue without user when no token provided', async () => {
      mockReq.headers = {}
      
      await optionalAuth(mockReq as Request, mockRes as Response, mockNext)
      
      expect(mockReq.user).toBeUndefined()
      expect(mockNext).toHaveBeenCalled()
      expect(statusSpy).not.toHaveBeenCalled()
    })

    it('should continue without user when token is invalid', async () => {
      mockReq.headers = {
        authorization: 'Bearer invalid-token'
      }
      
      vi.mocked(authService.validateJWT).mockResolvedValue(null)
      
      await optionalAuth(mockReq as Request, mockRes as Response, mockNext)
      
      expect(mockReq.user).toBeUndefined()
      expect(mockNext).toHaveBeenCalled()
      expect(statusSpy).not.toHaveBeenCalled()
    })

    it('should continue without user when service throws error', async () => {
      mockReq.headers = {
        authorization: 'Bearer valid-token'
      }
      
      vi.mocked(authService.validateJWT).mockRejectedValue(new Error('Service error'))
      
      await optionalAuth(mockReq as Request, mockRes as Response, mockNext)
      
      expect(mockReq.user).toBeUndefined()
      expect(mockNext).toHaveBeenCalled()
      expect(statusSpy).not.toHaveBeenCalled()
    })
  })

  describe('requireAuth', () => {
    it('should continue when user is authenticated', () => {
      mockReq.user = mockUser
      
      requireAuth(mockReq as Request, mockRes as Response, mockNext)
      
      expect(mockNext).toHaveBeenCalled()
      expect(statusSpy).not.toHaveBeenCalled()
    })

    it('should return 401 when user is not authenticated', () => {
      mockReq.user = undefined
      
      requireAuth(mockReq as Request, mockRes as Response, mockNext)
      
      expect(statusSpy).toHaveBeenCalledWith(401)
      expect(jsonSpy).toHaveBeenCalledWith({
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication is required for this endpoint'
        },
        timestamp: expect.any(String),
        requestId: 'unknown'
      })
      expect(mockNext).not.toHaveBeenCalled()
    })
  })
})