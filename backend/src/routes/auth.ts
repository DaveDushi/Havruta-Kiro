import express from 'express'
import passport from '../config/passport'
import { authService } from '../services/authService'
import { authenticateToken } from '../middleware/auth'

const router = express.Router()

/**
 * GET /api/auth/google
 * Initiate Google OAuth flow
 */
router.get('/google',
  passport.authenticate('google', {
    scope: ['profile', 'email']
  })
)

/**
 * GET /api/auth/google/callback
 * Handle Google OAuth callback
 */
router.get('/google/callback',
  passport.authenticate('google', { session: false }),
  (req, res) => {
    try {
      if (!req.user) {
        return res.redirect(`${process.env.FRONTEND_URL}/login?error=oauth_failed`)
      }

      // Generate JWT token
      const token = authService.generateJWT(req.user as any)

      // Redirect to frontend callback page with token
      res.redirect(`${process.env.FRONTEND_URL}/auth/success?token=${token}&refreshToken=${token}`)
    } catch (error) {
      console.error('OAuth callback error:', error)
      res.redirect(`${process.env.FRONTEND_URL}/login?error=auth_failed`)
    }
  }
)

/**
 * POST /api/auth/logout
 * Logout user (client-side token removal)
 */
router.post('/logout', authenticateToken, (req, res) => {
  try {
    // In JWT-based auth, logout is primarily client-side
    // Server can optionally maintain a blacklist of tokens
    res.json({
      message: 'Logged out successfully',
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Logout error:', error)
    res.status(500).json({
      error: {
        code: 'LOGOUT_ERROR',
        message: 'Error during logout'
      },
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id'] || 'unknown'
    })
  }
})

/**
 * GET /api/auth/me
 * Get current user profile
 */
router.get('/me', authenticateToken, (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: {
          code: 'NOT_AUTHENTICATED',
          message: 'User not authenticated'
        },
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      })
    }

    // Return user profile without sensitive data
    const { id, email, name, profilePicture, createdAt, lastActiveAt } = req.user

    res.json({
      user: {
        id,
        email,
        name,
        profilePicture,
        createdAt,
        lastActiveAt
      },
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Get user profile error:', error)
    res.status(500).json({
      error: {
        code: 'PROFILE_ERROR',
        message: 'Error retrieving user profile'
      },
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id'] || 'unknown'
    })
  }
})

/**
 * POST /api/auth/refresh
 * Refresh JWT token (validate current token and issue new one)
 */
router.post('/refresh', authenticateToken, (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: {
          code: 'NOT_AUTHENTICATED',
          message: 'User not authenticated'
        },
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      })
    }

    // Generate new JWT token
    const newToken = authService.generateJWT(req.user)

    res.json({
      token: newToken,
      user: {
        id: req.user.id,
        email: req.user.email,
        name: req.user.name,
        profilePicture: req.user.profilePicture
      },
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Token refresh error:', error)
    res.status(500).json({
      error: {
        code: 'REFRESH_ERROR',
        message: 'Error refreshing token'
      },
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id'] || 'unknown'
    })
  }
})

export default router