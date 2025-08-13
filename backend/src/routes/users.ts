import express from 'express'
import { authenticateToken } from '../middleware/auth'
import { userService } from '../services/userService'
import { z } from 'zod'

const router = express.Router()

/**
 * GET /api/users/profile
 * Get current user's profile with statistics
 */
router.get('/profile', authenticateToken, async (req, res) => {
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

    const userProfile = await userService.getUserProfile(req.user.id)
    
    if (!userProfile) {
      return res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User profile not found'
        },
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      })
    }

    // Remove sensitive data and format response
    const { oauthId, ...safeUserData } = userProfile
    
    res.json({
      user: safeUserData,
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
 * PUT /api/users/profile
 * Update current user's profile
 */
router.put('/profile', authenticateToken, async (req, res) => {
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

    const updatedUser = await userService.updateUserProfile(req.user.id, req.body)
    
    // Remove sensitive data
    const { oauthId, ...safeUserData } = updatedUser
    
    res.json({
      user: safeUserData,
      message: 'Profile updated successfully',
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Update user profile error:', error)
    
    if (error instanceof Error && error.message.includes('Validation error')) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.message
        },
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      })
    }
    
    res.status(500).json({
      error: {
        code: 'UPDATE_ERROR',
        message: 'Error updating user profile'
      },
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id'] || 'unknown'
    })
  }
})

/**
 * DELETE /api/users/profile
 * Delete current user's account
 */
router.delete('/profile', authenticateToken, async (req, res) => {
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

    await userService.deleteUser(req.user.id)
    
    res.json({
      message: 'User account deleted successfully',
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Delete user error:', error)
    res.status(500).json({
      error: {
        code: 'DELETE_ERROR',
        message: 'Error deleting user account'
      },
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id'] || 'unknown'
    })
  }
})

/**
 * GET /api/users/:userId
 * Get user by ID (public profile information only)
 */
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params
    
    // Validate userId format (basic check)
    if (!userId || userId.length < 10) {
      return res.status(400).json({
        error: {
          code: 'INVALID_USER_ID',
          message: 'Invalid user ID format'
        },
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      })
    }

    const user = await userService.getUserById(userId)
    
    if (!user) {
      return res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found'
        },
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      })
    }

    // Return only public profile information
    const publicProfile = {
      id: user.id,
      name: user.name,
      profilePicture: user.profilePicture,
      createdAt: user.createdAt
    }
    
    res.json({
      user: publicProfile,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Get user by ID error:', error)
    res.status(500).json({
      error: {
        code: 'FETCH_ERROR',
        message: 'Error fetching user'
      },
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id'] || 'unknown'
    })
  }
})

/**
 * GET /api/users/profile/havrutot-summary
 * Get current user's Havrutot summary statistics
 */
router.get('/profile/havrutot-summary', authenticateToken, async (req, res) => {
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

    const summary = await userService.getUserHavrutotSummary(req.user.id)
    
    res.json({
      summary,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Get Havrutot summary error:', error)
    res.status(500).json({
      error: {
        code: 'SUMMARY_ERROR',
        message: 'Error fetching Havrutot summary'
      },
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id'] || 'unknown'
    })
  }
})

/**
 * GET /api/users
 * Get users with pagination and search (for admin or discovery features)
 * Note: In production, this would require additional authorization
 */
router.get('/', authenticateToken, async (req, res) => {
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

    const result = await userService.getUsers(req.query as any)
    
    // Remove sensitive data from all users
    const safeUsers = result.users.map(user => ({
      id: user.id,
      name: user.name,
      profilePicture: user.profilePicture,
      createdAt: user.createdAt,
      lastActiveAt: user.lastActiveAt
    }))
    
    res.json({
      users: safeUsers,
      pagination: result.pagination,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Get users error:', error)
    
    if (error instanceof Error && error.message.includes('Validation error')) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.message
        },
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      })
    }
    
    res.status(500).json({
      error: {
        code: 'FETCH_ERROR',
        message: 'Error fetching users'
      },
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id'] || 'unknown'
    })
  }
})

export default router