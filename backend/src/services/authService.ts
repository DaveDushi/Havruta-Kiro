import jwt from 'jsonwebtoken'
import { User } from '@prisma/client'
import { prisma } from '../utils/database'

export interface JWTPayload {
  userId: string
  email: string
  iat?: number
  exp?: number
}

export class AuthService {
  private readonly jwtSecret: string
  private readonly jwtExpiresIn: string

  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'fallback-secret-key'
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '7d'
    
    if (!process.env.JWT_SECRET) {
      console.warn('JWT_SECRET not set in environment variables')
    }
  }

  /**
   * Generate JWT token for authenticated user
   */
  generateJWT(user: User): string {
    const payload: JWTPayload = {
      userId: user.id,
      email: user.email
    }

    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.jwtExpiresIn
    })
  }

  /**
   * Validate JWT token and return user data
   */
  async validateJWT(token: string): Promise<User | null> {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as JWTPayload
      
      // Fetch user from database to ensure they still exist
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId }
      })

      return user
    } catch (error) {
      console.error('JWT validation error:', error)
      return null
    }
  }

  /**
   * Create or update user from OAuth provider data
   */
  async authenticateOAuth(
    provider: 'google',
    oauthId: string,
    email: string,
    name: string,
    profilePicture?: string
  ): Promise<User> {
    try {
      // Try to find existing user by OAuth ID
      let user = await prisma.user.findFirst({
        where: {
          oauthProvider: provider,
          oauthId: oauthId
        }
      })

      if (user) {
        // Update existing user's last active time and profile info
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            name,
            profilePicture,
            lastActiveAt: new Date()
          }
        })
      } else {
        // Check if user exists with same email but different OAuth provider
        const existingUser = await prisma.user.findUnique({
          where: { email }
        })

        if (existingUser) {
          throw new Error('User with this email already exists with different OAuth provider')
        }

        // Create new user
        user = await prisma.user.create({
          data: {
            email,
            name,
            profilePicture,
            oauthProvider: provider,
            oauthId,
            lastActiveAt: new Date()
          }
        })
      }

      return user
    } catch (error) {
      console.error('OAuth authentication error:', error)
      throw error
    }
  }

  /**
   * Refresh user's last active timestamp
   */
  async updateLastActive(userId: string): Promise<void> {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { lastActiveAt: new Date() }
      })
    } catch (error) {
      console.error('Error updating last active:', error)
    }
  }
}

export const authService = new AuthService()