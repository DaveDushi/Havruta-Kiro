import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import jwt from 'jsonwebtoken'
import { AuthService } from '../services/authService'
import { prisma } from '../utils/database'

// Mock Prisma
vi.mock('../utils/database', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    }
  }
}))

// Mock environment variables
const mockEnv = {
  JWT_SECRET: 'test-secret-key',
  JWT_EXPIRES_IN: '1h'
}

describe('AuthService', () => {
  let authService: AuthService
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    profilePicture: 'https://example.com/avatar.jpg',
    oauthProvider: 'google' as const,
    oauthId: 'google-123',
    createdAt: new Date(),
    lastActiveAt: new Date()
  }

  beforeEach(() => {
    // Set up environment variables
    process.env.JWT_SECRET = mockEnv.JWT_SECRET
    process.env.JWT_EXPIRES_IN = mockEnv.JWT_EXPIRES_IN
    
    authService = new AuthService()
    
    // Clear all mocks
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('generateJWT', () => {
    it('should generate a valid JWT token', () => {
      const token = authService.generateJWT(mockUser)
      
      expect(token).toBeDefined()
      expect(typeof token).toBe('string')
      
      // Verify token can be decoded
      const decoded = jwt.verify(token, mockEnv.JWT_SECRET) as any
      expect(decoded.userId).toBe(mockUser.id)
      expect(decoded.email).toBe(mockUser.email)
    })

    it('should include correct payload in JWT', () => {
      const token = authService.generateJWT(mockUser)
      const decoded = jwt.decode(token) as any
      
      expect(decoded.userId).toBe(mockUser.id)
      expect(decoded.email).toBe(mockUser.email)
      expect(decoded.iat).toBeDefined()
      expect(decoded.exp).toBeDefined()
    })
  })

  describe('validateJWT', () => {
    it('should validate a valid JWT token and return user', async () => {
      const token = authService.generateJWT(mockUser)
      
      // Mock database call
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser)
      
      const result = await authService.validateJWT(token)
      
      expect(result).toEqual(mockUser)
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: mockUser.id }
      })
    })

    it('should return null for invalid token', async () => {
      const invalidToken = 'invalid.token.here'
      
      const result = await authService.validateJWT(invalidToken)
      
      expect(result).toBeNull()
    })

    it('should return null if user not found in database', async () => {
      const token = authService.generateJWT(mockUser)
      
      // Mock user not found
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
      
      const result = await authService.validateJWT(token)
      
      expect(result).toBeNull()
    })

    it('should return null for expired token', async () => {
      // Create expired token
      const expiredToken = jwt.sign(
        { userId: mockUser.id, email: mockUser.email },
        mockEnv.JWT_SECRET,
        { expiresIn: '-1h' } // Expired 1 hour ago
      )
      
      const result = await authService.validateJWT(expiredToken)
      
      expect(result).toBeNull()
    })
  })

  describe('authenticateOAuth', () => {
    it('should create new user for first-time OAuth login', async () => {
      // Mock user not found, then created
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
      vi.mocked(prisma.user.create).mockResolvedValue(mockUser)
      
      const result = await authService.authenticateOAuth(
        'google',
        'google-123',
        'test@example.com',
        'Test User',
        'https://example.com/avatar.jpg'
      )
      
      expect(result).toEqual(mockUser)
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          email: 'test@example.com',
          name: 'Test User',
          profilePicture: 'https://example.com/avatar.jpg',
          oauthProvider: 'google',
          oauthId: 'google-123',
          lastActiveAt: expect.any(Date)
        }
      })
    })

    it('should update existing user on subsequent OAuth login', async () => {
      const updatedUser = { ...mockUser, name: 'Updated Name' }
      
      // Mock existing user found, then updated
      vi.mocked(prisma.user.findFirst).mockResolvedValue(mockUser)
      vi.mocked(prisma.user.update).mockResolvedValue(updatedUser)
      
      const result = await authService.authenticateOAuth(
        'google',
        'google-123',
        'test@example.com',
        'Updated Name',
        'https://example.com/new-avatar.jpg'
      )
      
      expect(result).toEqual(updatedUser)
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: {
          name: 'Updated Name',
          profilePicture: 'https://example.com/new-avatar.jpg',
          lastActiveAt: expect.any(Date)
        }
      })
    })

    it('should throw error if email exists with different OAuth provider', async () => {
      const existingUser = { ...mockUser, oauthProvider: 'apple' as const }
      
      // Mock no user found by OAuth ID, but user found by email
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.user.findUnique).mockResolvedValue(existingUser)
      
      await expect(
        authService.authenticateOAuth(
          'google',
          'google-123',
          'test@example.com',
          'Test User'
        )
      ).rejects.toThrow('User with this email already exists with different OAuth provider')
    })
  })

  describe('updateLastActive', () => {
    it('should update user last active timestamp', async () => {
      vi.mocked(prisma.user.update).mockResolvedValue(mockUser)
      
      await authService.updateLastActive(mockUser.id)
      
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { lastActiveAt: expect.any(Date) }
      })
    })

    it('should handle database errors gracefully', async () => {
      vi.mocked(prisma.user.update).mockRejectedValue(new Error('Database error'))
      
      // Should not throw error
      await expect(authService.updateLastActive(mockUser.id)).resolves.toBeUndefined()
    })
  })
})