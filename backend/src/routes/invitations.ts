import { Router, Request, Response } from 'express'
import { invitationService } from '../services/invitationService'
import { authenticateToken } from '../middleware/auth'

const router = Router()

/**
 * GET /api/invitations/:token
 * Get invitation details by token (public route for invitation preview)
 */
router.get('/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params

    if (!token) {
      return res.status(400).json({ error: 'Invitation token is required' })
    }

    const invitation = await invitationService.getInvitationByToken(token)
    
    if (!invitation) {
      return res.status(404).json({ error: 'Invitation not found' })
    }

    // Check if invitation is still valid
    if (invitation.status !== 'pending') {
      return res.status(400).json({ 
        error: 'Invitation is no longer valid',
        status: invitation.status
      })
    }

    if (invitation.expiresAt < new Date()) {
      return res.status(400).json({ 
        error: 'Invitation has expired',
        status: 'expired'
      })
    }

    // Return invitation details (without sensitive information)
    res.json({
      id: invitation.id,
      inviteeEmail: invitation.inviteeEmail,
      status: invitation.status,
      createdAt: invitation.createdAt,
      expiresAt: invitation.expiresAt,
      havruta: {
        id: invitation.havruta.id,
        name: invitation.havruta.name,
        bookTitle: invitation.havruta.bookTitle
      },
      inviter: {
        name: invitation.inviterUser.name,
        profilePicture: invitation.inviterUser.profilePicture
      }
    })
  } catch (error) {
    console.error('Error fetching invitation:', error)
    const message = error instanceof Error ? error.message : 'Failed to fetch invitation'
    res.status(500).json({ error: message })
  }
})

/**
 * POST /api/invitations/:token/accept
 * Accept an invitation (requires authentication)
 */
router.post('/:token/accept', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id
    const { token } = req.params

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    if (!token) {
      return res.status(400).json({ error: 'Invitation token is required' })
    }

    await invitationService.acceptInvitation({ token, userId })
    res.json({ message: 'Invitation accepted successfully' })
  } catch (error) {
    console.error('Error accepting invitation:', error)
    const message = error instanceof Error ? error.message : 'Failed to accept invitation'
    const statusCode = message.includes('not found') ? 404 : 
                      message.includes('expired') || message.includes('no longer valid') || 
                      message.includes('does not match') ? 400 : 500
    res.status(statusCode).json({ error: message })
  }
})

/**
 * POST /api/invitations/:token/decline
 * Decline an invitation (public route)
 */
router.post('/:token/decline', async (req: Request, res: Response) => {
  try {
    const { token } = req.params

    if (!token) {
      return res.status(400).json({ error: 'Invitation token is required' })
    }

    await invitationService.declineInvitation(token)
    res.json({ message: 'Invitation declined successfully' })
  } catch (error) {
    console.error('Error declining invitation:', error)
    const message = error instanceof Error ? error.message : 'Failed to decline invitation'
    const statusCode = message.includes('not found') || message.includes('no longer valid') ? 404 : 500
    res.status(statusCode).json({ error: message })
  }
})

export default router