import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { notificationService } from '../services/notificationService'
import { prisma } from '../utils/database'
import { User, Havruta, Session } from '@prisma/client'

// Mock WebSocket service
const mockWebSocketService = {
  broadcastToUser: vi.fn(),
  broadcastToRoom: vi.fn()
}

describe('Instant Session Notifications', () => {
  let testUsers: User[]
  let testHavruta: Havruta
  let testSession: Session

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks()
    
    // Set up mock WebSocket service
    notificationService.setWebSocketService(mockWebSocketService)

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

    // Create test Havruta
    testHavruta = await prisma.havruta.create({
      data: {
        name: 'Test Havruta for Notifications',
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

    // Create test session
    testSession = await prisma.session.create({
      data: {
        havrutaId: testHavruta.id,
        type: 'instant',
        status: 'active',
        startTime: new Date(),
        startingSection: 'Genesis 1:1'
      }
    })

    // Add participants to session
    await prisma.sessionParticipant.createMany({
      data: [
        { userId: testUsers[0].id, sessionId: testSession.id },
        { userId: testUsers[1].id, sessionId: testSession.id },
        { userId: testUsers[2].id, sessionId: testSession.id }
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

  describe('sendInstantSessionInvitations', () => {
    it('should send notifications to all participants except creator', async () => {
      await notificationService.sendInstantSessionInvitations(testSession.id, testUsers[0].id)

      // Should call broadcastToUser for each participant except creator
      expect(mockWebSocketService.broadcastToUser).toHaveBeenCalledTimes(2)
      
      // Check first participant notification
      expect(mockWebSocketService.broadcastToUser).toHaveBeenCalledWith(
        testUsers[1].id,
        'instant-session-invitation',
        expect.objectContaining({
          sessionId: testSession.id,
          havrutaId: testHavruta.id,
          havrutaName: testHavruta.name,
          creatorName: testUsers[0].name,
          message: expect.stringContaining('started an instant session'),
          joinUrl: `/sessions/${testSession.id}/join`,
          timestamp: expect.any(String)
        })
      )

      // Check second participant notification
      expect(mockWebSocketService.broadcastToUser).toHaveBeenCalledWith(
        testUsers[2].id,
        'instant-session-invitation',
        expect.objectContaining({
          sessionId: testSession.id,
          havrutaId: testHavruta.id,
          havrutaName: testHavruta.name,
          creatorName: testUsers[0].name,
          message: expect.stringContaining('started an instant session'),
          joinUrl: `/sessions/${testSession.id}/join`,
          timestamp: expect.any(String)
        })
      )
    })

    it('should not send notification to the creator', async () => {
      await notificationService.sendInstantSessionInvitations(testSession.id, testUsers[0].id)

      // Verify creator (testUsers[0]) is not in any of the calls
      const calls = mockWebSocketService.broadcastToUser.mock.calls
      const creatorCalls = calls.filter(call => call[0] === testUsers[0].id)
      
      expect(creatorCalls).toHaveLength(0)
    })

    it('should include correct metadata in notifications', async () => {
      await notificationService.sendInstantSessionInvitations(testSession.id, testUsers[0].id)

      const firstCall = mockWebSocketService.broadcastToUser.mock.calls[0]
      const notificationData = firstCall[2]

      expect(notificationData).toMatchObject({
        sessionId: testSession.id,
        havrutaId: testHavruta.id,
        havrutaName: testHavruta.name,
        creatorName: testUsers[0].name,
        joinUrl: `/sessions/${testSession.id}/join`
      })

      expect(notificationData.message).toContain(testUsers[0].name)
      expect(notificationData.message).toContain(testHavruta.name)
      expect(notificationData.message).toContain('instant session')
    })

    it('should handle session not found error', async () => {
      await expect(
        notificationService.sendInstantSessionInvitations('non-existent-session', testUsers[0].id)
      ).rejects.toThrow('Session not found')

      expect(mockWebSocketService.broadcastToUser).not.toHaveBeenCalled()
    })

    it('should handle Havruta with no other participants', async () => {
      // Create a Havruta with only the owner
      const soloHavruta = await prisma.havruta.create({
        data: {
          name: 'Solo Havruta',
          bookId: 'exodus',
          bookTitle: 'Exodus',
          ownerId: testUsers[0].id,
          lastPlace: 'Exodus 1:1',
          isActive: true
        }
      })

      await prisma.havrutaParticipant.create({
        data: { userId: testUsers[0].id, havrutaId: soloHavruta.id }
      })

      const soloSession = await prisma.session.create({
        data: {
          havrutaId: soloHavruta.id,
          type: 'instant',
          status: 'active',
          startTime: new Date(),
          startingSection: 'Exodus 1:1'
        }
      })

      await prisma.sessionParticipant.create({
        data: { userId: testUsers[0].id, sessionId: soloSession.id }
      })

      // Should not throw error and should not send any notifications
      await expect(
        notificationService.sendInstantSessionInvitations(soloSession.id, testUsers[0].id)
      ).resolves.not.toThrow()

      expect(mockWebSocketService.broadcastToUser).not.toHaveBeenCalled()
    })

    it('should work without WebSocket service configured', async () => {
      // Remove WebSocket service
      notificationService.setWebSocketService(null)

      // Should not throw error even without WebSocket service
      await expect(
        notificationService.sendInstantSessionInvitations(testSession.id, testUsers[0].id)
      ).resolves.not.toThrow()
    })

    it('should handle WebSocket service errors gracefully', async () => {
      // Mock WebSocket service to throw error
      mockWebSocketService.broadcastToUser.mockImplementation(() => {
        throw new Error('WebSocket error')
      })

      // Should not throw error even if WebSocket fails
      await expect(
        notificationService.sendInstantSessionInvitations(testSession.id, testUsers[0].id)
      ).resolves.toBeUndefined()
    })

    it('should generate unique timestamps for each notification', async () => {
      // Reset mock to ensure clean state
      mockWebSocketService.broadcastToUser.mockClear()
      
      await notificationService.sendInstantSessionInvitations(testSession.id, testUsers[0].id)

      const calls = mockWebSocketService.broadcastToUser.mock.calls
      expect(calls).toHaveLength(2)

      const timestamp1 = calls[0][2].timestamp
      const timestamp2 = calls[1][2].timestamp

      expect(timestamp1).toBeDefined()
      expect(timestamp2).toBeDefined()
      expect(new Date(timestamp1)).toBeInstanceOf(Date)
      expect(new Date(timestamp2)).toBeInstanceOf(Date)
    })

    it('should use correct event name for WebSocket broadcast', async () => {
      // Reset mock to ensure clean state
      mockWebSocketService.broadcastToUser.mockClear()
      
      await notificationService.sendInstantSessionInvitations(testSession.id, testUsers[0].id)

      const calls = mockWebSocketService.broadcastToUser.mock.calls
      
      calls.forEach(call => {
        expect(call[1]).toBe('instant-session-invitation')
      })
    })

    it('should include join URL in correct format', async () => {
      // Reset mock to ensure clean state
      mockWebSocketService.broadcastToUser.mockClear()
      
      await notificationService.sendInstantSessionInvitations(testSession.id, testUsers[0].id)

      const calls = mockWebSocketService.broadcastToUser.mock.calls
      
      calls.forEach(call => {
        const notificationData = call[2]
        expect(notificationData.joinUrl).toBe(`/sessions/${testSession.id}/join`)
      })
    })
  })

  describe('Notification Message Format', () => {
    it('should create user-friendly notification messages', async () => {
      // Reset mock to ensure clean state
      mockWebSocketService.broadcastToUser.mockClear()
      
      await notificationService.sendInstantSessionInvitations(testSession.id, testUsers[0].id)

      const calls = mockWebSocketService.broadcastToUser.mock.calls
      const message = calls[0][2].message

      expect(message).toContain(testUsers[0].name) // Creator name
      expect(message).toContain(testHavruta.name) // Havruta name
      expect(message).toContain('instant session') // Session type
      expect(message).toMatch(/started.*instant session.*for/) // Proper grammar
    })

    it('should handle special characters in names', async () => {
      // Reset mock to ensure clean state
      mockWebSocketService.broadcastToUser.mockClear()
      
      // Update user and Havruta names with special characters
      await prisma.user.update({
        where: { id: testUsers[0].id },
        data: { name: "O'Connor & Smith" }
      })

      await prisma.havruta.update({
        where: { id: testHavruta.id },
        data: { name: "Torah & Talmud Study" }
      })

      await notificationService.sendInstantSessionInvitations(testSession.id, testUsers[0].id)

      const calls = mockWebSocketService.broadcastToUser.mock.calls
      const message = calls[0][2].message

      expect(message).toContain("O'Connor & Smith")
      expect(message).toContain("Torah & Talmud Study")
    })
  })
})