import { User } from '@prisma/client'
import { prisma } from '../utils/database'
import { z } from 'zod'

// Validation schemas
export const updateUserProfileSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be less than 100 characters').optional(),
  profilePicture: z.string().url('Profile picture must be a valid URL').optional()
})

export const getUsersQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).optional().default('1'),
  limit: z.string().regex(/^\d+$/).transform(Number).optional().default('10'),
  search: z.string().optional()
})

export type UpdateUserProfileData = z.infer<typeof updateUserProfileSchema>
export type GetUsersQuery = z.infer<typeof getUsersQuerySchema>

export interface UserWithStats extends User {
  _count?: {
    createdHavrutot: number
    participantIn: number
  }
}

export class UserService {
  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<User | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId }
      })
      return user
    } catch (error) {
      console.error('Error fetching user by ID:', error)
      throw new Error('Failed to fetch user')
    }
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<User | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { email }
      })
      return user
    } catch (error) {
      console.error('Error fetching user by email:', error)
      throw new Error('Failed to fetch user')
    }
  }

  /**
   * Get user profile with statistics
   */
  async getUserProfile(userId: string): Promise<UserWithStats | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          _count: {
            select: {
              createdHavrutot: true,
              participantIn: true
            }
          }
        }
      })
      return user
    } catch (error) {
      console.error('Error fetching user profile:', error)
      throw new Error('Failed to fetch user profile')
    }
  }

  /**
   * Update user profile
   */
  async updateUserProfile(userId: string, data: UpdateUserProfileData): Promise<User> {
    try {
      // Validate input data
      const validatedData = updateUserProfileSchema.parse(data)

      const user = await prisma.user.update({
        where: { id: userId },
        data: {
          ...validatedData,
          lastActiveAt: new Date()
        }
      })
      return user
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Validation error: ${error.errors.map(e => e.message).join(', ')}`)
      }
      console.error('Error updating user profile:', error)
      throw new Error('Failed to update user profile')
    }
  }

  /**
   * Delete user account and all related data
   */
  async deleteUser(userId: string): Promise<void> {
    try {
      // Note: Prisma will handle cascading deletes based on schema relationships
      await prisma.user.delete({
        where: { id: userId }
      })
    } catch (error) {
      console.error('Error deleting user:', error)
      throw new Error('Failed to delete user account')
    }
  }

  /**
   * Get users with pagination and search
   * (Admin functionality - would need additional authorization in production)
   */
  async getUsers(query: GetUsersQuery): Promise<{
    users: User[]
    pagination: {
      page: number
      limit: number
      total: number
      totalPages: number
    }
  }> {
    try {
      const validatedQuery = getUsersQuerySchema.parse(query)
      const { page, limit, search } = validatedQuery

      const skip = (page - 1) * limit

      // Build where clause for search
      const where = search ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { email: { contains: search, mode: 'insensitive' as const } }
        ]
      } : {}

      // Get total count for pagination
      const total = await prisma.user.count({ where })

      // Get users with pagination
      const users = await prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }
      })

      return {
        users,
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
      console.error('Error fetching users:', error)
      throw new Error('Failed to fetch users')
    }
  }

  /**
   * Check if user exists
   */
  async userExists(userId: string): Promise<boolean> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true }
      })
      return !!user
    } catch (error) {
      console.error('Error checking if user exists:', error)
      return false
    }
  }

  /**
   * Get user's Havrutot summary
   */
  async getUserHavrutotSummary(userId: string): Promise<{
    created: number
    participating: number
    active: number
  }> {
    try {
      const [created, participating, active] = await Promise.all([
        prisma.havruta.count({
          where: { ownerId: userId }
        }),
        prisma.havrutaParticipant.count({
          where: { userId }
        }),
        prisma.havruta.count({
          where: {
            isActive: true,
            OR: [
              { ownerId: userId },
              { participants: { some: { userId } } }
            ]
          }
        })
      ])

      return { created, participating, active }
    } catch (error) {
      console.error('Error fetching user Havrutot summary:', error)
      throw new Error('Failed to fetch user Havrutot summary')
    }
  }
}

export const userService = new UserService()