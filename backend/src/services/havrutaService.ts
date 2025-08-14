import { Havruta, HavrutaParticipant } from '@prisma/client'
import { prisma } from '../utils/database'
import { z } from 'zod'

// Validation schemas
export const createHavrutaSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be less than 100 characters'),
  bookId: z.string().min(1, 'Book ID is required'),
  bookTitle: z.string().min(1, 'Book title is required'),
  creatorId: z.string().min(1, 'Creator ID is required'),
  currentSection: z.string().optional().default(''),
  participantIds: z.array(z.string()).optional().default([])
})

export const updateHavrutaSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  currentSection: z.string().optional(),
  isActive: z.boolean().optional(),
  lastStudiedAt: z.date().optional(),
  totalSessions: z.number().int().min(0).optional()
})

export const joinHavrutaSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  havrutaId: z.string().min(1, 'Havruta ID is required')
})

export const getHavrutotQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).optional().default('1'),
  limit: z.string().regex(/^\d+$/).transform(Number).optional().default('10'),
  isActive: z.string().transform(val => val === 'true').optional(),
  search: z.string().optional()
})

export type CreateHavrutaData = z.infer<typeof createHavrutaSchema>
export type UpdateHavrutaData = z.infer<typeof updateHavrutaSchema>
export type JoinHavrutaData = z.infer<typeof joinHavrutaSchema>
export type GetHavrutotQuery = z.infer<typeof getHavrutotQuerySchema>

export interface HavrutaWithRelations extends Havruta {
  creator: {
    id: string
    name: string
    email: string
    profilePicture?: string
  }
  participants: Array<{
    id: string
    joinedAt: Date
    user: {
      id: string
      name: string
      email: string
      profilePicture?: string
    }
  }>
  _count?: {
    sessions: number
    participants: number
  }
}

export interface HavrutaState {
  id: string
  name: string
  bookId: string
  bookTitle: string
  currentSection: string
  isActive: boolean
  participantCount: number
  activeParticipants: string[]
  lastStudiedAt: Date | null
  totalSessions: number
}

