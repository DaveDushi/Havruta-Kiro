import { Session, SessionParticipant } from '@prisma/client'
import { prisma } from '../utils/database'
import { z } from 'zod'

// Validation schemas
export const createSessionSchema = z.object({
  havrutaId: z.string().min(1, 'Havruta ID is required'),
  type: z.enum(['scheduled', 'instant']).optional().default('scheduled'),
  startTime: z.date().optional().default(() => new Date()),
  participantIds: z.array(z.string()).optional().default([])
})

export const joinSessionSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  sessionId: z.string().min(1, 'Session ID is required')
})

export const updateProgressSchema = z.object({
  sectionsStudied: z.array(z.string()).optional(),
  currentSection: z.string().optional(),
  timeStudied: z.number().int().min(0).optional()
})

export const endSessionSchema = z.object({
  endingSection: z.string().min(1, 'Ending section is required'),
  coverageRange: z.string().optional()
})

export type CreateSessionData = z.infer<typeof createSessionSchema>
export type JoinSessionData = z.infer<typeof joinSessionSchema>
export type UpdateProgressData = z.infer<typeof updateProgressSchema>
export type EndSessionData = z.infer<typeof endSessionSchema>

export interface SessionWithRelations extends Session {
  havruta: {
    id: string
    name: string
    bookId: string
    bookTitle: string
    lastPlace: string
    isActive: boolean
    owner: {
      id: string
      name: string
      email: string
    }
  }
  participants: Array<{
    id: string
    joinedAt: Date
    leftAt: Date | null
    user: {
      id: string
      name: string
      email: string
      profilePicture?: string | null
    }
  }>
  _count?: {
    participants: number
  }
}

export interface SessionState {
  id: string
  havrutaId: string
  type: string
  status: string
  isActive: boolean
  startTime: Date
  endTime: Date | null
  startingSection: string
  endingSection: string | null
  coverageRange: string | null
  sectionsStudied: string[]
  activeParticipants: Array<{
    userId: string
    name: string
    joinedAt: Date
  }>
  totalParticipants: number
}

export class SessionService {
  private notificationService?: any // Will be set after NotificationService is created

  /**
   * Set the notification service (called after NotificationService is instantiated)
   */
  setNotificationService(notificationService: any): void {
    this.notificationService = notificationService
  }

