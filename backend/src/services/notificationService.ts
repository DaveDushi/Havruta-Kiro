import { Session, User } from '@prisma/client'
import { prisma } from '../utils/database'
import cron from 'node-cron'

export interface NotificationData {
  type: 'session_reminder' | 'session_starting' | 'session_cancelled'
  sessionId: string
  userId: string
  message: string
  scheduledFor: Date
}

export interface SessionNotification {
  id: string
  sessionId: string
  userId: string
  type: string
  message: string
  scheduledFor: Date
  sent: boolean
  createdAt: Date
}

export class NotificationService {
  private scheduledJobs: Map<string, cron.ScheduledTask> = new Map()

  /**
   * Schedule notifications for a session
   */
  async scheduleSessionNotifications(sessionId: string): Promise<void> {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        participants: {
          include: {
            user: true
          }
        },
        havruta: true
      }
    })

    if (!session) {
      throw new Error('Session not found')
    }

    // Schedule reminder notifications (15 minutes before)
    const reminderTime = new Date(session.startTime.getTime() - 15 * 60 * 1000)
    if (reminderTime > new Date()) {
      await this.scheduleNotification({
        type: 'session_reminder',
        sessionId: session.id,
        userId: '', // Will be set for each participant
        message: `Your Havruta session "${session.havruta.name}" starts in 15 minutes`,
        scheduledFor: reminderTime
      }, session.participants.map(p => p.user))
    }

    // Schedule starting notifications (at session time)
    if (session.startTime > new Date()) {
      await this.scheduleNotification({
        type: 'session_starting',
        sessionId: session.id,
        userId: '', // Will be set for each participant
        message: `Your Havruta session "${session.havruta.name}" is starting now!`,
        scheduledFor: session.startTime
      }, session.participants.map(p => p.user))
    }
  }

  /**
   * Schedule a notification for multiple users
   */
  private async scheduleNotification(
    notificationData: NotificationData, 
    users: User[]
  ): Promise<void> {
    for (const user of users) {
      const notification = {
        ...notificationData,
        userId: user.id
      }

      // Store notification in database (you might want to create a notifications table)
      // For now, we'll use a simple in-memory approach with cron jobs

      const jobId = `${notification.sessionId}-${notification.userId}-${notification.type}`
      
      // Create cron job for the scheduled time
      const cronExpression = this.dateToCronExpression(notification.scheduledFor)
      
      if (cronExpression) {
        const task = cron.schedule(cronExpression, async () => {
          await this.sendNotification(notification)
          this.scheduledJobs.delete(jobId)
        }, {
          scheduled: false,
          timezone: 'UTC'
        })

        this.scheduledJobs.set(jobId, task)
        task.start()
      }
    }
  }

  /**
   * Send a notification (implement your preferred notification method)
   */
  private async sendNotification(notification: NotificationData): Promise<void> {
    // This is where you would integrate with your notification system
    // For example: email, push notifications, SMS, etc.
    
    console.log(`Sending notification to user ${notification.userId}:`, {
      type: notification.type,
      message: notification.message,
      sessionId: notification.sessionId
    })

    // You could also emit a WebSocket event for real-time notifications
    // socketService.emitToUser(notification.userId, 'notification', notification)
    
    // Or send an email
    // await emailService.sendNotification(notification)
  }

  /**
   * Cancel all notifications for a session
   */
  async cancelSessionNotifications(sessionId: string): Promise<void> {
    const jobsToCancel = Array.from(this.scheduledJobs.keys())
      .filter(jobId => jobId.startsWith(sessionId))

    for (const jobId of jobsToCancel) {
      const task = this.scheduledJobs.get(jobId)
      if (task) {
        task.stop()
        task.destroy()
        this.scheduledJobs.delete(jobId)
      }
    }
  }

  /**
   * Reschedule notifications for a session
   */
  async rescheduleSessionNotifications(sessionId: string): Promise<void> {
    // Cancel existing notifications
    await this.cancelSessionNotifications(sessionId)
    
    // Schedule new notifications
    await this.scheduleSessionNotifications(sessionId)
  }

  /**
   * Convert a Date to a cron expression
   */
  private dateToCronExpression(date: Date): string | null {
    // Only schedule if the date is in the future
    if (date <= new Date()) {
      return null
    }

    const minute = date.getUTCMinutes()
    const hour = date.getUTCHours()
    const day = date.getUTCDate()
    const month = date.getUTCMonth() + 1
    const year = date.getUTCFullYear()

    // Create a one-time cron expression
    return `${minute} ${hour} ${day} ${month} *`
  }

  /**
   * Get all scheduled notifications for a user
   */
  async getUserNotifications(userId: string): Promise<NotificationData[]> {
    // In a real implementation, you would query a notifications table
    // For now, return empty array as we're using in-memory scheduling
    return []
  }

  /**
   * Mark a notification as read/handled
   */
  async markNotificationAsRead(notificationId: string): Promise<void> {
    // Implementation would update the notification status in database
    console.log(`Marking notification ${notificationId} as read`)
  }

  /**
   * Clean up expired jobs (call this periodically)
   */
  cleanupExpiredJobs(): void {
    const now = new Date()
    const jobsToCleanup: string[] = []

    // In a real implementation, you would check against stored notification data
    // For now, we'll just clean up jobs that have been running for more than 24 hours
    this.scheduledJobs.forEach((task, jobId) => {
      // This is a simplified cleanup - in practice you'd store job creation time
      if (!task.running) {
        jobsToCleanup.push(jobId)
      }
    })

    jobsToCleanup.forEach(jobId => {
      const task = this.scheduledJobs.get(jobId)
      if (task) {
        task.destroy()
        this.scheduledJobs.delete(jobId)
      }
    })
  }

  /**
   * Start the cleanup job (run every hour)
   */
  startCleanupJob(): void {
    cron.schedule('0 * * * *', () => {
      this.cleanupExpiredJobs()
    })
  }

  /**
   * Stop all scheduled jobs (useful for testing or shutdown)
   */
  stopAllJobs(): void {
    this.scheduledJobs.forEach(task => {
      task.stop()
      task.destroy()
    })
    this.scheduledJobs.clear()
  }
}

export const notificationService = new NotificationService()
export default notificationService