export class HavrutaService {
  /**
   * Create a new Havruta
   */
  async createHavruta(data: CreateHavrutaData): Promise<HavrutaWithRelations> {
    try {
      // Validate input data
      const validatedData = createHavrutaSchema.parse(data)
      const { participantIds, ...havrutaData } = validatedData

      // Verify creator exists
      const creator = await prisma.user.findUnique({
        where: { id: validatedData.creatorId }
      })
      if (!creator) {
        throw new Error('Creator not found')
      }

      // Verify all participants exist
      if (participantIds.length > 0) {
        const participants = await prisma.user.findMany({
          where: { id: { in: participantIds } }
        })
        if (participants.length !== participantIds.length) {
          throw new Error('One or more participants not found')
        }
      }

      // Validate participant limits (max 10 participants including creator)
      if (participantIds.length > 9) {
        throw new Error('Maximum 10 participants allowed (including creator)')
      }

      // Create Havruta with participants in a transaction
      const havruta = await prisma.$transaction(async (tx) => {
        // Create the Havruta
        const newHavruta = await tx.havruta.create({
          data: havrutaData
        })

        // Add participants (excluding creator to avoid duplication)
        const uniqueParticipantIds = participantIds.filter(id => id !== validatedData.creatorId)
        if (uniqueParticipantIds.length > 0) {
          await tx.havrutaParticipant.createMany({
            data: uniqueParticipantIds.map(userId => ({
              userId,
              havrutaId: newHavruta.id
            }))
          })
        }

        // Add creator as participant
        await tx.havrutaParticipant.create({
          data: {
            userId: validatedData.creatorId,
            havrutaId: newHavruta.id
          }
        })

        return newHavruta
      })

      // Return the created Havruta with relations
      return await this.getHavrutaById(havruta.id) as HavrutaWithRelations
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Validation error: ${error.errors.map(e => e.message).join(', ')}`)
      }
      console.error('Error creating Havruta:', error)
      throw error instanceof Error ? error : new Error('Failed to create Havruta')
    }
  }

  /**
   * Get Havruta by ID with relations
   */
  async getHavrutaById(havrutaId: string): Promise<HavrutaWithRelations | null> {
    try {
      const havruta = await prisma.havruta.findUnique({
        where: { id: havrutaId },
        include: {
          creator: {
            select: {
              id: true,
              name: true,
              email: true,
              profilePicture: true
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
              sessions: true,
              participants: true
            }
          }
        }
      })
      return havruta
    } catch (error) {
      console.error('Error fetching Havruta by ID:', error)
      throw new Error('Failed to fetch Havruta')
    }
  }

  /**
   * Join a Havruta
   */
  async joinHavruta(data: JoinHavrutaData): Promise<HavrutaParticipant> {
    try {
      // Validate input data
      const validatedData = joinHavrutaSchema.parse(data)
      const { userId, havrutaId } = validatedData

      // Verify user exists
      const user = await prisma.user.findUnique({
        where: { id: userId }
      })
      if (!user) {
        throw new Error('User not found')
      }

      // Verify Havruta exists and is active
      const havruta = await prisma.havruta.findUnique({
        where: { id: havrutaId },
        include: {
          _count: {
            select: { participants: true }
          }
        }
      })
      if (!havruta) {
        throw new Error('Havruta not found')
      }
      if (!havruta.isActive) {
        throw new Error('Cannot join inactive Havruta')
      }

      // Check participant limit (max 10 including creator)
      if (havruta._count.participants >= 10) {
        throw new Error('Havruta is full (maximum 10 participants)')
      }

      // Check if user is already a participant
      const existingParticipant = await prisma.havrutaParticipant.findUnique({
        where: {
          userId_havrutaId: {
            userId,
            havrutaId
          }
        }
      })
      if (existingParticipant) {
        throw new Error('User is already a participant in this Havruta')
      }

      // Add user as participant
      const participant = await prisma.havrutaParticipant.create({
        data: {
          userId,
          havrutaId
        }
      })

      return participant
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Validation error: ${error.errors.map(e => e.message).join(', ')}`)
      }
      console.error('Error joining Havruta:', error)
      throw error instanceof Error ? error : new Error('Failed to join Havruta')
    }
  }

  /**
   * Leave a Havruta
   */
  async leaveHavruta(userId: string, havrutaId: string): Promise<void> {
    try {
      // Verify Havruta exists
      const havruta = await prisma.havruta.findUnique({
        where: { id: havrutaId }
      })
      if (!havruta) {
        throw new Error('Havruta not found')
      }

      // Check if user is a participant
      const participant = await prisma.havrutaParticipant.findUnique({
        where: {
          userId_havrutaId: {
            userId,
            havrutaId
          }
        }
      })
      if (!participant) {
        throw new Error('User is not a participant in this Havruta')
      }

      // If user is the creator, transfer ownership or deactivate
      if (havruta.creatorId === userId) {
        // Find another participant to transfer ownership to
        const otherParticipant = await prisma.havrutaParticipant.findFirst({
          where: {
            havrutaId,
            userId: { not: userId }
          },
          include: { user: true }
        })

        if (otherParticipant) {
          // Transfer ownership to another participant
          await prisma.havruta.update({
            where: { id: havrutaId },
            data: { creatorId: otherParticipant.userId }
          })
        } else {
          // No other participants, deactivate the Havruta
          await prisma.havruta.update({
            where: { id: havrutaId },
            data: { isActive: false }
          })
        }
      }

      // Remove participant
      await prisma.havrutaParticipant.delete({
        where: {
          userId_havrutaId: {
            userId,
            havrutaId
          }
        }
      })
    } catch (error) {
      console.error('Error leaving Havruta:', error)
      throw error instanceof Error ? error : new Error('Failed to leave Havruta')
    }
  }  
