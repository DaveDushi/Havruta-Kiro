import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import authRoutes from '../routes/auth'
import { authService } from '../services/authService'

// Mock authService
vi.mock('../services/authService', () => ({
  authService: {
    generateJWT: vi.fn(),
    validateJWT: vi.fn(),
    updateLastActive: vi.fn()
  }
}))

// Mock passport
vi.mock('../config/passport', () => ({
  default: {
    authenticate: vi.fn(() => (req: any, res: any, next: any) => {
      // Mock passport middleware behavior
      if (req.url === '/google') {
        // Simulate redirect to Google
        res.redirect = vi.fn()
        res.redirect('https://accounts.google.com/oauth/authorize')
        return
      }
      if (req.url === '/google/callback') {
        // Simulate successful OAuth callback
        req.user = {
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
          profilePicture: 'https://example.com/avatar.jpg'
        }
      }
      next()
    })
  }
}))

// Mock middleware
vi.mock('../middleware/auth', () => ({
  authenticateToken: vi.fn((req, res, next) => {
    // Mock authenticated user for protected routes
    if (req.headers.authorization === 'Bearer valid-token') {
      req.user = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        profilePicture: 'https://example.com/avatar.jpg',
        createdAt: new Date('2023-01-01'),
        lastActiveAt: new Date('2023-01-02')
      }
      next()
    } else {
      // Return 401 for missing or invalid token
      res.status(401).json({
        error: {
          code: 'MISSING_TOKEN',
          message: 'Access token is required'
        },
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      })
    }
  })
}))

describe('Auth Routes', () => {
  let app: express.Application
  
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    profilePicture: 'https://example.com/avatar.jpg',
    createdAt: new Date('2023-01-01'),
    lastActiveAt: new Date('2023-01-02')
  }

  beforeEach(() => {
    app = express()
    app.use(express.json())
    app.use('/api/auth', authRoutes)
    
    // Set environment variables
    process.env.FRONTEND_URL = 'http://localhost:3000'
    
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('POST /api/auth/logout', () => {
    it('should logout authenticated user successfully', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', 'Bearer valid-token')
        .expect(200)

      expect(response.body).toEqual({
        message: 'Logged out successfully',
        timestamp: expect.any(String)
      })
    })

    it('should handle logout without authentication', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .expect(401)

      expect(response.body.error.code).toBe('MISSING_TOKEN')
    })
  })

  describe('GET /api/auth/me', () => {
    it('should return user profile for authenticated user', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer valid-token')
        .expect(200)

      expect(response.body).toEqual({
        user: {
          id: mockUser.id,
          email: mockUser.email,
          name: mockUser.name,
          profilePicture: mockUser.profilePicture,
          createdAt: mockUser.createdAt.toISOString(),
          lastActiveAt: mockUser.lastActiveAt.toISOString()
        },
        timestamp: expect.any(String)
      })
    })

    it('should return 401 for unauthenticated request', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .expect(401)

      expect(response.body.error.code).toBe('MISSING_TOKEN')
    })
  })

  describe('POST /api/auth/refresh', () => {
    it('should refresh token for authenticated user', async () => {
      const newToken = 'new-jwt-token'
      vi.mocked(authService.generateJWT).mockReturnValue(newToken)

      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Authorization', 'Bearer valid-token')
        .expect(200)

      expect(response.body).toEqual({
        token: newToken,
        user: {
          id: mockUser.id,
          email: mockUser.email,
          name: mockUser.name,
          profilePicture: mockUser.profilePicture
        },
        timestamp: expect.any(String)
      })

      expect(authService.generateJWT).toHaveBeenCalledWith(
        expect.objectContaining({
          id: mockUser.id,
          email: mockUser.email
        })
      )
    })

    it('should return 401 for unauthenticated request', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .expect(401)

      expect(response.body.error.code).toBe('MISSING_TOKEN')
    })
  })

  describe('Error handling', () => {
    it('should handle service errors gracefully', async () => {
      vi.mocked(authService.generateJWT).mockImplementation(() => {
        throw new Error('Service error')
      })

      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Authorization', 'Bearer valid-token')
        .expect(500)

      expect(response.body.error.code).toBe('REFRESH_ERROR')
    })
  })
})