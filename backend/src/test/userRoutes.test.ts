import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import { prisma } from '../utils/database'
import { authService } from '../services/authService'
import userRoutes from '../routes/users'
import { authenticateToken } from '../middleware/auth'

// Create test app
const app = express()
app.use(express.json())
app.use('/api/users', userRoutes)

// Test data
let testUser: any
let testToken: string
let otherUser: any

describe('User Routes', () => {
  beforeAll(async () => {
    // Clean up any existing test data
    await prisma.user.deleteMany({
      where: {
        email: {
          in: ['test@example.com', 'other@example.com']
        }
      }
    })
  })

  afterAll(async () => {
    // Clean up test data
    await prisma.user.deleteMany({
      where: {
        email: {
          in: ['test@example.com', 'other@example.com']
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
          in: ['test@example.com', 'other@example.com']
        }
      }
    })

    // Create test users
    testUser = await prisma.user.create({
      data: {
        email: 'test@example.com',
        name: 'Test User',
        oauthProvider: 'google',
        oauthId: 'test-oauth-id',
        profilePicture: 'https://example.com/avatar.jpg'
      }
    })

    otherUser = await prisma.user.create({
      data: {
        email: 'other@example.com',
        name: 'Other User',
        oauthProvider: 'google',
        oauthId: 'other-oauth-id'
      }
    })

    // Generate test token
    testToken = authService.generateJWT(testUser)
  })

  afterEach(async () => {
    // Clean up test data after each test
    await prisma.user.deleteMany({
      where: {
        email: {
          in: ['test@example.com', 'other@example.com']
        }
      }
    })
  })

  describe('GET /api/users/profile', () => {
    it('should return user profile with statistics for authenticated user', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200)

      expect(response.body).toHaveProperty('user')
      expect(response.body).toHaveProperty('timestamp')
      expect(response.body.user).toHaveProperty('id', testUser.id)
      expect(response.body.user).toHaveProperty('email', testUser.email)
      expect(response.body.user).toHaveProperty('name', testUser.name)
      expect(response.body.user).toHaveProperty('_count')
      expect(response.body.user).not.toHaveProperty('oauthId')
    })

    it('should return 401 for unauthenticated request', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .expect(401)

      expect(response.body).toHaveProperty('error')
      expect(response.body.error.code).toBe('MISSING_TOKEN')
    })

    it('should return 401 for invalid token', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401)

      expect(response.body).toHaveProperty('error')
      expect(response.body.error.code).toBe('INVALID_TOKEN')
    })
  })

  describe('PUT /api/users/profile', () => {
    it('should update user profile successfully', async () => {
      const updateData = {
        name: 'Updated Name',
        profilePicture: 'https://example.com/new-avatar.jpg'
      }

      const response = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${testToken}`)
        .send(updateData)
        .expect(200)

      expect(response.body).toHaveProperty('user')
      expect(response.body).toHaveProperty('message', 'Profile updated successfully')
      expect(response.body.user.name).toBe(updateData.name)
      expect(response.body.user.profilePicture).toBe(updateData.profilePicture)
      expect(response.body.user).not.toHaveProperty('oauthId')
    })

    it('should update only provided fields', async () => {
      const updateData = { name: 'Only Name Updated' }

      const response = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${testToken}`)
        .send(updateData)
        .expect(200)

      expect(response.body.user.name).toBe(updateData.name)
      expect(response.body.user.profilePicture).toBe(testUser.profilePicture)
    })

    it('should return 400 for invalid data', async () => {
      const invalidData = {
        name: '', // Empty name should fail validation
        profilePicture: 'not-a-url'
      }

      const response = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${testToken}`)
        .send(invalidData)
        .expect(400)

      expect(response.body).toHaveProperty('error')
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
    })

    it('should return 401 for unauthenticated request', async () => {
      const response = await request(app)
        .put('/api/users/profile')
        .send({ name: 'New Name' })
        .expect(401)

      expect(response.body.error.code).toBe('MISSING_TOKEN')
    })
  })

  describe('DELETE /api/users/profile', () => {
    it('should delete user account successfully', async () => {
      const response = await request(app)
        .delete('/api/users/profile')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200)

      expect(response.body).toHaveProperty('message', 'User account deleted successfully')

      // Verify user is actually deleted
      const deletedUser = await prisma.user.findUnique({
        where: { id: testUser.id }
      })
      expect(deletedUser).toBeNull()
    })

    it('should return 401 for unauthenticated request', async () => {
      const response = await request(app)
        .delete('/api/users/profile')
        .expect(401)

      expect(response.body.error.code).toBe('MISSING_TOKEN')
    })
  })

  describe('GET /api/users/:userId', () => {
    it('should return public user profile', async () => {
      const response = await request(app)
        .get(`/api/users/${otherUser.id}`)
        .expect(200)

      expect(response.body).toHaveProperty('user')
      expect(response.body.user).toHaveProperty('id', otherUser.id)
      expect(response.body.user).toHaveProperty('name', otherUser.name)
      expect(response.body.user).toHaveProperty('profilePicture')
      expect(response.body.user).toHaveProperty('createdAt')
      
      // Should not include sensitive data
      expect(response.body.user).not.toHaveProperty('email')
      expect(response.body.user).not.toHaveProperty('oauthId')
      expect(response.body.user).not.toHaveProperty('oauthProvider')
    })

    it('should return 404 for non-existent user', async () => {
      const response = await request(app)
        .get('/api/users/non-existent-id')
        .expect(404)

      expect(response.body.error.code).toBe('USER_NOT_FOUND')
    })

    it('should return 400 for invalid user ID format', async () => {
      const response = await request(app)
        .get('/api/users/invalid')
        .expect(400)

      expect(response.body.error.code).toBe('INVALID_USER_ID')
    })
  })

  describe('GET /api/users/profile/havrutot-summary', () => {
    it('should return Havrutot summary for authenticated user', async () => {
      const response = await request(app)
        .get('/api/users/profile/havrutot-summary')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200)

      expect(response.body).toHaveProperty('summary')
      expect(response.body.summary).toHaveProperty('created')
      expect(response.body.summary).toHaveProperty('participating')
      expect(response.body.summary).toHaveProperty('active')
      expect(typeof response.body.summary.created).toBe('number')
      expect(typeof response.body.summary.participating).toBe('number')
      expect(typeof response.body.summary.active).toBe('number')
    })

    it('should return 401 for unauthenticated request', async () => {
      const response = await request(app)
        .get('/api/users/profile/havrutot-summary')
        .expect(401)

      expect(response.body.error.code).toBe('MISSING_TOKEN')
    })
  })

  describe('GET /api/users', () => {
    it('should return paginated users list for authenticated user', async () => {
      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200)

      expect(response.body).toHaveProperty('users')
      expect(response.body).toHaveProperty('pagination')
      expect(Array.isArray(response.body.users)).toBe(true)
      expect(response.body.pagination).toHaveProperty('page')
      expect(response.body.pagination).toHaveProperty('limit')
      expect(response.body.pagination).toHaveProperty('total')
      expect(response.body.pagination).toHaveProperty('totalPages')

      // Check that sensitive data is not included
      if (response.body.users.length > 0) {
        const user = response.body.users[0]
        expect(user).not.toHaveProperty('email')
        expect(user).not.toHaveProperty('oauthId')
        expect(user).not.toHaveProperty('oauthProvider')
      }
    })

    it('should support pagination parameters', async () => {
      const response = await request(app)
        .get('/api/users?page=1&limit=1')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200)

      expect(response.body.pagination.page).toBe(1)
      expect(response.body.pagination.limit).toBe(1)
      expect(response.body.users.length).toBeLessThanOrEqual(1)
    })

    it('should support search functionality', async () => {
      const response = await request(app)
        .get('/api/users?search=Test')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200)

      expect(response.body).toHaveProperty('users')
      // Should find the test user
      const foundUser = response.body.users.find((u: any) => u.name.includes('Test'))
      expect(foundUser).toBeDefined()
    })

    it('should return 400 for invalid pagination parameters', async () => {
      const response = await request(app)
        .get('/api/users?page=invalid&limit=abc')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(400)

      expect(response.body.error.code).toBe('VALIDATION_ERROR')
    })

    it('should return 401 for unauthenticated request', async () => {
      const response = await request(app)
        .get('/api/users')
        .expect(401)

      expect(response.body.error.code).toBe('MISSING_TOKEN')
    })
  })
})