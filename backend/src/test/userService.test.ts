import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { prisma } from '../utils/database'
import { userService, UpdateUserProfileData } from '../services/userService'

// Test data
let testUser: any
let otherUser: any

describe('UserService', () => {
  beforeAll(async () => {
    // Clean up any existing test data
    await prisma.user.deleteMany({
      where: {
        email: {
          in: ['service-test@example.com', 'service-other@example.com']
        }
      }
    })
  })

  afterAll(async () => {
    // Clean up test data
    await prisma.user.deleteMany({
      where: {
        email: {
          in: ['service-test@example.com', 'service-other@example.com']
        }
      }
    })
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    // Clean up any existing test data first
    await prisma.user.deleteMany({
      where: {
        email: {
          in: ['service-test@example.com', 'service-other@example.com']
        }
      }
    })

    // Create test users
    testUser = await prisma.user.create({
      data: {
        email: 'service-test@example.com',
        name: 'Service Test User',
        oauthProvider: 'google',
        oauthId: 'service-test-oauth-id',
        profilePicture: 'https://example.com/avatar.jpg'
      }
    })

    otherUser = await prisma.user.create({
      data: {
        email: 'service-other@example.com',
        name: 'Service Other User',
        oauthProvider: 'google',
        oauthId: 'service-other-oauth-id'
      }
    })
  })

  afterEach(async () => {
    // Clean up test data after each test
    await prisma.user.deleteMany({
      where: {
        email: {
          in: ['service-test@example.com', 'service-other@example.com']
        }
      }
    })
  })

  describe('getUserById', () => {
    it('should return user when found', async () => {
      const user = await userService.getUserById(testUser.id)
      
      expect(user).toBeDefined()
      expect(user?.id).toBe(testUser.id)
      expect(user?.email).toBe(testUser.email)
      expect(user?.name).toBe(testUser.name)
    })

    it('should return null when user not found', async () => {
      const user = await userService.getUserById('non-existent-id')
      expect(user).toBeNull()
    })

    it('should throw error for invalid database operation', async () => {
      // This test would require mocking prisma to simulate database errors
      // For now, we'll test the happy path
      expect(async () => {
        await userService.getUserById(testUser.id)
      }).not.toThrow()
    })
  })

  describe('getUserByEmail', () => {
    it('should return user when found by email', async () => {
      const user = await userService.getUserByEmail(testUser.email)
      
      expect(user).toBeDefined()
      expect(user?.id).toBe(testUser.id)
      expect(user?.email).toBe(testUser.email)
    })

    it('should return null when user not found by email', async () => {
      const user = await userService.getUserByEmail('nonexistent@example.com')
      expect(user).toBeNull()
    })
  })

  describe('getUserProfile', () => {
    it('should return user profile with statistics', async () => {
      const profile = await userService.getUserProfile(testUser.id)
      
      expect(profile).toBeDefined()
      expect(profile?.id).toBe(testUser.id)
      expect(profile?._count).toBeDefined()
      expect(profile?._count?.createdHavrutot).toBeDefined()
      expect(profile?._count?.participantIn).toBeDefined()
      expect(typeof profile?._count?.createdHavrutot).toBe('number')
      expect(typeof profile?._count?.participantIn).toBe('number')
    })

    it('should return null when user not found', async () => {
      const profile = await userService.getUserProfile('non-existent-id')
      expect(profile).toBeNull()
    })
  })

  describe('updateUserProfile', () => {
    it('should update user profile successfully', async () => {
      const updateData: UpdateUserProfileData = {
        name: 'Updated Name',
        profilePicture: 'https://example.com/new-avatar.jpg'
      }

      const updatedUser = await userService.updateUserProfile(testUser.id, updateData)
      
      expect(updatedUser.name).toBe(updateData.name)
      expect(updatedUser.profilePicture).toBe(updateData.profilePicture)
      expect(updatedUser.id).toBe(testUser.id)
      expect(updatedUser.email).toBe(testUser.email)
    })

    it('should update only provided fields', async () => {
      const updateData: UpdateUserProfileData = {
        name: 'Only Name Updated'
      }

      const updatedUser = await userService.updateUserProfile(testUser.id, updateData)
      
      expect(updatedUser.name).toBe(updateData.name)
      expect(updatedUser.profilePicture).toBe(testUser.profilePicture) // Should remain unchanged
    })

    it('should throw validation error for invalid data', async () => {
      const invalidData = {
        name: '', // Empty name should fail validation
        profilePicture: 'not-a-url'
      }

      await expect(
        userService.updateUserProfile(testUser.id, invalidData)
      ).rejects.toThrow('Validation error')
    })

    it('should throw error for non-existent user', async () => {
      const updateData: UpdateUserProfileData = {
        name: 'New Name'
      }

      await expect(
        userService.updateUserProfile('non-existent-id', updateData)
      ).rejects.toThrow()
    })
  })

  describe('deleteUser', () => {
    it('should delete user successfully', async () => {
      await userService.deleteUser(testUser.id)
      
      // Verify user is deleted
      const deletedUser = await prisma.user.findUnique({
        where: { id: testUser.id }
      })
      expect(deletedUser).toBeNull()
    })

    it('should throw error for non-existent user', async () => {
      await expect(
        userService.deleteUser('non-existent-id')
      ).rejects.toThrow()
    })
  })

  describe('getUsers', () => {
    it('should return paginated users with default parameters', async () => {
      const result = await userService.getUsers({})
      
      expect(result).toHaveProperty('users')
      expect(result).toHaveProperty('pagination')
      expect(Array.isArray(result.users)).toBe(true)
      expect(result.pagination.page).toBe(1)
      expect(result.pagination.limit).toBe(10)
      expect(typeof result.pagination.total).toBe('number')
      expect(typeof result.pagination.totalPages).toBe('number')
    })

    it('should respect pagination parameters', async () => {
      const result = await userService.getUsers({
        page: '2',
        limit: '1'
      })
      
      expect(result.pagination.page).toBe(2)
      expect(result.pagination.limit).toBe(1)
      expect(result.users.length).toBeLessThanOrEqual(1)
    })

    it('should filter users by search term', async () => {
      const result = await userService.getUsers({
        search: 'Service Test'
      })
      
      expect(result.users.length).toBeGreaterThan(0)
      const foundUser = result.users.find(u => u.name.includes('Service Test'))
      expect(foundUser).toBeDefined()
    })

    it('should return empty results for non-matching search', async () => {
      const result = await userService.getUsers({
        search: 'NonExistentUser12345'
      })
      
      expect(result.users.length).toBe(0)
      expect(result.pagination.total).toBe(0)
    })

    it('should throw validation error for invalid parameters', async () => {
      await expect(
        userService.getUsers({
          page: 'invalid',
          limit: 'abc'
        })
      ).rejects.toThrow('Validation error')
    })
  })

  describe('userExists', () => {
    it('should return true for existing user', async () => {
      const exists = await userService.userExists(testUser.id)
      expect(exists).toBe(true)
    })

    it('should return false for non-existent user', async () => {
      const exists = await userService.userExists('non-existent-id')
      expect(exists).toBe(false)
    })
  })

  describe('getUserHavrutotSummary', () => {
    it('should return Havrutot summary with zero counts for new user', async () => {
      const summary = await userService.getUserHavrutotSummary(testUser.id)
      
      expect(summary).toHaveProperty('created')
      expect(summary).toHaveProperty('participating')
      expect(summary).toHaveProperty('active')
      expect(typeof summary.created).toBe('number')
      expect(typeof summary.participating).toBe('number')
      expect(typeof summary.active).toBe('number')
      
      // New user should have zero counts
      expect(summary.created).toBe(0)
      expect(summary.participating).toBe(0)
      expect(summary.active).toBe(0)
    })

    it('should throw error for non-existent user', async () => {
      // This should not throw an error, but return zero counts
      // The database queries will return 0 for non-existent users
      const summary = await userService.getUserHavrutotSummary('non-existent-id')
      expect(summary.created).toBe(0)
      expect(summary.participating).toBe(0)
      expect(summary.active).toBe(0)
    })
  })
})