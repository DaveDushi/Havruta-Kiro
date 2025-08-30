import { RecurrencePattern, Session } from '@prisma/client'
import { prisma } from '../utils/database'
import { z } from 'zod'
import { 
  RecurrenceFrequency, 
  CreateRecurrencePatternData, 
  UpdateRecurrencePatternData 
} from '../models/RecurrencePattern'
import { CreateSessionData } from '../models/Session'
import { notificationService } from './notificationService'

// Validation schemas
export const RecurrencePatternSchema = z.object({
  frequency: z.enum(['once', 'daily', 'weekly', 'bi-weekly', 'monthly']),
  interval: z.number().min(1).max(365).default(1),
  endDate: z.date().optional(),
  daysOfWeek: z.array(z.number().min(0).max(6)).optional().default([])
}).refine((data) => {
  // For weekly and bi-weekly patterns, daysOfWeek should not be empty
  if ((data.frequency === 'weekly' || data.frequency === 'bi-weekly') && data.daysOfWeek.length === 0) {
    return false
  }
  // For non-weekly patterns, daysOfWeek should be empty
  if (data.frequency !== 'weekly' && data.frequency !== 'bi-weekly' && data.daysOfWeek.length > 0) {
    return false
  }
  return true
}, {
  message: "daysOfWeek must be specified for weekly/bi-weekly patterns and empty for others"
})

export const ScheduledSessionSchema = z.object({
  havrutaId: z.string().cuid(),
  startTime: z.date(),
  participantIds: z.array(z.string().cuid()).optional().default([]),
  isRecurring: z.boolean().default(false),
  recurrencePattern: RecurrencePatternSchema.optional()
})

export class SchedulingService {
  /**
   * Create a new recurrence pattern with validation
   */
  async createRecurrencePattern(data: CreateRecurrencePatternData): Promise<RecurrencePattern> {
    const validatedData = RecurrencePatternSchema.parse(data)
    
    return await prisma.recurrencePattern.create({
      data: {
        frequency: validatedData.frequency,
        interval: validatedData.interval,
        endDate: validatedData.endDate,
        daysOfWeek: validatedData.daysOfWeek
      }
    })
  }

  /**
   * Update an existing recurrence pattern
   */
  async updateRecurrencePattern(
    id: string, 
    data: UpdateRecurrencePatternData
  ): Promise<RecurrencePattern> {
    const validatedData = RecurrencePatternSchema.partial().parse(data)
    
    return await prisma.recurrencePattern.update({
      where: { id },
      data: validatedData
    })
  }

  /**
   * Generate future session instances based on recurrence pattern
   */
  async generateRecurringSessions(
    baseSession: CreateSessionData & { recurrencePatternId: string; participantIds?: string[] },
    maxInstances: number = 52 // Default to 1 year of weekly sessions
  ): Promise<Session[]> {
    const pattern = await prisma.recurrencePattern.findUnique({
      where: { id: baseSession.recurrencePatternId }
    })

    if (!pattern) {
      throw new Error('Recurrence pattern not found')
    }

    const sessions: Session[] = []
    const startDate = new Date(baseSession.startTime)
    let currentDate = new Date(startDate)
    let instanceCount = 0

    while (instanceCount < maxInstances) {
      // Check if we've reached the end date
      if (pattern.endDate && currentDate > pattern.endDate) {
        break
      }

      // Generate session for current date
      if (this.shouldGenerateSessionForDate(currentDate, pattern, startDate)) {
        const session = await prisma.session.create({
          data: {
            havrutaId: baseSession.havrutaId,
            startTime: new Date(currentDate),
            isRecurring: true,
            recurrencePatternId: pattern.id
          }
        })
        
        // Add participants to session
        let participantIds = baseSession.participantIds || []
        
        // If no specific participants provided, use all Havruta participants
        if (participantIds.length === 0) {
          const havrutaParticipants = await prisma.havrutaParticipant.findMany({
            where: { havrutaId: baseSession.havrutaId }
          })
          participantIds = havrutaParticipants.map(p => p.userId)
        }
        
        // Add participants to the session
        for (const userId of participantIds) {
          await prisma.sessionParticipant.create({
            data: {
              userId,
              sessionId: session.id
            }
          })
        }
        
        // Schedule notifications for this session
        try {
          if (notificationService && typeof notificationService.scheduleSessionNotifications === 'function') {
            await notificationService.scheduleSessionNotifications(session.id)
          }
        } catch (error) {
          console.error(`Failed to schedule notifications for session ${session.id}:`, error)
        }
        
        sessions.push(session)
        instanceCount++
      }

      // Move to next potential date
      currentDate = this.getNextDate(currentDate, pattern)
    }

    return sessions
  }