  /**
   * Initialize a new session for a Havruta
   */
  async initializeSession(data: CreateSessionData): Promise<SessionWithRelations> {
    try {
      // Validate input data
      const validatedData = createSessionSchema.parse(data)
      const { havrutaId, type, startTime, participantIds } = validatedData

      // Verify Havruta exists and is active
      const havruta = await prisma.havruta.findUnique({
        where: { id: havrutaId },
        include: {
          owner: true,
          participants: {
            include: { user: true }
          }
        }
      })

      if (!havruta) {
        throw new Error('Havruta not found')
      }
      if (!havruta.isActive) {
        throw new Error('Cannot create session for inactive Havruta')
      }

      // Check if there's already an active session for this Havruta
      const existingActiveSession = await prisma.session.findFirst({
        where: {
          havrutaId,
          status: { in: ['active', 'scheduled'] }
        }
      })

      if (existingActiveSession) {
        throw new Error('There is already an active session for this Havruta')
      }

      // Create session with participants in a transaction
      const session = await prisma.$transaction(async (tx) => {
        // Create the session - it loads Havruta's lastPlace as starting section
        const newSession = await tx.session.create({
          data: {
            havrutaId,
            type,
            status: type === 'instant' ? 'active' : 'scheduled',
            startTime,
            startingSection: havruta.lastPlace || `${havruta.bookTitle} 1:1`,
            sectionsStudied: []
          }
        })

        // Determine participants to add
        const participantsToAdd = participantIds.length > 0 
          ? participantIds 
          : havruta.participants.map(p => p.userId)

        // Add participants to session
        if (participantsToAdd.length > 0) {
          await tx.sessionParticipant.createMany({
            data: participantsToAdd.map(userId => ({
              userId,
              sessionId: newSession.id
            }))
          })
        }

        return newSession
      })

      // Update Havruta's total sessions count
      await prisma.havruta.update({
        where: { id: havrutaId },
        data: {
          totalSessions: { increment: 1 },
          lastStudiedAt: startTime
        }
      })

      // Return session with relations
      return await this.getSessionById(session.id) as SessionWithRelations
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Validation error: ${error.errors.map(e => e.message).join(', ')}`)
      }
      console.error('Error initializing session:', error)
      throw error instanceof Error ? error : new Error('Failed to initialize session')
    }
  }

  /**
   * Get session by ID with relations
   */
  async getSessionById(sessionId: string): Promise<SessionWithRelations | null> {
    try {
      const session = await prisma.session.findUnique({
        where: { id: sessionId },
        include: {
          havruta: {
            include: {
              owner: {
                select: {
                  id: true,
                  name: true,
                  email: true
                }
              }
            }
          },
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  profilePicture: true
                }
              }
            },
            orderBy: { joinedAt: 'asc' }
          },
          _count: {
            select: {
              participants: true
            }
          }
        }
      })
      return session
    } catch (error) {
      console.error('Error fetching session by ID:', error)
      throw new Error('Failed to fetch session')
    }
  }

  /**
   * Join an active session
   */
  async joinSession(data: JoinSessionData): Promise<SessionParticipant> {
    try {
      // Validate input data
      const validatedData = joinSessionSchema.parse(data)
      const { userId, sessionId } = validatedData

      // Verify user exists
      const user = await prisma.user.findUnique({
        where: { id: userId }
      })
      if (!user) {
        throw new Error('User not found')
      }

      // Verify session exists and is active
      const session = await prisma.session.findUnique({
        where: { id: sessionId },
        include: {
          havruta: true
        }
      })
      if (!session) {
        throw new Error('Session not found')
      }
      if (session.status === 'completed' || session.status === 'cancelled') {
        throw new Error('Cannot join ended session')
      }

      // Check if user is a participant in the Havruta
      const havrutaParticipant = await prisma.havrutaParticipant.findUnique({
        where: {
          userId_havrutaId: {
            userId,
            havrutaId: session.havrutaId
          }
        }
      })
      if (!havrutaParticipant) {
        throw new Error('User is not a participant in this Havruta')
      }

      // Check if user is already in the session
      const existingSessionParticipant = await prisma.sessionParticipant.findUnique({
        where: {
          userId_sessionId: {
            userId,
            sessionId
          }
        }
      })

      if (existingSessionParticipant) {
        if (!existingSessionParticipant.leftAt) {
          // User is already actively in the session - this is fine, just return the existing record
          return existingSessionParticipant
        }
        // User rejoining - update leftAt to null
        return await prisma.sessionParticipant.update({
          where: { id: existingSessionParticipant.id },
          data: { leftAt: null }
        })
      }

      // Add user to session
      const participant = await prisma.sessionParticipant.create({
        data: {
          userId,
          sessionId
        }
      })

      return participant
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Validation error: ${error.errors.map(e => e.message).join(', ')}`)
      }
      console.error('Error joining session:', error)
      throw error instanceof Error ? error : new Error('Failed to join session')
    }
  }

  /**
   * Leave a session (Zoom-like behavior)
   */
  async leaveSession(userId: string, sessionId: string): Promise<void> {
    try {
      // Verify session exists
      const session = await prisma.session.findUnique({
        where: { id: sessionId },
        include: {
          havruta: true,
          participants: {
            where: { leftAt: null }, // Only active participants
            include: {
              user: {
                select: { id: true, name: true }
              }
            }
          }
        }
      })
      if (!session) {
        throw new Error('Session not found')
      }

      // Find session participant
      const participant = await prisma.sessionParticipant.findUnique({
        where: {
          userId_sessionId: {
            userId,
            sessionId
          }
        }
      })
      if (!participant) {
        throw new Error('User is not in this session')
      }
      if (participant.leftAt) {
        throw new Error('User has already left this session')
      }

      const leaveTime = new Date()
      const isOwner = session.havruta.ownerId === userId
      const activeParticipants = session.participants.filter(p => p.userId !== userId)

      await prisma.$transaction(async (tx) => {
        // Mark user as left
        await tx.sessionParticipant.update({
          where: { id: participant.id },
          data: { leftAt: leaveTime }
        })

        // If owner is leaving and there are other participants, transfer ownership
        if (isOwner && activeParticipants.length > 0) {
          // Transfer ownership to the next participant (first one who joined)
          const newOwnerId = activeParticipants[0].userId
          await tx.havruta.update({
            where: { id: session.havrutaId },
            data: { ownerId: newOwnerId }
          })
          
          console.log(`Ownership transferred from ${userId} to ${newOwnerId} for Havruta ${session.havrutaId}`)
        }

        // If no one is left in the session, auto-close it
        if (activeParticipants.length === 0) {
          await tx.session.update({
            where: { id: sessionId },
            data: { 
              status: 'completed',
              endTime: leaveTime,
              endingSection: session.startingSection || `${session.havruta.bookTitle} 1:1`,
              coverageRange: 'Session auto-ended - all participants left'
            }
          })
          
          console.log(`Session ${sessionId} auto-closed - no participants remaining`)
        }
      })
    } catch (error) {
      console.error('Error leaving session:', error)
      throw error instanceof Error ? error : new Error('Failed to leave session')
    }
  }

  /**
   * Activate a scheduled session (when participants join)
   */
  async activateSession(sessionId: string): Promise<void> {
    try {
      const session = await prisma.session.findUnique({
        where: { id: sessionId }
      })
      
      if (!session) {
        throw new Error('Session not found')
      }
      
      if (session.status !== 'scheduled') {
        throw new Error('Only scheduled sessions can be activated')
      }

      await prisma.session.update({
        where: { id: sessionId },
        data: { 
          status: 'active',
          startTime: new Date() // Update actual start time when activated
        }
      })
    } catch (error) {
      console.error('Error activating session:', error)
      throw error instanceof Error ? error : new Error('Failed to activate session')
    }
  }

  /**
   * Create an instant session that immediately starts and sends notifications
   */
  async createInstantSession(havrutaId: string, creatorUserId: string): Promise<SessionWithRelations> {
    try {
      // Verify user is the Havruta owner
      const havruta = await prisma.havruta.findUnique({
        where: { id: havrutaId },
        include: {
          owner: true,
          participants: {
            include: { user: true }
          }
        }
      })

      if (!havruta) {
        throw new Error('Havruta not found')
      }
      if (!havruta.isActive) {
        throw new Error('Cannot create session for inactive Havruta')
      }
      if (havruta.ownerId !== creatorUserId) {
        throw new Error('Only the Havruta owner can create instant sessions')
      }

      // Check if there's already an active session - this is critical validation
      const existingActiveSession = await prisma.session.findFirst({
        where: {
          havrutaId,
          status: { in: ['active', 'scheduled'] }
        }
      })

      if (existingActiveSession) {
        throw new Error('There is already an active session for this Havruta')
      }

      // Create instant session
      const session = await this.initializeSession({
        havrutaId,
        type: 'instant',
        startTime: new Date(),
        participantIds: havruta.participants.map(p => p.userId)
      })

      // Send real-time notifications to all participants (excluding creator)
      if (this.notificationService) {
        try {
          await this.notificationService.sendInstantSessionInvitations(session.id, creatorUserId)
        } catch (notificationError) {
          console.error('Error sending instant session notifications:', notificationError)
          // Don't fail the session creation if notifications fail
        }
      }

      return session
    } catch (error) {
      console.error('Error creating instant session:', error)
      throw error instanceof Error ? error : new Error('Failed to create instant session')
    }
  }

  /**
   * End a session with coverage range tracking (Zoom-like behavior)
   */
  async endSession(sessionId: string, userId: string, data: EndSessionData): Promise<void> {
    try {
      // Validate input data
      const validatedData = endSessionSchema.parse(data)
      const { endingSection, coverageRange } = validatedData

      // Verify session exists and is active
      const session = await prisma.session.findUnique({
        where: { id: sessionId },
        include: {
          havruta: true
        }
      })
      if (!session) {
        throw new Error('Session not found')
      }
      if (session.status === 'completed' || session.status === 'cancelled') {
        throw new Error('Session has already ended')
      }

      // Check if user is the current Havruta owner (ownership may have been transferred)
      if (session.havruta.ownerId !== userId) {
        throw new Error('Only the current session owner can end sessions for everyone')
      }

      const endTime = new Date()
      const finalCoverageRange = coverageRange || `${session.startingSection} to ${endingSection}`

      // End session and update Havruta progress
      await prisma.$transaction(async (tx) => {
        // End the session with coverage tracking
        await tx.session.update({
          where: { id: sessionId },
          data: { 
            status: 'completed',
            endTime,
            endingSection,
            coverageRange: finalCoverageRange
          }
        })

        // Update Havruta's lastPlace to the owner's final location
        await tx.havruta.update({
          where: { id: session.havrutaId },
          data: {
            lastPlace: endingSection,
            lastStudiedAt: endTime
          }
        })

        // Mark all active participants as left
        await tx.sessionParticipant.updateMany({
          where: {
            sessionId,
            leftAt: null
          },
          data: { leftAt: endTime }
        })
      })
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Validation error: ${error.errors.map(e => e.message).join(', ')}`)
      }
      console.error('Error ending session:', error)
      throw error instanceof Error ? error : new Error('Failed to end session')
    }
  }  /**

   * Get session state for real-time synchronization
   */
  async getSessionState(sessionId: string): Promise<SessionState | null> {
    try {
      const session = await prisma.session.findUnique({
        where: { id: sessionId },
        include: {
          havruta: true,
          participants: {
            where: { leftAt: null }, // Only active participants
            include: {
              user: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          },
          _count: {
            select: {
              participants: true
            }
          }
        }
      })

      if (!session) {
        return null
      }

      return {
        id: session.id,
        havrutaId: session.havrutaId,
        type: session.type,
        status: session.status,
        isActive: session.status === 'active',
        startTime: session.startTime,
        endTime: session.endTime,
        startingSection: session.startingSection,
        endingSection: session.endingSection,
        coverageRange: session.coverageRange,
        sectionsStudied: session.sectionsStudied,
        activeParticipants: session.participants.map(p => ({
          userId: p.user.id,
          name: p.user.name,
          joinedAt: p.joinedAt
        })),
        totalParticipants: session._count.participants
      }
    } catch (error) {
      console.error('Error fetching session state:', error)
      throw new Error('Failed to fetch session state')
    }
  }

  /**
   * Update session progress (sections studied)
   */
  async updateSessionProgress(sessionId: string, sectionsStudied: string[], userId: string): Promise<void> {
    try {
      // Verify user is in the session
      const participant = await prisma.sessionParticipant.findUnique({
        where: {
          userId_sessionId: {
            userId,
            sessionId
          }
        }
      })
      if (!participant || participant.leftAt) {
        throw new Error('User is not in this session')
      }

      // Update session progress
      await prisma.session.update({
        where: { id: sessionId },
        data: {
          sectionsStudied: {
            set: sectionsStudied
          }
        }
      })
    } catch (error) {
      console.error('Error updating session progress:', error)
      throw error instanceof Error ? error : new Error('Failed to update session progress')
    }
  }

  /**
   * Track individual user progress in a session
   */
  async trackUserProgress(sessionId: string, userId: string, data: UpdateProgressData): Promise<void> {
    try {
      // Validate input data
      const validatedData = updateProgressSchema.parse(data)

      // Verify user is in the session
      const sessionParticipant = await prisma.sessionParticipant.findUnique({
        where: {
          userId_sessionId: {
            userId,
            sessionId
          }
        },
        include: {
          session: {
            include: {
              havruta: true
            }
          }
        }
      })

      if (!sessionParticipant || sessionParticipant.leftAt) {
        throw new Error('User is not in this session')
      }

      const havrutaId = sessionParticipant.session.havrutaId

      // Update or create user progress for this Havruta
      await prisma.progress.upsert({
        where: {
          userId_havrutaId: {
            userId,
            havrutaId
          }
        },
        update: {
          ...(validatedData.sectionsStudied && {
            sectionsCompleted: {
              set: validatedData.sectionsStudied
            }
          }),
          ...(validatedData.currentSection && {
            lastSection: validatedData.currentSection
          }),
          ...(validatedData.timeStudied && {
            totalTimeStudied: {
              increment: validatedData.timeStudied
            }
          }),
          updatedAt: new Date()
        },
        create: {
          userId,
          havrutaId,
          sectionsCompleted: validatedData.sectionsStudied || [],
          lastSection: validatedData.currentSection || '',
          totalTimeStudied: validatedData.timeStudied || 0
        }
      })

      // Update Havruta's last studied time if current section is provided
      if (validatedData.currentSection) {
        await prisma.havruta.update({
          where: { id: havrutaId },
          data: {
            lastStudiedAt: new Date()
          }
        })
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Validation error: ${error.errors.map(e => e.message).join(', ')}`)
      }
      console.error('Error tracking user progress:', error)
      throw error instanceof Error ? error : new Error('Failed to track user progress')
    }
  }

  /**
   * Get active session for a Havruta
   */
  async getActiveSessionForHavruta(havrutaId: string): Promise<SessionWithRelations | null> {
    try {
      const session = await prisma.session.findFirst({
        where: {
          havrutaId,
          status: { in: ['active', 'scheduled'] }
        },
        include: {
          havruta: {
            include: {
              owner: {
                select: {
                  id: true,
                  name: true,
                  email: true
                }
              }
            }
          },
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  profilePicture: true
                }
              }
            },
            orderBy: { joinedAt: 'asc' }
          },
          _count: {
            select: {
              participants: true
            }
          }
        }
      })
      return session
    } catch (error) {
      console.error('Error fetching active session for Havruta:', error)
      throw new Error('Failed to fetch active session')
    }
  }

  /**
   * Get user's active sessions
   */
  async getUserActiveSessions(userId: string): Promise<SessionWithRelations[]> {
    try {
      const sessions = await prisma.session.findMany({
        where: {
          status: { in: ['active', 'scheduled'] },
          participants: {
            some: {
              userId,
              leftAt: null
            }
          }
        },
        include: {
          havruta: {
            include: {
              owner: {
                select: {
                  id: true,
                  name: true,
                  email: true
                }
              }
            }
          },
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  profilePicture: true
                }
              }
            },
            orderBy: { joinedAt: 'asc' }
          },
          _count: {
            select: {
              participants: true
            }
          }
        },
        orderBy: { startTime: 'desc' }
      })
      return sessions
    } catch (error) {
      console.error('Error fetching user active sessions:', error)
      throw new Error('Failed to fetch user active sessions')
    }
  }

  /**
   * Get session history for a Havruta
   */
  async getHavrutaSessionHistory(havrutaId: string, userId: string): Promise<SessionWithRelations[]> {
    try {
      // Verify user has access to this Havruta
      const hasAccess = await prisma.havrutaParticipant.findUnique({
        where: {
          userId_havrutaId: {
            userId,
            havrutaId
          }
        }
      })
      if (!hasAccess) {
        throw new Error('User does not have access to this Havruta')
      }

      const sessions = await prisma.session.findMany({
        where: { havrutaId },
        include: {
          havruta: {
            include: {
              owner: {
                select: {
                  id: true,
                  name: true,
                  email: true
                }
              }
            }
          },
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  profilePicture: true
                }
              }
            },
            orderBy: { joinedAt: 'asc' }
          },
          _count: {
            select: {
              participants: true
            }
          }
        },
        orderBy: { startTime: 'desc' }
      })
      return sessions
    } catch (error) {
      console.error('Error fetching Havruta session history:', error)
      throw error instanceof Error ? error : new Error('Failed to fetch session history')
    }
  }

  /**
   * Cleanup inactive sessions (sessions that have been running for too long without activity)
   */
  async cleanupInactiveSessions(maxHours: number = 24): Promise<number> {
    try {
      const cutoffTime = new Date()
      cutoffTime.setHours(cutoffTime.getHours() - maxHours)

      // Find sessions that have been active for too long
      const inactiveSessions = await prisma.session.findMany({
        where: {
          status: 'active',
          startTime: {
            lt: cutoffTime
          }
        }
      })

      if (inactiveSessions.length === 0) {
        return 0
      }

      // End these sessions
      await prisma.$transaction(async (tx) => {
        const sessionIds = inactiveSessions.map(s => s.id)
        
        // End the sessions
        await tx.session.updateMany({
          where: {
            id: { in: sessionIds }
          },
          data: { 
            status: 'completed',
            endTime: new Date() 
          }
        })

        // Mark all active participants as left
        await tx.sessionParticipant.updateMany({
          where: {
            sessionId: { in: sessionIds },
            leftAt: null
          },
          data: { leftAt: new Date() }
        })
      })

      return inactiveSessions.length
    } catch (error) {
      console.error('Error cleaning up inactive sessions:', error)
      throw new Error('Failed to cleanup inactive sessions')
    }
  }

  /**
   * Check if user has access to session
   */
  async hasSessionAccess(sessionId: string, userId: string): Promise<boolean> {
    try {
      const participant = await prisma.sessionParticipant.findUnique({
        where: {
          userId_sessionId: {
            userId,
            sessionId
          }
        }
      })
      return !!participant
    } catch (error) {
      console.error('Error checking session access:', error)
      return false
    }
  }

  /**
   * Check if user is the current session owner (can end session for everyone)
   */
  async isSessionOwner(sessionId: string, userId: string): Promise<boolean> {
    try {
      const session = await prisma.session.findUnique({
        where: { id: sessionId },
        include: {
          havruta: {
            select: { ownerId: true }
          }
        }
      })
      return session?.havruta.ownerId === userId
    } catch (error) {
      console.error('Error checking session ownership:', error)
      return false
    }
  }

  /**
   * Clean up old instant sessions that are still active
   */
  async cleanupOldInstantSessions(): Promise<void> {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000) // 1 hour ago
      
      // Find instant sessions that are still active but started more than 1 hour ago
      const oldInstantSessions = await prisma.session.findMany({
        where: {
          type: 'instant',
          status: 'active',
          startTime: {
            lt: oneHourAgo
          }
        }
      })

      if (oldInstantSessions.length > 0) {
        console.log(`Cleaning up ${oldInstantSessions.length} old instant sessions`)
        
        // End these sessions
        await prisma.$transaction(async (tx) => {
          const endTime = new Date()
          
          for (const session of oldInstantSessions) {
            // End the session
            await tx.session.update({
              where: { id: session.id },
              data: { 
                status: 'completed',
                endTime,
                endingSection: session.startingSection || 'Session auto-ended',
                coverageRange: 'Auto-ended due to inactivity'
              }
            })

            // Mark all active participants as left
            await tx.sessionParticipant.updateMany({
              where: {
                sessionId: session.id,
                leftAt: null
              },
              data: { leftAt: endTime }
            })
          }
        })
      }
    } catch (error) {
      console.error('Error cleaning up old instant sessions:', error)
    }
  }
}

export const sessionService = new SessionService()