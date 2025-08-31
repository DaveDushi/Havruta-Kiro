import { Router, Request, Response } from 'express'
import { sessionService } from '../services/sessionService'
import { authenticateToken } from '../middleware/auth'

const router = Router()

// Apply authentication middleware to all routes
router.use(authenticateToken)

/**
 * POST /api/sessions
 * Initialize a new session for a Havruta
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    const sessionData = {
      ...req.body,
      startTime: req.body.startTime ? new Date(req.body.startTime) : new Date()
    }

    const session = await sessionService.initializeSession(sessionData)
    res.status(201).json(session)
  } catch (error) {
    console.error('Error initializing session:', error)
    const message = error instanceof Error ? error.message : 'Failed to initialize session'
    const statusCode = message.includes('not found') ? 404 : 
                      message.includes('inactive') || message.includes('already an active') ? 400 : 500
    res.status(statusCode).json({ error: message })
  }
})

/**
 * POST /api/sessions/instant
 * Create an instant session for a Havruta
 */
router.post('/instant', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id
    const { havrutaId } = req.body

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    if (!havrutaId) {
      return res.status(400).json({ error: 'Havruta ID is required' })
    }

    const session = await sessionService.createInstantSession(havrutaId, userId)
    res.status(201).json(session)
  } catch (error) {
    console.error('Error creating instant session:', error)
    const message = error instanceof Error ? error.message : 'Failed to create instant session'
    const statusCode = message.includes('not found') ? 404 : 
                      message.includes('inactive') || message.includes('already an active') || 
                      message.includes('owner') ? 400 : 500
    res.status(statusCode).json({ error: message })
  }
})

/**
 * POST /api/sessions/:id/activate
 * Activate a scheduled session
 */
router.post('/:id/activate', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id
    const sessionId = req.params.id

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    // Check if user has access to this session
    const hasAccess = await sessionService.hasSessionAccess(sessionId, userId)
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this session' })
    }

    await sessionService.activateSession(sessionId)
    res.status(204).send()
  } catch (error) {
    console.error('Error activating session:', error)
    const message = error instanceof Error ? error.message : 'Failed to activate session'
    const statusCode = message.includes('not found') ? 404 : 
                      message.includes('Only scheduled') ? 400 : 500
    res.status(statusCode).json({ error: message })
  }
})

/**
 * GET /api/sessions/active
 * Get user's active sessions
 */
router.get('/active', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    const sessions = await sessionService.getUserActiveSessions(userId)
    res.json(sessions)
  } catch (error) {
    console.error('Error fetching active sessions:', error)
    const message = error instanceof Error ? error.message : 'Failed to fetch active sessions'
    res.status(500).json({ error: message })
  }
})

/**
 * GET /api/sessions/:id
 * Get session by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id
    const sessionId = req.params.id

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    // Check if user has access to this session
    const hasAccess = await sessionService.hasSessionAccess(sessionId, userId)
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this session' })
    }

    const session = await sessionService.getSessionById(sessionId)
    if (!session) {
      return res.status(404).json({ error: 'Session not found' })
    }

    res.json(session)
  } catch (error) {
    console.error('Error fetching session:', error)
    const message = error instanceof Error ? error.message : 'Failed to fetch session'
    res.status(500).json({ error: message })
  }
})

/**
 * GET /api/sessions/:id/state
 * Get session state for real-time synchronization
 */
router.get('/:id/state', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id
    const sessionId = req.params.id

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    // Check if user has access to this session
    const hasAccess = await sessionService.hasSessionAccess(sessionId, userId)
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this session' })
    }

    const state = await sessionService.getSessionState(sessionId)
    if (!state) {
      return res.status(404).json({ error: 'Session not found' })
    }

    res.json(state)
  } catch (error) {
    console.error('Error fetching session state:', error)
    const message = error instanceof Error ? error.message : 'Failed to fetch session state'
    res.status(500).json({ error: message })
  }
})

/**
 * POST /api/sessions/:id/join
 * Join a session
 */
router.post('/:id/join', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id
    const sessionId = req.params.id

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    const participant = await sessionService.joinSession({ userId, sessionId })
    res.status(201).json(participant)
  } catch (error) {
    console.error('Error joining session:', error)
    const message = error instanceof Error ? error.message : 'Failed to join session'
    const statusCode = message.includes('not found') ? 404 : 
                      message.includes('ended') || message.includes('already in') || 
                      message.includes('not a participant') ? 400 : 500
    res.status(statusCode).json({ error: message })
  }
})

/**
 * POST /api/sessions/:id/join-instant
 * One-click join for instant sessions with session details
 */
