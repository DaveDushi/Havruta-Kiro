import { Router, Request, Response } from 'express'
import { authenticateToken } from '../middleware/auth'
import { schedulingService } from '../services/schedulingService'
import { notificationService } from '../services/notificationService'
import { z } from 'zod'

const router = Router()

// Validation schemas
const CreateScheduledSessionSchema = z.object({
  havrutaId: z.string().cuid(),
  startTime: z.string().datetime(),
  participantIds: z.array(z.string().cuid()).min(1),
  isRecurring: z.boolean().default(false),
  recurrencePattern: z.object({
    frequency: z.enum(['once', 'daily', 'weekly', 'bi-weekly', 'monthly']),
    interval: z.number().min(1).max(365).default(1),
    endDate: z.string().datetime().optional(),
    daysOfWeek: z.array(z.number().min(0).max(6)).optional().default([])
  }).optional()
})

const UpdateScheduledSessionSchema = z.object({
  startTime: z.string().datetime().optional(),
  updateFutureInstances: z.boolean().default(false)
})

const CancelSessionSchema = z.object({
  cancelFutureInstances: z.boolean().default(false)
})

/**
 * POST /api/scheduling/sessions
 * Create a new scheduled session
 */
router.post('/sessions', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    const validatedData = CreateScheduledSessionSchema.parse(req.body)
    
    let recurrencePatternId: string | undefined

    // Create recurrence pattern if this is a recurring session
    if (validatedData.isRecurring && validatedData.recurrencePattern) {
      const pattern = await schedulingService.createRecurrencePattern({
        frequency: validatedData.recurrencePattern.frequency,
        interval: validatedData.recurrencePattern.interval,
        endDate: validatedData.recurrencePattern.endDate ? new Date(validatedData.recurrencePattern.endDate) : undefined,
        daysOfWeek: validatedData.recurrencePattern.daysOfWeek
      })
      recurrencePatternId = pattern.id
    }

    // Generate sessions based on recurrence pattern or create single session
    if (validatedData.isRecurring && recurrencePatternId) {
      const sessions = await schedulingService.generateRecurringSessions({
        havrutaId: validatedData.havrutaId,
        startTime: new Date(validatedData.startTime),
        recurrencePatternId: recurrencePatternId
      })

      res.status(201).json({
        message: 'Recurring sessions created successfully',
        sessions: sessions,
        recurrencePatternId: recurrencePatternId
      })
    } else {
      // Create single session - first create a 'once' pattern
      const oncePattern = await schedulingService.createRecurrencePattern({
        frequency: 'once',
        interval: 1,
        daysOfWeek: []
      })

      const sessions = await schedulingService.generateRecurringSessions({
        havrutaId: validatedData.havrutaId,
        startTime: new Date(validatedData.startTime),
        recurrencePatternId: oncePattern.id
      }, 1)

      res.status(201).json({
        message: 'Session scheduled successfully',
        session: sessions[0]
      })
    }
  } catch (error) {
    console.error('Error creating scheduled session:', error)
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Validation error', 
        details: error.errors 
      })
    }
    res.status(500).json({ error: 'Failed to create scheduled session' })
  }
})

/**
 * GET /api/scheduling/sessions/upcoming
 * Get upcoming sessions for the authenticated user
 */
router.get('/sessions/upcoming', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    const { days = '30' } = req.query
    const daysAhead = parseInt(days as string, 10)
    
    const startDate = new Date()
    const endDate = new Date()
    endDate.setDate(endDate.getDate() + daysAhead)

    const sessions = await schedulingService.getUpcomingSessions(userId, startDate, endDate)

    res.json({
      sessions: sessions,
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      }
    })
  } catch (error) {
    console.error('Error fetching upcoming sessions:', error)
    res.status(500).json({ error: 'Failed to fetch upcoming sessions' })
  }
})

/**
 * PUT /api/scheduling/sessions/:sessionId
 * Reschedule a session
 */
