import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import schedulingServiceInstance, { SchedulingService } from '../services/schedulingService'
import { prisma } from '../utils/database'
import { RecurrenceFrequency } from '../models/RecurrencePattern'

// Mock prisma
vi.mock('../utils/database', () => ({
  prisma: {
    recurrencePattern: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn()
    },
    session: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn()
    }
  }
}))

// Mock notification service
vi.mock('../services/notificationService', () => ({
  notificationService: {
    scheduleSessionNotifications: vi.fn(),
    cancelSessionNotifications: vi.fn(),
    rescheduleSessionNotifications: vi.fn(),
    startCleanupJob: vi.fn(),
    stopAllJobs: vi.fn()
  }
}))

describe('SchedulingService', () => {
  let schedulingService: SchedulingService
  
  beforeEach(() => {
    schedulingService = schedulingServiceInstance
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('createRecurrencePattern', () => {
    it('should create a valid weekly recurrence pattern', async () => {
      const mockPattern = {
        id: 'pattern-1',
        frequency: 'weekly',
        interval: 1,
        endDate: null,
        daysOfWeek: [1, 3, 5], // Monday, Wednesday, Friday
        createdAt: new Date()
      }

      vi.mocked(prisma.recurrencePattern.create).mockResolvedValue(mockPattern)

      const result = await schedulingService.createRecurrencePattern({
        frequency: 'weekly' as RecurrenceFrequency,
        interval: 1,
        daysOfWeek: [1, 3, 5]
      })

      expect(prisma.recurrencePattern.create).toHaveBeenCalledWith({
        data: {
          frequency: 'weekly',
          interval: 1,
          endDate: undefined,
          daysOfWeek: [1, 3, 5]
        }
      })
      expect(result).toEqual(mockPattern)
    })

    it('should create a valid daily recurrence pattern', async () => {
      const mockPattern = {
        id: 'pattern-2',
        frequency: 'daily',
        interval: 2,
        endDate: null,
        daysOfWeek: [],
        createdAt: new Date()
      }

      vi.mocked(prisma.recurrencePattern.create).mockResolvedValue(mockPattern)

      const result = await schedulingService.createRecurrencePattern({
        frequency: 'daily' as RecurrenceFrequency,
        interval: 2
      })

      expect(result).toEqual(mockPattern)
    })

    it('should throw validation error for weekly pattern without daysOfWeek', async () => {
      await expect(
        schedulingService.createRecurrencePattern({
          frequency: 'weekly' as RecurrenceFrequency,
          interval: 1
        })
      ).rejects.toThrow()
    })

    it('should throw validation error for daily pattern with daysOfWeek', async () => {
      await expect(
        schedulingService.createRecurrencePattern({
          frequency: 'daily' as RecurrenceFrequency,
          interval: 1,
          daysOfWeek: [1, 2, 3]
        })
      ).rejects.toThrow()
    })
  })

  describe('generateRecurringSessions', () => {
    it('should generate weekly sessions correctly', async () => {
      const mockPattern = {
        id: 'pattern-1',
        frequency: 'weekly',
        interval: 1,
        endDate: null,
        daysOfWeek: [1], // Monday only
        createdAt: new Date()
      }

      const mockSession = {
        id: 'session-1',
        havrutaId: 'havruta-1',
        startTime: new Date('2024-01-01T10:00:00Z'), // Monday
        endTime: null,
        sectionsStudied: [],
        isRecurring: true,
        recurrencePatternId: 'pattern-1',
        createdAt: new Date()
      }

      vi.mocked(prisma.recurrencePattern.findUnique).mockResolvedValue(mockPattern)
      vi.mocked(prisma.session.create).mockResolvedValue(mockSession)

      const baseSession = {
        havrutaId: 'havruta-1',
        startTime: new Date('2024-01-01T10:00:00Z'), // Monday
        recurrencePatternId: 'pattern-1'
      }

      const sessions = await schedulingService.generateRecurringSessions(baseSession, 3)

      expect(prisma.recurrencePattern.findUnique).toHaveBeenCalledWith({
        where: { id: 'pattern-1' }
      })
      expect(sessions).toHaveLength(3)
    })

    it('should generate daily sessions correctly', async () => {
      const mockPattern = {
        id: 'pattern-2',
        frequency: 'daily',
        interval: 1,
        endDate: null,
        daysOfWeek: [],
        createdAt: new Date()
      }

      const mockSession = {
        id: 'session-1',
        havrutaId: 'havruta-1',
        startTime: new Date('2024-01-01T10:00:00Z'),
        endTime: null,
        sectionsStudied: [],
        isRecurring: true,
        recurrencePatternId: 'pattern-2',
        createdAt: new Date()
      }

      vi.mocked(prisma.recurrencePattern.findUnique).mockResolvedValue(mockPattern)
      vi.mocked(prisma.session.create).mockResolvedValue(mockSession)

      const baseSession = {
        havrutaId: 'havruta-1',
        startTime: new Date('2024-01-01T10:00:00Z'),
        recurrencePatternId: 'pattern-2'
      }

      const sessions = await schedulingService.generateRecurringSessions(baseSession, 5)

      expect(sessions).toHaveLength(5)
    })

    it('should respect end date when generating sessions', async () => {
      const endDate = new Date('2024-01-15T00:00:00Z')
      const mockPattern = {
        id: 'pattern-3',
        frequency: 'daily',
        interval: 1,
        endDate: endDate,
        daysOfWeek: [],
        createdAt: new Date()
      }

      vi.mocked(prisma.recurrencePattern.findUnique).mockResolvedValue(mockPattern)
      vi.mocked(prisma.session.create).mockImplementation(async (data) => ({
        id: `session-${Date.now()}`,
        havrutaId: data.data.havrutaId,
        startTime: data.data.startTime,
        endTime: null,
        sectionsStudied: [],
        isRecurring: true,
        recurrencePatternId: data.data.recurrencePatternId,
        createdAt: new Date()
      }))

      const baseSession = {
        havrutaId: 'havruta-1',
        startTime: new Date('2024-01-01T10:00:00Z'),
        recurrencePatternId: 'pattern-3'
      }

      const sessions = await schedulingService.generateRecurringSessions(baseSession, 100)

      // Should only generate sessions until the end date (14 days)
      expect(sessions.length).toBeLessThanOrEqual(14)
      
      // All sessions should be before or on the end date
      sessions.forEach(session => {
        expect(session.startTime.getTime()).toBeLessThanOrEqual(endDate.getTime())
      })
    })

    it('should throw error for non-existent recurrence pattern', async () => {
      vi.mocked(prisma.recurrencePattern.findUnique).mockResolvedValue(null)

      const baseSession = {
        havrutaId: 'havruta-1',
        startTime: new Date('2024-01-01T10:00:00Z'),
        recurrencePatternId: 'non-existent'
      }

      await expect(
        schedulingService.generateRecurringSessions(baseSession, 3)
      ).rejects.toThrow('Recurrence pattern not found')
    })
  })

  describe('getUpcomingSessions', () => {
    it('should fetch upcoming sessions for a user', async () => {
      const mockSessions = [
        {
          id: 'session-1',
          havrutaId: 'havruta-1',
          startTime: new Date('2024-01-15T10:00:00Z'),
          endTime: null,
          sectionsStudied: [],
          isRecurring: false,
          recurrencePatternId: null,
          createdAt: new Date(),
          havruta: { id: 'havruta-1', name: 'Test Havruta' },
          participants: [],
          recurrencePattern: null
        }
      ]

      vi.mocked(prisma.session.findMany).mockResolvedValue(mockSessions)

      const startDate = new Date('2024-01-01T00:00:00Z')
      const sessions = await schedulingService.getUpcomingSessions('user-1', startDate)

      expect(prisma.session.findMany).toHaveBeenCalledWith({
        where: {
          startTime: {
            gte: startDate
          },
          participants: {
            some: {
              userId: 'user-1'
            }
          }
        },
        include: {
          havruta: true,
          participants: {
            include: {
              user: true
            }
          },
          recurrencePattern: true
        },
        orderBy: {
          startTime: 'asc'
        }
      })
      expect(sessions).toEqual(mockSessions)
    })
  })

  describe('cancelSession', () => {
    it('should cancel a single session', async () => {
      const mockSession = {
        id: 'session-1',
        havrutaId: 'havruta-1',
        startTime: new Date('2024-01-15T10:00:00Z'),
        endTime: null,
        sectionsStudied: [],
        isRecurring: false,
        recurrencePatternId: null,
        createdAt: new Date(),
        recurrencePattern: null
      }

      vi.mocked(prisma.session.findUnique).mockResolvedValue(mockSession)
      vi.mocked(prisma.session.delete).mockResolvedValue(mockSession)

      await schedulingService.cancelSession('session-1', false)

      expect(prisma.session.delete).toHaveBeenCalledWith({
        where: { id: 'session-1' }
      })
      expect(prisma.session.deleteMany).not.toHaveBeenCalled()
    })

    it('should cancel all future instances when requested', async () => {
      const mockSession = {
        id: 'session-1',
        havrutaId: 'havruta-1',
        startTime: new Date('2024-01-15T10:00:00Z'),
        endTime: null,
        sectionsStudied: [],
        isRecurring: true,
        recurrencePatternId: 'pattern-1',
        createdAt: new Date(),
        recurrencePattern: { id: 'pattern-1' }
      }

      vi.mocked(prisma.session.findUnique).mockResolvedValue(mockSession)
      vi.mocked(prisma.session.findMany).mockResolvedValue([mockSession])
      vi.mocked(prisma.session.deleteMany).mockResolvedValue({ count: 5 })

      await schedulingService.cancelSession('session-1', true)

      expect(prisma.session.deleteMany).toHaveBeenCalledWith({
        where: {
          recurrencePatternId: 'pattern-1',
          startTime: {
            gte: mockSession.startTime
          }
        }
      })
    })

    it('should throw error for non-existent session', async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue(null)

      await expect(
        schedulingService.cancelSession('non-existent')
      ).rejects.toThrow('Session not found')
    })
  })

  describe('rescheduleSession', () => {
    it('should reschedule a single session', async () => {
      const originalTime = new Date('2024-01-15T10:00:00Z')
      const newTime = new Date('2024-01-15T14:00:00Z')
      
      const mockSession = {
        id: 'session-1',
        havrutaId: 'havruta-1',
        startTime: originalTime,
        endTime: null,
        sectionsStudied: [],
        isRecurring: false,
        recurrencePatternId: null,
        createdAt: new Date(),
        recurrencePattern: null
      }

      const updatedSession = { ...mockSession, startTime: newTime }

      vi.mocked(prisma.session.findUnique).mockResolvedValue(mockSession)
      vi.mocked(prisma.session.update).mockResolvedValue(updatedSession)

      const result = await schedulingService.rescheduleSession('session-1', newTime, false)

      expect(prisma.session.update).toHaveBeenCalledWith({
        where: { id: 'session-1' },
        data: { startTime: newTime }
      })
      expect(result.startTime).toEqual(newTime)
    })

    it('should throw error for non-existent session', async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue(null)

      await expect(
        schedulingService.rescheduleSession('non-existent', new Date())
      ).rejects.toThrow('Session not found')
    })
  })
})