import { Session, SessionParticipant, Progress } from '@prisma/client'
import { prisma } from '../utils/database'
import { z } from 'zod'

// Validation schemas
export const createSessionSchema = z.object({
  havrutaId: z.string().min(1, 'Havruta ID is required'),
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

export type CreateSessionData = z.infer<typeof createSessionSchema>
export type JoinSessionData = z.infer<typeof joinSessionSchema>
export type UpdateProgressData = z.infer<typeof updateProgressSchema>

export interface SessionWithRelations extends Session {
  havruta: {
    id: string
    name: string
    bookId: string
    bookTitle: string
    currentSection: string
    isActive: boolean
    creator: {
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
      profilePicture?: string
    }
  }>
  _count?: {
    participants: number
  }
}

export interface SessionState {
  id: string
  havrutaId: string
  isActive: boolean
  startTime: Date
  endTime: Date | null
  currentSection: string
  sectionsStudied: string[]
  activeParticipants: Array<{
    userId: string
    name: string
    joinedAt: Date
  }>
  totalParticipants: number
}

export class SessionService {
  /**
   * Initialize a new session for a Havruta
   */
  async initializeSession(data: CreateSessionData): Promise<SessionWithRelations> {
    try {
      // Validate input data
      const validatedData = createSessionSchema.parse(data)
      const { havrutaId, startTime, participantIds } = validatedData

      // Verify Havruta exists and is active
      const havruta = await prisma.havruta.findUnique({
        where: { id: havrutaId },
        include: {
          creator: true,
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
          endTime: null
        }
      })

      if (existingActiveSession) {
        throw new Error('There is already an active session for this Havruta')
      }

      // Create session with participants in a transaction
      const session = await prisma.$transaction(async (tx) => {
        // Create the session
        const newSession = await tx.session.create({
          data: {
            havrutaId,
            startTime,
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
              creator: {
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
      if (session.endTime) {
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
          throw new Error('User is already in this session')
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
   * Leave a session
   */
  async leaveSession(userId: string, sessionId: string): Promise<void> {
    try {
      // Verify session exists
      const session = await prisma.session.findUnique({
        where: { id: sessionId }
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

      // Mark participant as left
      await prisma.sessionParticipant.update({
        where: { id: participant.id },
        data: { leftAt: new Date() }
      })
    } catch (error) {
      console.error('Error leaving session:', error)
      throw error instanceof Error ? error : new Error('Failed to leave session')
    }
  }

  /**
   * End a session
   */
  async endSession(sessionId: string, userId: string): Promise<void> {
    try {
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
      if (session.endTime) {
        throw new Error('Session has already ended')
      }

      // Check if user has permission to end session (creator or participant)
      const hasPermission = session.havruta.creatorId === userId || 
        await prisma.sessionParticipant.findFirst({
          where: {
            sessionId,
            userId,
            leftAt: null
          }
        })

      if (!hasPermission) {
        throw new Error('User does not have permission to end this session')
      }

      // End session and mark all active participants as left
      await prisma.$transaction(async (tx) => {
        // End the session
        await tx.session.update({
          where: { id: sessionId },
          data: { endTime: new Date() }
        })

        // Mark all active participants as left
        await tx.sessionParticipant.updateMany({
          where: {
            sessionId,
            leftAt: null
          },
          data: { leftAt: new Date() }
        })
      })
    } catch (error) {
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
        isActive: !session.endTime,
        startTime: session.startTime,
        endTime: session.endTime,
        currentSection: session.havruta.currentSection,
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

      // Update Havruta's current section if provided
      if (validatedData.currentSection) {
        await prisma.havruta.update({
          where: { id: havrutaId },
          data: {
            currentSection: validatedData.currentSection,
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
          endTime: null
        },
        include: {
          havruta: {
            include: {
              creator: {
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
          endTime: null,
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
              creator: {
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
              creator: {
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
          endTime: null,
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
          data: { endTime: new Date() }
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
}

export const sessionService = new SessionService()