  /**
   * Calculate the next occurrence date based on recurrence pattern
   */
  private getNextDate(currentDate: Date, pattern: RecurrencePattern): Date {
    const nextDate = new Date(currentDate)

    switch (pattern.frequency) {
      case 'daily':
        nextDate.setDate(nextDate.getDate() + pattern.interval)
        break
      
      case 'weekly':
        nextDate.setDate(nextDate.getDate() + (7 * pattern.interval))
        break
      
      case 'bi-weekly':
        nextDate.setDate(nextDate.getDate() + (14 * pattern.interval))
        break
      
      case 'monthly':
        nextDate.setMonth(nextDate.getMonth() + pattern.interval)
        break
      
      default:
        // For 'once', just add a day to exit the loop
        nextDate.setDate(nextDate.getDate() + 1)
    }

    return nextDate
  }

  /**
   * Check if a session should be generated for a specific date
   */
  private shouldGenerateSessionForDate(
    date: Date, 
    pattern: RecurrencePattern, 
    startDate: Date
  ): boolean {
    // For 'once' frequency, only generate on the start date
    if (pattern.frequency === 'once') {
      return date.getTime() === startDate.getTime()
    }

    // For weekly and bi-weekly patterns, check if the day of week matches
    if (pattern.frequency === 'weekly' || pattern.frequency === 'bi-weekly') {
      const dayOfWeek = date.getDay()
      return pattern.daysOfWeek.includes(dayOfWeek)
    }

    // For daily and monthly patterns, generate for every occurrence
    return true
  }

  /**
   * Get upcoming sessions for a user within a date range
   */
  async getUpcomingSessions(
    userId: string, 
    startDate: Date = new Date(), 
    endDate?: Date
  ): Promise<Session[]> {
    console.log('🔍 Getting upcoming sessions for user:', userId, 'from:', startDate, 'to:', endDate)
    
    const whereClause: any = {
      startTime: {
        gte: startDate
      },
      participants: {
        some: {
          userId: userId
        }
      }
    }

    if (endDate) {
      whereClause.startTime.lte = endDate
    }

    const sessions = await prisma.session.findMany({
      where: whereClause,
      include: {
        havruta: {
          include: {
            participants: {
              include: {
                user: true
              }
            }
          }
        },
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

    console.log('📊 Found sessions:', sessions.length)
    sessions.forEach(session => {
      console.log('  - Session:', session.id, 'Havruta:', session.havruta.name, 'Start:', session.startTime)
    })

    return sessions
  }

  /**
   * Cancel a specific session instance or all future instances
   */
  async cancelSession(sessionId: string, cancelFutureInstances: boolean = false): Promise<void> {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { recurrencePattern: true }
    })

    if (!session) {
      throw new Error('Session not found')
    }

    if (cancelFutureInstances && session.recurrencePatternId) {
      // Get all future sessions to cancel their notifications
      const futureSessions = await prisma.session.findMany({
        where: {
          recurrencePatternId: session.recurrencePatternId,
          startTime: {
            gte: session.startTime
          }
        }
      })

      // Cancel notifications for all future sessions
      for (const futureSession of futureSessions) {
        try {
          await notificationService.cancelSessionNotifications(futureSession.id)
        } catch (error) {
          console.error(`Failed to cancel notifications for session ${futureSession.id}:`, error)
        }
      }

      // Cancel all future sessions with the same recurrence pattern
      await prisma.session.deleteMany({
        where: {
          recurrencePatternId: session.recurrencePatternId,
          startTime: {
            gte: session.startTime
          }
        }
      })
    } else {
      // Cancel notifications for this specific session
      try {
        await notificationService.cancelSessionNotifications(sessionId)
      } catch (error) {
        console.error(`Failed to cancel notifications for session ${sessionId}:`, error)
      }

      // Cancel only this specific session
      await prisma.session.delete({
        where: { id: sessionId }
      })
    }
  }

  /**
   * Reschedule a session and optionally update future instances
   */
  async rescheduleSession(
    sessionId: string, 
    newStartTime: Date, 
    updateFutureInstances: boolean = false
  ): Promise<Session> {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { recurrencePattern: true }
    })

