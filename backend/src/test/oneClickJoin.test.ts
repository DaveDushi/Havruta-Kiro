import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import { sessionService } from '../services/sessionService'
import { authService } from '../services/authService'
import { prisma } from '../utils/database'
import sessionRoutes from '../routes/sessions'
import { User, Havruta, Session } from '@prisma/client'

// Create test app
const app = express()
app.use(express.json())
app.use('/api/sessions', sessionRoutes)

describe('One-Click Join Functionality', () => {
  let testUsers: User[]
  let testHavruta: Havruta
  let testSession: Session
  let authTokens: string[]

  beforeEach(async () => {
    // Create test users
    testUsers = await Promise.all([
      prisma.user.create({
        data: {
          email: 'owner@test.com',
          name: 'Test Owner',
          oauthProvider: 'google',
          oauthId: 'owner123'
        }
      }),
      prisma.user.create({
        data: {
          email: 'participant1@test.com',
          name: 'Test Participant 1',
          oauthProvider: 'google',
          oauthId: 'participant1123'
        }
      }),
      prisma.user.create({
        data: {
          email: 'participant2@test.com',
          name: 'Test Participant 2',
          oauthProvider: 'google',
          oauthId: 'participant2123'
        }
      })
    ])

    // Generate auth tokens for test users
    authTokens = testUsers.map(user => authService.generateJWT(user))

    // Create test Havruta
    testHavruta = await prisma.havruta.create({
      data: {
        name: 'Test Havruta',
        bookId: 'genesis',
        bookTitle: 'Genesis',
        ownerId: testUsers[0].id,
        lastPlace: 'Genesis 1:1',
        isActive: true
      }
    })

    // Add participants to Havruta
    await prisma.havrutaParticipant.createMany({
      data: [
        { userId: testUsers[0].id, havrutaId: testHavruta.id },
        { userId: testUsers[1].id, havrutaId: testHavruta.id },
        { userId: testUsers[2].id, havrutaId: testHavruta.id }
      ]
    })

    // Create instant session manually to control participants
    testSession = await prisma.session.create({
      data: {
        havrutaId: testHavruta.id,
        type: 'instant',
        status: 'active',
        startTime: new Date(),
        startingSection: 'Genesis 1:1'
      }
    })

    // Add only the owner initially (simulating the creator starting the session)
    await prisma.sessionParticipant.create({
      data: {
        userId: testUsers[0].id,
        sessionId: testSession.id
      }
    })
  })

  afterEach(async () => {
    // Clean up test data
    await prisma.sessionParticipant.deleteMany()
    await prisma.session.deleteMany()
    await prisma.havrutaParticipant.deleteMany()
    await prisma.havruta.deleteMany()
    await prisma.user.deleteMany()
  })

  describe('POST /api/sessions/:id/join-instant', () => {
    it('should allow one-click join with complete session details', async () => {
      const response = await request(app)
        .post(`/api/sessions/${testSession.id}/join-instant`)
        .set('Authorization', `Bearer ${authTokens[1]}`)
        .expect(201)

      expect(response.body).toMatchObject({
        participant: {
          userId: testUsers[1].id,
          sessionId: testSession.id
        },
        session: {
          id: testSession.id,
          havrutaId: testHavruta.id,
          type: 'instant',
          status: 'active',
          startingSection: 'Genesis 1:1'
        },
        redirectUrl: `/havruta/${testHavruta.id}/session/${testSession.id}`
      })

      // Verify participant was actually added to session
      const participant = await prisma.sessionParticipant.findUnique({
        where: {
          userId_sessionId: {
            userId: testUsers[1].id,
            sessionId: testSession.id
          }
        }
      })

      expect(participant).toBeDefined()
      expect(participant?.leftAt).toBeNull()
    })

    it('should include full session details with Havruta information', async () => {
      const response = await request(app)
        .post(`/api/sessions/${testSession.id}/join-instant`)
        .set('Authorization', `Bearer ${authTokens[1]}`)
        .expect(201)

      expect(response.body.session).toMatchObject({
        havruta: {
          id: testHavruta.id,
          name: testHavruta.name,
          bookId: testHavruta.bookId,
          bookTitle: testHavruta.bookTitle,
          lastPlace: testHavruta.lastPlace,
          owner: {
            id: testUsers[0].id,
            name: testUsers[0].name,
            email: testUsers[0].email
          }
        }
      })
    })

    it('should include participant list in session details', async () => {
      const response = await request(app)
        .post(`/api/sessions/${testSession.id}/join-instant`)
        .set('Authorization', `Bearer ${authTokens[1]}`)
        .expect(201)

      expect(response.body.session.participants).toBeDefined()
      expect(Array.isArray(response.body.session.participants)).toBe(true)
      
      // Should include the joining participant
      const participantIds = response.body.session.participants.map((p: any) => p.user.id)
      expect(participantIds).toContain(testUsers[1].id)
    })

    it('should provide correct redirect URL for immediate navigation', async () => {
      const response = await request(app)
        .post(`/api/sessions/${testSession.id}/join-instant`)
        .set('Authorization', `Bearer ${authTokens[1]}`)
        .expect(201)

      expect(response.body.redirectUrl).toBe(`/havruta/${testHavruta.id}/session/${testSession.id}`)
    })

    it('should fail with 401 if user is not authenticated', async () => {
      await request(app)
        .post(`/api/sessions/${testSession.id}/join-instant`)
        .expect(401)
    })

    it('should fail with 404 if session does not exist', async () => {
      await request(app)
        .post(`/api/sessions/non-existent-session/join-instant`)
        .set('Authorization', `Bearer ${authTokens[1]}`)
        .expect(404)
    })

    it('should fail if user is not a Havruta participant', async () => {
      // Create a user who is not in the Havruta
      const outsideUser = await prisma.user.create({
        data: {
          email: 'outside@test.com',
          name: 'Outside User',
          oauthProvider: 'google',
          oauthId: 'outside123'
        }
      })

      const outsideToken = authService.generateJWT(outsideUser)

      await request(app)
        .post(`/api/sessions/${testSession.id}/join-instant`)
        .set('Authorization', `Bearer ${outsideToken}`)
        .expect(400)
    })

    it('should handle user already in session gracefully', async () => {
      // Join once
      await request(app)
        .post(`/api/sessions/${testSession.id}/join-instant`)
        .set('Authorization', `Bearer ${authTokens[1]}`)
        .expect(201)

      // Try to join again
      await request(app)
        .post(`/api/sessions/${testSession.id}/join-instant`)
        .set('Authorization', `Bearer ${authTokens[1]}`)
        .expect(400)
    })

    it('should allow rejoining after leaving', async () => {
      // Join session
      await request(app)
        .post(`/api/sessions/${testSession.id}/join-instant`)
        .set('Authorization', `Bearer ${authTokens[1]}`)
        .expect(201)

      // Leave session
      await request(app)
        .post(`/api/sessions/${testSession.id}/leave`)
        .set('Authorization', `Bearer ${authTokens[1]}`)
        .expect(204)

      // Rejoin should work
      const response = await request(app)
        .post(`/api/sessions/${testSession.id}/join-instant`)
        .set('Authorization', `Bearer ${authTokens[1]}`)
        .expect(201)

      expect(response.body.participant.userId).toBe(testUsers[1].id)
    })

    it('should fail if session has ended', async () => {
      // End the session
      await sessionService.endSession(testSession.id, testUsers[0].id, {
        endingSection: 'Genesis 2:1',
        coverageRange: 'Genesis 1:1 to Genesis 2:1'
      })

      await request(app)
        .post(`/api/sessions/${testSession.id}/join-instant`)
        .set('Authorization', `Bearer ${authTokens[1]}`)
        .expect(400)
    })

    it('should work for scheduled sessions that are active', async () => {
      // End the current instant session first
      await sessionService.endSession(testSession.id, testUsers[0].id, {
        endingSection: 'Genesis 2:1',
        coverageRange: 'Genesis 1:1 to Genesis 2:1'
      })

      // Create a scheduled session that is active
      const scheduledSession = await sessionService.initializeSession({
        havrutaId: testHavruta.id,
        type: 'scheduled',
        startTime: new Date(),
        participantIds: [testUsers[0].id, testUsers[2].id] // Don't include testUsers[1] initially
      })

      // Activate the scheduled session
      await sessionService.activateSession(scheduledSession.id)

      const response = await request(app)
        .post(`/api/sessions/${scheduledSession.id}/join-instant`)
        .set('Authorization', `Bearer ${authTokens[1]}`)
        .expect(201)

      expect(response.body.session.type).toBe('scheduled')
      expect(response.body.session.status).toBe('active')
    })

    it('should include session timing information', async () => {
      const response = await request(app)
        .post(`/api/sessions/${testSession.id}/join-instant`)
        .set('Authorization', `Bearer ${authTokens[1]}`)
        .expect(201)

      expect(response.body.session.startTime).toBeDefined()
      expect(new Date(response.body.session.startTime)).toBeInstanceOf(Date)
      expect(response.body.session.endTime).toBeNull()
    })

    it('should include session progress information', async () => {
      const response = await request(app)
        .post(`/api/sessions/${testSession.id}/join-instant`)
        .set('Authorization', `Bearer ${authTokens[1]}`)
        .expect(201)

      expect(response.body.session.startingSection).toBe('Genesis 1:1')
      expect(response.body.session.endingSection).toBeNull()
      expect(response.body.session.coverageRange).toBeNull()
    })

    it('should handle concurrent join requests', async () => {
      // Simulate concurrent join requests from multiple users (both not in session yet)
      const joinPromises = [
        request(app)
          .post(`/api/sessions/${testSession.id}/join-instant`)
          .set('Authorization', `Bearer ${authTokens[1]}`),
        request(app)
          .post(`/api/sessions/${testSession.id}/join-instant`)
          .set('Authorization', `Bearer ${authTokens[2]}`)
      ]

      const responses = await Promise.all(joinPromises)

      // Both should succeed
      expect(responses[0].status).toBe(201)
      expect(responses[1].status).toBe(201)

      // Verify both participants are in the session
      const participants = await prisma.sessionParticipant.findMany({
        where: { sessionId: testSession.id, leftAt: null }
      })

      const participantIds = participants.map(p => p.userId)
      expect(participantIds).toContain(testUsers[1].id)
      expect(participantIds).toContain(testUsers[2].id)
    })
  })

  describe('Regular join vs One-click join comparison', () => {
    it('should provide more information than regular join', async () => {
      // Regular join
      const regularResponse = await request(app)
        .post(`/api/sessions/${testSession.id}/join`)
        .set('Authorization', `Bearer ${authTokens[1]}`)
        .expect(201)

      // Leave and rejoin with one-click
      await request(app)
        .post(`/api/sessions/${testSession.id}/leave`)
        .set('Authorization', `Bearer ${authTokens[1]}`)
        .expect(204)

      const oneClickResponse = await request(app)
        .post(`/api/sessions/${testSession.id}/join-instant`)
        .set('Authorization', `Bearer ${authTokens[1]}`)
        .expect(201)

      // One-click should have more information
      expect(oneClickResponse.body).toHaveProperty('session')
      expect(oneClickResponse.body).toHaveProperty('redirectUrl')
      expect(oneClickResponse.body).toHaveProperty('participant')

      // Regular join only returns participant info
      expect(regularResponse.body).not.toHaveProperty('session')
      expect(regularResponse.body).not.toHaveProperty('redirectUrl')
    })
  })
})