router.post('/:id/join-instant', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id
    const sessionId = req.params.id

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    // Join the session
    const participant = await sessionService.joinSession({ userId, sessionId })
    
    // Get full session details for immediate use
    const session = await sessionService.getSessionById(sessionId)
    if (!session) {
      return res.status(404).json({ error: 'Session not found after joining' })
    }

    // Return both participant info and session details for one-click experience
    res.status(201).json({
      participant,
      session,
      redirectUrl: `/havruta/${session.havrutaId}/session/${sessionId}`
    })
  } catch (error) {
    console.error('Error joining instant session:', error)
    const message = error instanceof Error ? error.message : 'Failed to join instant session'
    const statusCode = message.includes('not found') ? 404 : 
                      message.includes('ended') || message.includes('already in') || 
                      message.includes('not a participant') ? 400 : 500
    res.status(statusCode).json({ error: message })
  }
})

/**
 * POST /api/sessions/:id/leave
 * Leave a session
 */
router.post('/:id/leave', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id
    const sessionId = req.params.id

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    await sessionService.leaveSession(userId, sessionId)
    res.status(204).send()
  } catch (error) {
    console.error('Error leaving session:', error)
    const message = error instanceof Error ? error.message : 'Failed to leave session'
    const statusCode = message.includes('not found') || message.includes('not in') || 
                      message.includes('already left') ? 404 : 500
    res.status(statusCode).json({ error: message })
  }
})

/**
 * POST /api/sessions/:id/end
 * End a session with coverage tracking
 */
router.post('/:id/end', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id
    const sessionId = req.params.id
    const { endingSection, coverageRange } = req.body

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    if (!endingSection) {
      return res.status(400).json({ error: 'Ending section is required' })
    }

    await sessionService.endSession(sessionId, userId, { endingSection, coverageRange })
    res.status(204).send()
  } catch (error) {
    console.error('Error ending session:', error)
    const message = error instanceof Error ? error.message : 'Failed to end session'
    const statusCode = message.includes('not found') ? 404 : 
                      message.includes('already ended') || message.includes('permission') || 
                      message.includes('owner') ? 403 : 
                      message.includes('Validation error') ? 400 : 500
    res.status(statusCode).json({ error: message })
  }
})

/**
 * PUT /api/sessions/:id/progress
 * Update session progress
 */
router.put('/:id/progress', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id
    const sessionId = req.params.id
    const { sectionsStudied } = req.body

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    if (!Array.isArray(sectionsStudied)) {
      return res.status(400).json({ error: 'Sections studied must be an array' })
    }

    await sessionService.updateSessionProgress(sessionId, sectionsStudied, userId)
    res.status(204).send()
  } catch (error) {
    console.error('Error updating session progress:', error)
    const message = error instanceof Error ? error.message : 'Failed to update session progress'
    const statusCode = message.includes('not in') ? 403 : 500
    res.status(statusCode).json({ error: message })
  }
})

/**
 * PUT /api/sessions/:id/user-progress
 * Track individual user progress in session
 */
router.put('/:id/user-progress', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id
    const sessionId = req.params.id

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    await sessionService.trackUserProgress(sessionId, userId, req.body)
    res.status(204).send()
  } catch (error) {
    console.error('Error tracking user progress:', error)
    const message = error instanceof Error ? error.message : 'Failed to track user progress'
    const statusCode = message.includes('not in') ? 403 : 
                      message.includes('Validation error') ? 400 : 500
    res.status(statusCode).json({ error: message })
  }
})

/**
 * GET /api/sessions/havruta/:havrutaId/active
 * Get active session for a Havruta
 */
router.get('/havruta/:havrutaId/active', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id
    const havrutaId = req.params.havrutaId

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    const session = await sessionService.getActiveSessionForHavruta(havrutaId)
    if (!session) {
      return res.status(404).json({ error: 'No active session found for this Havruta' })
    }

    // Check if user has access to this session
    const hasAccess = await sessionService.hasSessionAccess(session.id, userId)
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this session' })
    }

    res.json(session)
  } catch (error) {
    console.error('Error fetching active session for Havruta:', error)
    const message = error instanceof Error ? error.message : 'Failed to fetch active session'
    res.status(500).json({ error: message })
  }
})

/**
 * GET /api/sessions/havruta/:havrutaId/history
 * Get session history for a Havruta
 */
router.get('/havruta/:havrutaId/history', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id
    const havrutaId = req.params.havrutaId

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    const sessions = await sessionService.getHavrutaSessionHistory(havrutaId, userId)
    res.json(sessions)
  } catch (error) {
    console.error('Error fetching session history:', error)
    const message = error instanceof Error ? error.message : 'Failed to fetch session history'
    const statusCode = message.includes('does not have access') ? 403 : 500
    res.status(statusCode).json({ error: message })
  }
})

export default router