import { Router, Request, Response } from 'express'
import { havrutaService } from '../services/havrutaService'
import { invitationService } from '../services/invitationService'
import { authenticateToken } from '../middleware/auth'
import { z } from 'zod'

const router = Router()

// Apply authentication middleware to all routes
router.use(authenticateToken)

/**
 * POST /api/havrutot
 * Create a new Havruta
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    const havrutaData = {
      ...req.body,
      creatorId: userId
    }

    const havruta = await havrutaService.createHavruta(havrutaData)
    res.status(201).json(havruta)
  } catch (error) {
    console.error('Error creating Havruta:', error)
    const message = error instanceof Error ? error.message : 'Failed to create Havruta'
    res.status(400).json({ error: message })
  }
})

/**
 * GET /api/havrutot
 * Get user's Havrutot with pagination and filtering
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    const result = await havrutaService.getUserHavrutot(userId, req.query)
    res.json(result)
  } catch (error) {
    console.error('Error fetching Havrutot:', error)
    const message = error instanceof Error ? error.message : 'Failed to fetch Havrutot'
    res.status(500).json({ error: message })
  }
})

/**
 * GET /api/havrutot/active
 * Get user's active Havrutot for dashboard
 */
router.get('/active', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    const havrutot = await havrutaService.getActiveHavrutot(userId)
    res.json(havrutot)
  } catch (error) {
    console.error('Error fetching active Havrutot:', error)
    const message = error instanceof Error ? error.message : 'Failed to fetch active Havrutot'
    res.status(500).json({ error: message })
  }
})

/**
 * GET /api/havrutot/:id
 * Get Havruta by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id
    const havrutaId = req.params.id

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    // Check if user has access to this Havruta
    const hasAccess = await havrutaService.hasAccess(havrutaId, userId)
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this Havruta' })
    }

    const havruta = await havrutaService.getHavrutaById(havrutaId)
    if (!havruta) {
      return res.status(404).json({ error: 'Havruta not found' })
    }

    res.json(havruta)
  } catch (error) {
    console.error('Error fetching Havruta:', error)
    const message = error instanceof Error ? error.message : 'Failed to fetch Havruta'
    res.status(500).json({ error: message })
  }
})

/**
 * PUT /api/havrutot/:id
 * Update Havruta (only by creator)
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id
    const havrutaId = req.params.id

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    const havruta = await havrutaService.updateHavruta(havrutaId, req.body, userId)
    res.json(havruta)
  } catch (error) {
    console.error('Error updating Havruta:', error)
    const message = error instanceof Error ? error.message : 'Failed to update Havruta'
    const statusCode = message.includes('not found') ? 404 : 
                      message.includes('Only the creator') ? 403 : 400
    res.status(statusCode).json({ error: message })
  }
})

/**
 * DELETE /api/havrutot/:id
 * Delete Havruta (only by creator)
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id
    const havrutaId = req.params.id

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    await havrutaService.deleteHavruta(havrutaId, userId)
    res.status(204).send()
  } catch (error) {
    console.error('Error deleting Havruta:', error)
    const message = error instanceof Error ? error.message : 'Failed to delete Havruta'
    const statusCode = message.includes('not found') ? 404 : 
                      message.includes('Only the creator') ? 403 : 400
    res.status(statusCode).json({ error: message })
  }
})

/**
 * POST /api/havrutot/:id/join
 * Join a Havruta
 */
router.post('/:id/join', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id
    const havrutaId = req.params.id

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    const participant = await havrutaService.joinHavruta({ userId, havrutaId })
    res.status(201).json(participant)
  } catch (error) {
    console.error('Error joining Havruta:', error)
    const message = error instanceof Error ? error.message : 'Failed to join Havruta'
    const statusCode = message.includes('not found') ? 404 : 
                      message.includes('full') || message.includes('already a participant') || 
                      message.includes('inactive') ? 400 : 500
    res.status(statusCode).json({ error: message })
  }
})

/**
 * POST /api/havrutot/:id/leave
 * Leave a Havruta
 */
router.post('/:id/leave', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id
    const havrutaId = req.params.id

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    await havrutaService.leaveHavruta(userId, havrutaId)
    res.status(204).send()
  } catch (error) {
    console.error('Error leaving Havruta:', error)
    const message = error instanceof Error ? error.message : 'Failed to leave Havruta'
    const statusCode = message.includes('not found') || message.includes('not a participant') ? 404 : 500
    res.status(statusCode).json({ error: message })
  }
})

/**
 * GET /api/havrutot/:id/state
 * Get Havruta state for real-time synchronization
 */
router.get('/:id/state', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id
    const havrutaId = req.params.id

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    // Check if user has access to this Havruta
    const hasAccess = await havrutaService.hasAccess(havrutaId, userId)
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this Havruta' })
    }

    const state = await havrutaService.getHavrutaState(havrutaId)
    if (!state) {
      return res.status(404).json({ error: 'Havruta not found' })
    }

    res.json(state)
  } catch (error) {
    console.error('Error fetching Havruta state:', error)
    const message = error instanceof Error ? error.message : 'Failed to fetch Havruta state'
    res.status(500).json({ error: message })
  }
})

/**
 * PUT /api/havrutot/:id/progress
 * Update Havruta progress (current section)
 */
router.put('/:id/progress', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id
    const havrutaId = req.params.id
    const { currentSection } = req.body

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    if (!currentSection || typeof currentSection !== 'string') {
      return res.status(400).json({ error: 'Current section is required' })
    }

    await havrutaService.updateProgress(havrutaId, currentSection, userId)
    res.status(204).send()
  } catch (error) {
    console.error('Error updating Havruta progress:', error)
    const message = error instanceof Error ? error.message : 'Failed to update progress'
    const statusCode = message.includes('not a participant') ? 403 : 500
    res.status(statusCode).json({ error: message })
  }
})

/**
 * POST /api/havrutot/:id/invite
 * Invite participants to a Havruta by email
 */
router.post('/:id/invite', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id
    const havrutaId = req.params.id
    const { emails } = req.body

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    // Validate emails array
    if (!Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({ error: 'Emails array is required and must not be empty' })
    }

    // Validate each email format
    const emailSchema = z.string().email()
    for (const email of emails) {
      try {
        emailSchema.parse(email)
      } catch {
        return res.status(400).json({ error: `Invalid email format: ${email}` })
      }
    }

    const result = await havrutaService.inviteParticipants(havrutaId, emails, userId)
    res.json(result)
  } catch (error) {
    console.error('Error inviting participants:', error)
    const message = error instanceof Error ? error.message : 'Failed to invite participants'
    const statusCode = message.includes('not found') ? 404 : 
                      message.includes('Only participants') ? 403 : 400
    res.status(statusCode).json({ error: message })
  }
})

/**
 * GET /api/havrutot/:id/invitations
 * Get invitations for a Havruta
 */
router.get('/:id/invitations', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id
    const havrutaId = req.params.id

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    // Check if user has access to this Havruta
    const hasAccess = await havrutaService.hasAccess(havrutaId, userId)
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this Havruta' })
    }

    const invitations = await invitationService.getHavrutaInvitations(havrutaId)
    res.json(invitations)
  } catch (error) {
    console.error('Error fetching Havruta invitations:', error)
    const message = error instanceof Error ? error.message : 'Failed to fetch invitations'
    res.status(500).json({ error: message })
  }
})

export default router