router.put('/sessions/:sessionId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    const { sessionId } = req.params
    const validatedData = UpdateScheduledSessionSchema.parse(req.body)

    if (!validatedData.startTime) {
      return res.status(400).json({ error: 'New start time is required' })
    }

    const updatedSession = await schedulingService.rescheduleSession(
      sessionId,
      new Date(validatedData.startTime),
      validatedData.updateFutureInstances
    )

    res.json({
      message: 'Session rescheduled successfully',
      session: updatedSession
    })
  } catch (error) {
    console.error('Error rescheduling session:', error)
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Validation error', 
        details: error.errors 
      })
    }
    res.status(500).json({ error: 'Failed to reschedule session' })
  }
})

/**
 * DELETE /api/scheduling/sessions/:sessionId
 * Cancel a session
 */
router.delete('/sessions/:sessionId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    const { sessionId } = req.params
    const validatedData = CancelSessionSchema.parse(req.body)

    await schedulingService.cancelSession(sessionId, validatedData.cancelFutureInstances)

    res.json({
      message: validatedData.cancelFutureInstances 
        ? 'Session and all future instances cancelled successfully'
        : 'Session cancelled successfully'
    })
  } catch (error) {
    console.error('Error cancelling session:', error)
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Validation error', 
        details: error.errors 
      })
    }
    res.status(500).json({ error: 'Failed to cancel session' })
  }
})

/**
 * GET /api/scheduling/patterns/:patternId
 * Get recurrence pattern details
 */
router.get('/patterns/:patternId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    const { patternId } = req.params
    const pattern = await schedulingService.getRecurrencePattern(patternId)

    if (!pattern) {
      return res.status(404).json({ error: 'Recurrence pattern not found' })
    }

    res.json({ pattern })
  } catch (error) {
    console.error('Error fetching recurrence pattern:', error)
    res.status(500).json({ error: 'Failed to fetch recurrence pattern' })
  }
})

/**
 * PUT /api/scheduling/patterns/:patternId
 * Update a recurrence pattern
 */
router.put('/patterns/:patternId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    const { patternId } = req.params
    const updateData = req.body

    // Convert date strings to Date objects if present
    if (updateData.endDate) {
      updateData.endDate = new Date(updateData.endDate)
    }

    const updatedPattern = await schedulingService.updateRecurrencePattern(patternId, updateData)

    res.json({
      message: 'Recurrence pattern updated successfully',
      pattern: updatedPattern
    })
  } catch (error) {
    console.error('Error updating recurrence pattern:', error)
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Validation error', 
        details: error.errors 
      })
    }
    res.status(500).json({ error: 'Failed to update recurrence pattern' })
  }
})

/**
 * DELETE /api/scheduling/patterns/:patternId
 * Delete a recurrence pattern
 */
router.delete('/patterns/:patternId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    const { patternId } = req.params
    await schedulingService.deleteRecurrencePattern(patternId)

    res.json({
      message: 'Recurrence pattern deleted successfully'
    })
  } catch (error) {
    console.error('Error deleting recurrence pattern:', error)
    res.status(500).json({ error: 'Failed to delete recurrence pattern' })
  }
})

/**
 * GET /api/scheduling/notifications/:userId
 * Get notifications for a user
 */
router.get('/notifications/:userId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const authenticatedUserId = req.user?.id
    const { userId } = req.params

    // Users can only access their own notifications
    if (authenticatedUserId !== userId) {
      return res.status(403).json({ error: 'Access denied' })
    }

    const notifications = await notificationService.getUserNotifications(userId)

    res.json({ notifications })
  } catch (error) {
    console.error('Error fetching notifications:', error)
    res.status(500).json({ error: 'Failed to fetch notifications' })
  }
})

/**
 * PUT /api/scheduling/notifications/:notificationId/read
 * Mark a notification as read
 */
router.put('/notifications/:notificationId/read', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    const { notificationId } = req.params
    await notificationService.markNotificationAsRead(notificationId)

    res.json({
      message: 'Notification marked as read'
    })
  } catch (error) {
    console.error('Error marking notification as read:', error)
    res.status(500).json({ error: 'Failed to mark notification as read' })
  }
})

export default router