/**
   * Update Havruta
   */
  async updateHavruta(havrutaId: string, data: UpdateHavrutaData, userId: string): Promise<HavrutaWithRelations> {
    try {
      // Validate input data
      const validatedData = updateHavrutaSchema.parse(data)

      // Verify Havruta exists and user has permission to update
      const havruta = await prisma.havruta.findUnique({
        where: { id: havrutaId }
      })
      if (!havruta) {
        throw new Error('Havruta not found')
      }
      if (havruta.creatorId !== userId) {
        throw new Error('Only the creator can update this Havruta')
      }

      // Update Havruta
      await prisma.havruta.update({
        where: { id: havrutaId },
        data: validatedData
      })

      // Return updated Havruta with relations
      return await this.getHavrutaById(havrutaId) as HavrutaWithRelations
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Validation error: ${error.errors.map(e => e.message).join(', ')}`)
      }
      console.error('Error updating Havruta:', error)
      throw error instanceof Error ? error : new Error('Failed to update Havruta')
    }
  }

  /**
   * Delete Havruta (only by creator)
   */
  async deleteHavruta(havrutaId: string, userId: string): Promise<void> {
    try {
      // Verify Havruta exists and user has permission to delete
      const havruta = await prisma.havruta.findUnique({
        where: { id: havrutaId }
      })
      if (!havruta) {
        throw new Error('Havruta not found')
      }
      if (havruta.creatorId !== userId) {
        throw new Error('Only the creator can delete this Havruta')
      }

      // Delete Havruta (cascading deletes will handle related records)
      await prisma.havruta.delete({
        where: { id: havrutaId }
      })
    } catch (error) {
      console.error('Error deleting Havruta:', error)
      throw error instanceof Error ? error : new Error('Failed to delete Havruta')
    }
  }

  /**
   * Get Havrutot for a user (created or participating)
   */
  async getUserHavrutot(userId: string, query: GetHavrutotQuery = {}): Promise<{
    havrutot: HavrutaWithRelations[]
    pagination: {
      page: number
      limit: number
      total: number
      totalPages: number
    }
  }> {
    try {
      const validatedQuery = getHavrutotQuerySchema.parse(query)
      const { page, limit, isActive, search } = validatedQuery

      const skip = (page - 1) * limit

      // Build where clause
      const where = {
        AND: [
          // User is either creator or participant
          {
            OR: [
              { creatorId: userId },
              { participants: { some: { userId } } }
            ]
          },
          // Filter by active status if specified
          ...(isActive !== undefined ? [{ isActive }] : []),
          // Search by name or book title if specified
          ...(search ? [{
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { bookTitle: { contains: search, mode: 'insensitive' as const } }
            ]
          }] : [])
        ]
      }

      // Get total count for pagination
      const total = await prisma.havruta.count({ where })

      // Get Havrutot with relations
      const havrutot = await prisma.havruta.findMany({
        where,
        skip,
        take: limit,
        orderBy: { lastStudiedAt: 'desc' },
        include: {
          creator: {
            select: {
              id: true,
              name: true,
              email: true,
              profilePicture: true
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
              sessions: true,
              participants: true
            }
          }
        }
      })

      return {
        havrutot,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Validation error: ${error.errors.map(e => e.message).join(', ')}`)
      }
      console.error('Error fetching user Havrutot:', error)
      throw new Error('Failed to fetch user Havrutot')
    }
  }

  /**
   * Get Havruta state for real-time synchronization
   */
  async getHavrutaState(havrutaId: string): Promise<HavrutaState | null> {
    try {
      const havruta = await prisma.havruta.findUnique({
        where: { id: havrutaId },
        include: {
          participants: {
            select: {
              userId: true
            }
          },
          _count: {
            select: {
              participants: true
            }
          }
        }
      })

      if (!havruta) {
        return null
      }

      return {
        id: havruta.id,
        name: havruta.name,
        bookId: havruta.bookId,
        bookTitle: havruta.bookTitle,
        currentSection: havruta.currentSection,
        isActive: havruta.isActive,
        participantCount: havruta._count.participants,
        activeParticipants: havruta.participants.map(p => p.userId),
        lastStudiedAt: havruta.lastStudiedAt,
        totalSessions: havruta.totalSessions
      }
    } catch (error) {
      console.error('Error fetching Havruta state:', error)
      throw new Error('Failed to fetch Havruta state')
    }
  }

  /**
   * Update Havruta progress (current section and last studied time)
   */
  async updateProgress(havrutaId: string, currentSection: string, userId: string): Promise<void> {
    try {
      // Verify user is a participant
      const participant = await prisma.havrutaParticipant.findUnique({
        where: {
          userId_havrutaId: {
            userId,
            havrutaId
          }
        }
      })
      if (!participant) {
        throw new Error('User is not a participant in this Havruta')
      }

      // Update Havruta progress
      await prisma.havruta.update({
        where: { id: havrutaId },
        data: {
          currentSection,
          lastStudiedAt: new Date()
        }
      })
    } catch (error) {
      console.error('Error updating Havruta progress:', error)
      throw error instanceof Error ? error : new Error('Failed to update progress')
    }
  }

  /**
   * Check if user has permission to access Havruta
   */
  async hasAccess(havrutaId: string, userId: string): Promise<boolean> {
    try {
      const participant = await prisma.havrutaParticipant.findUnique({
        where: {
          userId_havrutaId: {
            userId,
            havrutaId
          }
        }
      })
      return !!participant
    } catch (error) {
      console.error('Error checking Havruta access:', error)
      return false
    }
  }

  /**
   * Get active Havrutot (for dashboard "Next Up" section)
   */
  async getActiveHavrutot(userId: string): Promise<HavrutaWithRelations[]> {
    try {
      const havrutot = await prisma.havruta.findMany({
        where: {
          isActive: true,
          OR: [
            { creatorId: userId },
            { participants: { some: { userId } } }
          ]
        },
        orderBy: { lastStudiedAt: 'desc' },
        take: 5, // Limit to 5 most recent active Havrutot
        include: {
          creator: {
            select: {
              id: true,
              name: true,
              email: true,
              profilePicture: true
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
              sessions: true,
              participants: true
            }
          }
        }
      })

      return havrutot
    } catch (error) {
      console.error('Error fetching active Havrutot:', error)
      throw new Error('Failed to fetch active Havrutot')
    }
  }
}

export const havrutaService = new HavrutaService()