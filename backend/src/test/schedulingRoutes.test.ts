import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import request from 'supertest'
import express from 'express'
import schedulingRoutes from '../routes/scheduling'
import { schedulingService } from '../services/schedulingService'
import { notificationService } from '../services/notificationService'

// Mock services
vi.mock('../services/schedulingService')
vi.mock('../services/notificationService')
vi.mock('../middleware/auth', () => ({
  authenticateToken: (req: any, res: any, next: any) => {
    req.user = { id: 'user-123' }
    next()
  }
}))

const app = express()
app.use(express.json())
app.use('/api/scheduling', schedulingRoutes)

describe('Scheduling Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('POST /api/scheduling/sessions', () => {
    it('should create a single scheduled session', async () => {
      const mockSession = {
        id: 'session-1',
        havrutaId: 'havruta-1',
        startTime: '2024-02-01T10:00:00.000Z',
        isRecurring: false,
        recurrencePatternId: null
      }

      const mockOncePattern = {
        id: 'pattern-once',
        frequency: 'once',
        interval: 1,
        daysOfWeek: [],
        endDate: null,
        createdAt: new Date()
      }

      vi.mocked(schedulingService.createRecurrencePattern).mockResolvedValue(mockOncePattern)
      vi.mocked(schedulingService.generateRecurringSessions).mockResolvedValue([mockSession])

      const response = await request(app)
        .post('/api/scheduling/sessions')
        .send({
          havrutaId: 'clp1234567890123456789012',
          startTime: '2024-02-01T10:00:00Z',
          participantIds: ['clp1234567890123456789013', 'clp1234567890123456789014'],
          isRecurring: false
        })

      expect(response.status).toBe(201)
      expect(response.body.message).toBe('Session scheduled successfully')
      expect(response.body.session).toEqual(mockSession)
    })

    it('should create recurring sessions', async () => {
      const mockPattern = {
        id: 'pattern-1',
        frequency: 'weekly',
        interval: 1,
        daysOfWeek: [1, 3, 5],
        endDate: null,
        createdAt: new Date()
      }

      const mockSessions = [
        {
          id: 'session-1',
          havrutaId: 'havruta-1',
          startTime: '2024-02-01T10:00:00.000Z',
          isRecurring: true,
          recurrencePatternId: 'pattern-1'
        },
        {
          id: 'session-2',
          havrutaId: 'havruta-1',
          startTime: '2024-02-08T10:00:00.000Z',
          isRecurring: true,
          recurrencePatternId: 'pattern-1'
        }
      ]

      vi.mocked(schedulingService.createRecurrencePattern).mockResolvedValue(mockPattern)
      vi.mocked(schedulingService.generateRecurringSessions).mockResolvedValue(mockSessions)

      const response = await request(app)
        .post('/api/scheduling/sessions')
        .send({
          havrutaId: 'clp1234567890123456789012',
          startTime: '2024-02-01T10:00:00Z',
          participantIds: ['clp1234567890123456789013', 'clp1234567890123456789014'],
          isRecurring: true,
          recurrencePattern: {
            frequency: 'weekly',
            interval: 1,
            daysOfWeek: [1, 3, 5]
          }
        })

      expect(response.status).toBe(201)
      expect(response.body.message).toBe('Recurring sessions created successfully')
      expect(response.body.sessions).toEqual(mockSessions)
      expect(response.body.recurrencePatternId).toBe('pattern-1')
    })

    it('should return validation error for invalid data', async () => {
      const response = await request(app)
        .post('/api/scheduling/sessions')
        .send({
          havrutaId: 'invalid-id',
          startTime: 'invalid-date',
          participantIds: []
        })

      expect(response.status).toBe(400)
      expect(response.body.error).toBe('Validation error')
    })
  })

  describe('GET /api/scheduling/sessions/upcoming', () => {
    it('should fetch upcoming sessions for user', async () => {
      const mockSessions = [
        {
          id: 'session-1',
          havrutaId: 'havruta-1',
          startTime: '2024-02-01T10:00:00.000Z',
          havruta: { name: 'Test Havruta' },
          participants: []
        }
      ]

      vi.mocked(schedulingService.getUpcomingSessions).mockResolvedValue(mockSessions)

      const response = await request(app)
        .get('/api/scheduling/sessions/upcoming')
        .query({ days: '7' })

      expect(response.status).toBe(200)
      expect(response.body.sessions).toEqual(mockSessions)
      expect(response.body.dateRange).toBeDefined()
    })
  })

  describe('PUT /api/scheduling/sessions/:sessionId', () => {
    it('should reschedule a session', async () => {
      const mockUpdatedSession = {
        id: 'session-1',
        havrutaId: 'havruta-1',
        startTime: '2024-02-01T14:00:00.000Z',
        isRecurring: false
      }

      vi.mocked(schedulingService.rescheduleSession).mockResolvedValue(mockUpdatedSession)

      const response = await request(app)
        .put('/api/scheduling/sessions/session-1')
        .send({
          startTime: '2024-02-01T14:00:00Z',
          updateFutureInstances: false
        })

      expect(response.status).toBe(200)
      expect(response.body.message).toBe('Session rescheduled successfully')
      expect(response.body.session).toEqual(mockUpdatedSession)
    })

    it('should return error when start time is missing', async () => {
      const response = await request(app)
        .put('/api/scheduling/sessions/session-1')
        .send({
          updateFutureInstances: false
        })

      expect(response.status).toBe(400)
      expect(response.body.error).toBe('New start time is required')
    })
  })

  describe('DELETE /api/scheduling/sessions/:sessionId', () => {
    it('should cancel a single session', async () => {
      vi.mocked(schedulingService.cancelSession).mockResolvedValue()

      const response = await request(app)
        .delete('/api/scheduling/sessions/session-1')
        .send({
          cancelFutureInstances: false
        })

      expect(response.status).toBe(200)
      expect(response.body.message).toBe('Session cancelled successfully')
      expect(schedulingService.cancelSession).toHaveBeenCalledWith('session-1', false)
    })

    it('should cancel session and future instances', async () => {
      vi.mocked(schedulingService.cancelSession).mockResolvedValue()

      const response = await request(app)
        .delete('/api/scheduling/sessions/session-1')
        .send({
          cancelFutureInstances: true
        })

      expect(response.status).toBe(200)
      expect(response.body.message).toBe('Session and all future instances cancelled successfully')
      expect(schedulingService.cancelSession).toHaveBeenCalledWith('session-1', true)
    })
  })

  describe('GET /api/scheduling/patterns/:patternId', () => {
    it('should fetch recurrence pattern', async () => {
      const mockPattern = {
        id: 'pattern-1',
        frequency: 'weekly',
        interval: 1,
        daysOfWeek: [1, 3, 5],
        endDate: null,
        createdAt: '2025-08-14T09:03:00.543Z'
      }

      vi.mocked(schedulingService.getRecurrencePattern).mockResolvedValue(mockPattern)

      const response = await request(app)
        .get('/api/scheduling/patterns/pattern-1')

      expect(response.status).toBe(200)
      expect(response.body.pattern).toEqual(mockPattern)
    })

    it('should return 404 for non-existent pattern', async () => {
      vi.mocked(schedulingService.getRecurrencePattern).mockResolvedValue(null)

      const response = await request(app)
        .get('/api/scheduling/patterns/non-existent')

      expect(response.status).toBe(404)
      expect(response.body.error).toBe('Recurrence pattern not found')
    })
  })

  describe('PUT /api/scheduling/patterns/:patternId', () => {
    it('should update recurrence pattern', async () => {
      const mockUpdatedPattern = {
        id: 'pattern-1',
        frequency: 'bi-weekly',
        interval: 1,
        daysOfWeek: [1, 3],
        endDate: null,
        createdAt: '2025-08-14T09:03:00.550Z'
      }

      vi.mocked(schedulingService.updateRecurrencePattern).mockResolvedValue(mockUpdatedPattern)

      const response = await request(app)
        .put('/api/scheduling/patterns/pattern-1')
        .send({
          frequency: 'bi-weekly',
          daysOfWeek: [1, 3]
        })

      expect(response.status).toBe(200)
      expect(response.body.message).toBe('Recurrence pattern updated successfully')
      expect(response.body.pattern).toEqual(mockUpdatedPattern)
    })
  })

  describe('DELETE /api/scheduling/patterns/:patternId', () => {
    it('should delete recurrence pattern', async () => {
      vi.mocked(schedulingService.deleteRecurrencePattern).mockResolvedValue()

      const response = await request(app)
        .delete('/api/scheduling/patterns/pattern-1')

      expect(response.status).toBe(200)
      expect(response.body.message).toBe('Recurrence pattern deleted successfully')
      expect(schedulingService.deleteRecurrencePattern).toHaveBeenCalledWith('pattern-1')
    })
  })

  describe('GET /api/scheduling/notifications/:userId', () => {
    it('should fetch user notifications', async () => {
      const mockNotifications = [
        {
          id: 'notif-1',
          type: 'session_reminder',
          message: 'Your session starts in 15 minutes',
          sessionId: 'session-1',
          userId: 'user-123'
        }
      ]

      vi.mocked(notificationService.getUserNotifications).mockResolvedValue(mockNotifications)

      const response = await request(app)
        .get('/api/scheduling/notifications/user-123')

      expect(response.status).toBe(200)
      expect(response.body.notifications).toEqual(mockNotifications)
    })

    it('should deny access to other users notifications', async () => {
      const response = await request(app)
        .get('/api/scheduling/notifications/other-user')

      expect(response.status).toBe(403)
      expect(response.body.error).toBe('Access denied')
    })
  })

  describe('PUT /api/scheduling/notifications/:notificationId/read', () => {
    it('should mark notification as read', async () => {
      vi.mocked(notificationService.markNotificationAsRead).mockResolvedValue()

      const response = await request(app)
        .put('/api/scheduling/notifications/notif-1/read')

      expect(response.status).toBe(200)
      expect(response.body.message).toBe('Notification marked as read')
      expect(notificationService.markNotificationAsRead).toHaveBeenCalledWith('notif-1')
    })
  })
})