import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { sessionService } from '../services/sessionService'
import { notificationService } from '../services/notificationService'
import { prisma } from '../utils/database'
import { User, Havruta, Session } from '@prisma/client'

// Mock dependencies
vi.mock('../services/notificationService', () => ({
  notificationService: {
    sendInstantSessionInvitations: vi.fn(),
    setWebSocketService: vi.fn()
  }
}))

describe('Instant Session Service', () => {
  let testUsers: User[]
  let testHavruta: Havruta
  let mockNotificationService: any

  beforeEach(async () => {
    // Set up mock notification service
    mockNotificationService = {
      sendInstantSessionInvitations: vi.fn().mockResolvedValue(undefined),
      setWebSocketService: vi.fn()
    }
    
    // Set the mock notification service
    sessionService.setNotificationService(mockNotificationService)

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

    // Create test Havruta with owner and participants
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
  })

  afterEach(async () => {
    // Clean up test data
    await prisma.sessionParticipant.deleteMany()
    await prisma.session.deleteMany()
    await prisma.havrutaParticipant.deleteMany()
    await prisma.havruta.deleteMany()
    await prisma.user.deleteMany()
    
    // Reset mocks
    vi.clearAllMocks()
  })

  describe('createInstantSession', () => {
    it('should create an instant session successfully', async () => {
      const session = await sessionService.createInstantSession(testHavruta.id, testUsers[0].id)

      expect(session).toBeDefined()
      expect(session.type).toBe('instant')
      expect(session.status).toBe('active')
      expect(session.havrutaId).toBe(testHavruta.id)
      expect(session.startingSection).toBe('Genesis 1:1')
      expect(session.participants).toHaveLength(3) // All participants should be added
    })

    it('should send notifications to all participants except creator', async () => {
      await sessionService.createInstantSession(testHavruta.id, testUsers[0].id)

      expect(mockNotificationService.sendInstantSessionInvitations).toHaveBeenCalledTimes(1)
      expect(mockNotificationService.sendInstantSessionInvitations).toHaveBeenCalledWith(
        expect.any(String), // sessionId
        testUsers[0].id // excludeUserId (creator)
      )
    })

    it('should fail if user is not the Havruta owner', async () => {
      await expect(
        sessionService.createInstantSession(testHavruta.id, testUsers[1].id)
      ).rejects.toThrow('Only the Havruta owner can create instant sessions')
    })

    it('should fail if Havruta does not exist', async () => {
      await expect(
        sessionService.createInstantSession('non-existent-id', testUsers[0].id)
      ).rejects.toThrow('Havruta not found')
    })

    it('should fail if Havruta is inactive', async () => {
      // Make Havruta inactive
      await prisma.havruta.update({
        where: { id: testHavruta.id },
        data: { isActive: false }
      })

      await expect(
        sessionService.createInstantSession(testHavruta.id, testUsers[0].id)
      ).rejects.toThrow('Cannot create session for inactive Havruta')
    })

    it('should prevent multiple active sessions per Havruta', async () => {
      // Create first instant session
      await sessionService.createInstantSession(testHavruta.id, testUsers[0].id)

      // Try to create second instant session
      await expect(
        sessionService.createInstantSession(testHavruta.id, testUsers[0].id)
      ).rejects.toThrow('There is already an active session for this Havruta')
    })

    it('should prevent instant session if scheduled session exists', async () => {
      // Create a scheduled session first
      await sessionService.initializeSession({
        havrutaId: testHavruta.id,
        type: 'scheduled',
        startTime: new Date(Date.now() + 60000), // 1 minute in future
        participantIds: [testUsers[0].id, testUsers[1].id]
      })

      // Try to create instant session
      await expect(
        sessionService.createInstantSession(testHavruta.id, testUsers[0].id)
      ).rejects.toThrow('There is already an active session for this Havruta')
    })

    it('should continue session creation even if notifications fail', async () => {
      // Mock notification service to throw error
      mockNotificationService.sendInstantSessionInvitations.mockRejectedValue(
        new Error('Notification service error')
      )

      // Session should still be created successfully
      const session = await sessionService.createInstantSession(testHavruta.id, testUsers[0].id)

      expect(session).toBeDefined()
      expect(session.type).toBe('instant')
      expect(session.status).toBe('active')
    })

    it('should load Havruta lastPlace as starting section', async () => {
      // Update Havruta's lastPlace
      await prisma.havruta.update({
        where: { id: testHavruta.id },
        data: { lastPlace: 'Genesis 5:10' }
      })

      const session = await sessionService.createInstantSession(testHavruta.id, testUsers[0].id)

      expect(session.startingSection).toBe('Genesis 5:10')
    })

    it('should include all Havruta participants in the session', async () => {
      const session = await sessionService.createInstantSession(testHavruta.id, testUsers[0].id)

      const participantIds = session.participants.map(p => p.user.id)
      expect(participantIds).toContain(testUsers[0].id)
      expect(participantIds).toContain(testUsers[1].id)
      expect(participantIds).toContain(testUsers[2].id)
    })

    it('should update Havruta totalSessions count', async () => {
      const initialHavruta = await prisma.havruta.findUnique({
        where: { id: testHavruta.id }
      })
      const initialCount = initialHavruta?.totalSessions || 0

      await sessionService.createInstantSession(testHavruta.id, testUsers[0].id)

      const updatedHavruta = await prisma.havruta.findUnique({
        where: { id: testHavruta.id }
      })

      expect(updatedHavruta?.totalSessions).toBe(initialCount + 1)
    })

    it('should update Havruta lastStudiedAt timestamp', async () => {
      const beforeTime = new Date()
      
      await sessionService.createInstantSession(testHavruta.id, testUsers[0].id)

      const updatedHavruta = await prisma.havruta.findUnique({
        where: { id: testHavruta.id }
      })

      expect(updatedHavruta?.lastStudiedAt).toBeDefined()
      expect(updatedHavruta?.lastStudiedAt!.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime())
    })
  })

  describe('Active Session Validation', () => {
    it('should correctly identify active sessions', async () => {
      // No active session initially
      const noActiveSession = await sessionService.getActiveSessionForHavruta(testHavruta.id)
      expect(noActiveSession).toBeNull()

      // Create instant session
      const session = await sessionService.createInstantSession(testHavruta.id, testUsers[0].id)

      // Should now find the active session
      const activeSession = await sessionService.getActiveSessionForHavruta(testHavruta.id)
      expect(activeSession).toBeDefined()
      expect(activeSession?.id).toBe(session.id)
      expect(activeSession?.status).toBe('active')
    })

    it('should not find completed sessions as active', async () => {
      // Create and immediately end a session
      const session = await sessionService.createInstantSession(testHavruta.id, testUsers[0].id)
      await sessionService.endSession(session.id, testUsers[0].id, {
        endingSection: 'Genesis 2:1',
        coverageRange: 'Genesis 1:1 to Genesis 2:1'
      })

      // Should not find any active session
      const activeSession = await sessionService.getActiveSessionForHavruta(testHavruta.id)
      expect(activeSession).toBeNull()
    })

    it('should handle multiple Havrutot independently', async () => {
      // Create second Havruta
      const secondHavruta = await prisma.havruta.create({
        data: {
          name: 'Second Havruta',
          bookId: 'exodus',
          bookTitle: 'Exodus',
          ownerId: testUsers[1].id,
          lastPlace: 'Exodus 1:1',
          isActive: true
        }
      })

      await prisma.havrutaParticipant.createMany({
        data: [
          { userId: testUsers[1].id, havrutaId: secondHavruta.id },
          { userId: testUsers[2].id, havrutaId: secondHavruta.id }
        ]
      })

      // Create instant session for first Havruta
      await sessionService.createInstantSession(testHavruta.id, testUsers[0].id)

      // Should be able to create instant session for second Havruta
      const secondSession = await sessionService.createInstantSession(secondHavruta.id, testUsers[1].id)

      expect(secondSession).toBeDefined()
      expect(secondSession.havrutaId).toBe(secondHavruta.id)

      // Both should have active sessions
      const firstActive = await sessionService.getActiveSessionForHavruta(testHavruta.id)
      const secondActive = await sessionService.getActiveSessionForHavruta(secondHavruta.id)

      expect(firstActive).toBeDefined()
      expect(secondActive).toBeDefined()
      expect(firstActive?.id).not.toBe(secondActive?.id)
    })
  })
})