    if (!session) {
      throw new Error('Session not found')
    }

    if (updateFutureInstances && session.recurrencePatternId) {
      // Calculate time difference
      const timeDiff = newStartTime.getTime() - session.startTime.getTime()
      
      // Update all future sessions
      const futureSessions = await prisma.session.findMany({
        where: {
          recurrencePatternId: session.recurrencePatternId,
          startTime: {
            gte: session.startTime
          }
        }
      })

      for (const futureSession of futureSessions) {
        const newTime = new Date(futureSession.startTime.getTime() + timeDiff)
        await prisma.session.update({
          where: { id: futureSession.id },
          data: { startTime: newTime }
        })

        // Reschedule notifications for this session
        try {
          await notificationService.rescheduleSessionNotifications(futureSession.id)
        } catch (error) {
          console.error(`Failed to reschedule notifications for session ${futureSession.id}:`, error)
        }
      }
    }

    // Update the specific session
    const updatedSession = await prisma.session.update({
      where: { id: sessionId },
      data: { startTime: newStartTime }
    })

    // Reschedule notifications for this session if not updating future instances
    if (!updateFutureInstances) {
      try {
        await notificationService.rescheduleSessionNotifications(sessionId)
      } catch (error) {
        console.error(`Failed to reschedule notifications for session ${sessionId}:`, error)
      }
    }

    return updatedSession
  }

  /**
   * Get recurrence pattern by ID
   */
  async getRecurrencePattern(id: string): Promise<RecurrencePattern | null> {
    return await prisma.recurrencePattern.findUnique({
      where: { id }
    })
  }

  /**
   * Delete a recurrence pattern and handle associated sessions
   */
  async deleteRecurrencePattern(id: string): Promise<void> {
    // Get all sessions with this recurrence pattern to cancel their notifications
    const sessions = await prisma.session.findMany({
      where: { recurrencePatternId: id }
    })

    // Cancel notifications for all sessions
    for (const session of sessions) {
      try {
        await notificationService.cancelSessionNotifications(session.id)
      } catch (error) {
        console.error(`Failed to cancel notifications for session ${session.id}:`, error)
      }
    }

    // First, update all sessions to remove the recurrence pattern reference
    await prisma.session.updateMany({
      where: { recurrencePatternId: id },
      data: { 
        recurrencePatternId: null,
        isRecurring: false
      }
    })

    // Then delete the recurrence pattern
    await prisma.recurrencePattern.delete({
      where: { id }
    })
  }

  /**
   * Initialize the background job system
   */
  initializeBackgroundJobs(): void {
    // Start the notification service cleanup job
    notificationService.startCleanupJob()
    
    console.log('Background job system initialized')
  }

  /**
   * Shutdown the background job system
   */
  shutdownBackgroundJobs(): void {
    notificationService.stopAllJobs()
    console.log('Background job system shutdown')
  }
}

export const schedulingService = new SchedulingService()
export default schedulingService