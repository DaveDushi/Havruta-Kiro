import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest'
import { prisma } from '../utils/database'
import { sessionService } from '../services/sessionService'
import { havrutaService } from '../services/havrutaService'
import type { User, Havruta } from '@prisma/client'

describe('SessionService', () => {
  let testUsers: User[] = []
  let testHavruta: Havruta
  let testSessionId: string

  beforeAll(async () => {
    // Clean up any existing test data
    await prisma.sessionParticipant.deleteMany({
      where: {
        user: {
          email: {
            startsWith: 'test-session-'
          }
        }
      }
    })
    await prisma.session.deleteMany({
      where: {
        havruta: {
          owner: {
            email: {
              startsWith: 'test-session-'
            }
          }
        }
      }
    })
    await prisma.progress.deleteMany({
      where: {
        user: {
          email: {
            startsWith: 'test-session-'
          }
        }
      }
    })
    await prisma.havrutaParticipant.deleteMany({
      where: {
        user: {
          email: {
            startsWith: 'test-session-'
          }
        }
      }
    })
    await prisma.havruta.deleteMany({
      where: {
        creator: {
          email: {
            startsWith: 'test-session-'
          }
        }
      }
    })
    await prisma.user.deleteMany({
      where: {
        email: {
          startsWith: 'test-session-'
        }
      }
    })
  })

  beforeEach(async () => {
    // Create test users
    const userData = [
      {
        email: 'test-session-creator@example.com',
        name: 'Test Session Creator',
        oauthProvider: 'google',
        oauthId: 'test-session-creator-oauth-id'
      },
      {
        email: 'test-session-participant1@example.com',
        name: 'Test Session Participant 1',
        oauthProvider: 'google',
        oauthId: 'test-session-participant1-oauth-id'
      },
      {
        email: 'test-session-participant2@example.com',
        name: 'Test Session Participant 2',
        oauthProvider: 'google',
        oauthId: 'test-session-participant2-oauth-id'
      }
    ]

    for (const user of userData) {
      const createdUser = await prisma.user.create({ data: user })
      testUsers.push(createdUser)
    }

    // Create test Havruta
    const havrutaData = {
      name: 'Test Session Havruta',
      bookId: 'genesis',
      bookTitle: 'Genesis',
      ownerId: testUsers[0].id,
      participantIds: [testUsers[1].id, testUsers[2].id]
    }
    testHavruta = await havrutaService.createHavruta(havrutaData)
  })

  afterEach(async () => {
    // Clean up test data
    await prisma.sessionParticipant.deleteMany({
      where: {
        user: {
          email: {
            startsWith: 'test-session-'
          }
        }
      }
    })
    await prisma.session.deleteMany({
      where: {
        havruta: {
          owner: {
            email: {
              startsWith: 'test-session-'
            }
          }
        }
      }
    })
    await prisma.progress.deleteMany({
      where: {
        user: {
          email: {
            startsWith: 'test-session-'
          }
        }
      }
    })
    await prisma.havrutaParticipant.deleteMany({
      where: {
        user: {
          email: {
            startsWith: 'test-session-'
          }
        }
      }
    })
    await prisma.havruta.deleteMany({
      where: {
        owner: {
          email: {
            startsWith: 'test-session-'
          }
        }
      }
    })
    await prisma.user.deleteMany({
      where: {
        email: {
          startsWith: 'test-session-'
        }
      }
    })
    testUsers = []
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  describe('initializeSession', () => {
    it('should initialize a new session with all Havruta participants', async () => {
      const sessionData = {
        havrutaId: testHavruta.id
      }

      const session = await sessionService.initializeSession(sessionData)
      testSessionId = session.id

      expect(session).toBeDefined()
      expect(session.havrutaId).toBe(testHavruta.id)
      expect(session.endTime).toBeNull()
      expect(session.participants).toHaveLength(3) // Creator + 2 participants
      expect(session.sectionsStudied).toEqual([])

      // Verify Havruta's total sessions was incremented
      const updatedHavruta = await prisma.havruta.findUnique({
        where: { id: testHavruta.id }
      })
      expect(updatedHavruta!.totalSessions).toBe(1)
    })

    it('should initialize session with specific participants', async () => {
      const sessionData = {
        havrutaId: testHavruta.id,
        participantIds: [testUsers[0].id, testUsers[1].id] // Only creator and one participant
      }

      const session = await sessionService.initializeSession(sessionData)

      expect(session.participants).toHaveLength(2)
      const participantIds = session.participants.map(p => p.user.id)
      expect(participantIds).toContain(testUsers[0].id)
      expect(participantIds).toContain(testUsers[1].id)
      expect(participantIds).not.toContain(testUsers[2].id)
    })

    it('should throw error if Havruta does not exist', async () => {
      const sessionData = {
        havrutaId: 'non-existent-id'
      }

      await expect(sessionService.initializeSession(sessionData)).rejects.toThrow('Havruta not found')
    })

    it('should throw error if Havruta is inactive', async () => {
      // Deactivate the Havruta
      await prisma.havruta.update({
        where: { id: testHavruta.id },
        data: { isActive: false }
      })

      const sessionData = {
        havrutaId: testHavruta.id
      }

      await expect(sessionService.initializeSession(sessionData)).rejects.toThrow('Cannot create session for inactive Havruta')
    })

    it('should throw error if there is already an active session', async () => {
      // Create first session
      const sessionData = {
        havrutaId: testHavruta.id
      }
      await sessionService.initializeSession(sessionData)

      // Try to create second session
      await expect(sessionService.initializeSession(sessionData)).rejects.toThrow('There is already an active session for this Havruta')
    })
  })

  describe('joinSession', () => {
    beforeEach(async () => {
      const sessionData = {
        havrutaId: testHavruta.id,
        participantIds: [testUsers[0].id] // Only creator initially
      }
      const session = await sessionService.initializeSession(sessionData)
      testSessionId = session.id
    })

    it('should allow Havruta participant to join session', async () => {
      const participant = testUsers[1]

      const result = await sessionService.joinSession({
        userId: participant.id,
        sessionId: testSessionId
      })

      expect(result).toBeDefined()
      expect(result.userId).toBe(participant.id)
      expect(result.sessionId).toBe(testSessionId)
      expect(result.leftAt).toBeNull()

      // Verify participant was added to session
      const session = await sessionService.getSessionById(testSessionId)
      expect(session!.participants).toHaveLength(2)
    })

    it('should allow user to rejoin after leaving', async () => {
      const participant = testUsers[1]

      // Join session
      await sessionService.joinSession({
        userId: participant.id,
        sessionId: testSessionId
      })

      // Leave session
      await sessionService.leaveSession(participant.id, testSessionId)

      // Rejoin session
      const result = await sessionService.joinSession({
        userId: participant.id,
        sessionId: testSessionId
      })

      expect(result.leftAt).toBeNull()
    })

    it('should throw error if user does not exist', async () => {
      await expect(sessionService.joinSession({
        userId: 'non-existent-id',
        sessionId: testSessionId
      })).rejects.toThrow('User not found')
    })

    it('should throw error if session does not exist', async () => {
      const participant = testUsers[1]

      await expect(sessionService.joinSession({
        userId: participant.id,
        sessionId: 'non-existent-id'
      })).rejects.toThrow('Session not found')
    })

    it('should throw error if session has ended', async () => {
      const participant = testUsers[1]

      // End the session
      await sessionService.endSession(testSessionId, testUsers[0].id)

      await expect(sessionService.joinSession({
        userId: participant.id,
        sessionId: testSessionId
      })).rejects.toThrow('Cannot join ended session')
    })

    it('should throw error if user is not a Havruta participant', async () => {
      // Create a user that's not in the Havruta
      const nonParticipant = await prisma.user.create({
        data: {
          email: 'test-session-nonparticipant@example.com',
          name: 'Non Participant',
          oauthProvider: 'google',
          oauthId: 'test-session-nonparticipant-oauth-id'
        }
      })

      await expect(sessionService.joinSession({
        userId: nonParticipant.id,
        sessionId: testSessionId
      })).rejects.toThrow('User is not a participant in this Havruta')

      // Clean up
      await prisma.user.delete({ where: { id: nonParticipant.id } })
    })

    it('should throw error if user is already in session', async () => {
      const creator = testUsers[0] // Already in session

      await expect(sessionService.joinSession({
        userId: creator.id,
        sessionId: testSessionId
      })).rejects.toThrow('User is already in this session')
    })
  })

  describe('leaveSession', () => {
    beforeEach(async () => {
      const sessionData = {
        havrutaId: testHavruta.id
      }
      const session = await sessionService.initializeSession(sessionData)
      testSessionId = session.id
    })

    it('should allow participant to leave session', async () => {
      const participant = testUsers[1]

      await sessionService.leaveSession(participant.id, testSessionId)

      // Verify participant left
      const sessionParticipant = await prisma.sessionParticipant.findUnique({
        where: {
          userId_sessionId: {
            userId: participant.id,
            sessionId: testSessionId
          }
        }
      })
      expect(sessionParticipant!.leftAt).toBeDefined()
    })

    it('should throw error if session does not exist', async () => {
      const participant = testUsers[1]

      await expect(sessionService.leaveSession(participant.id, 'non-existent-id'))
        .rejects.toThrow('Session not found')
    })

    it('should throw error if user is not in session', async () => {
      // Create a user that's not in the session
      const nonParticipant = await prisma.user.create({
        data: {
          email: 'test-session-nonparticipant@example.com',
          name: 'Non Participant',
          oauthProvider: 'google',
          oauthId: 'test-session-nonparticipant-oauth-id'
        }
      })

      await expect(sessionService.leaveSession(nonParticipant.id, testSessionId))
        .rejects.toThrow('User is not in this session')

      // Clean up
      await prisma.user.delete({ where: { id: nonParticipant.id } })
    })

    it('should throw error if user has already left', async () => {
      const participant = testUsers[1]

      // Leave session first time
      await sessionService.leaveSession(participant.id, testSessionId)

      // Try to leave again
      await expect(sessionService.leaveSession(participant.id, testSessionId))
        .rejects.toThrow('User has already left this session')
    })
  })

  describe('endSession', () => {
    beforeEach(async () => {
      const sessionData = {
        havrutaId: testHavruta.id
      }
      const session = await sessionService.initializeSession(sessionData)
      testSessionId = session.id
    })

    it('should allow creator to end session', async () => {
      const creator = testUsers[0]

      await sessionService.endSession(testSessionId, creator.id)

      // Verify session ended
      const session = await sessionService.getSessionById(testSessionId)
      expect(session!.endTime).toBeDefined()

      // Verify all participants marked as left
      const participants = await prisma.sessionParticipant.findMany({
        where: { sessionId: testSessionId }
      })
      participants.forEach(p => {
        expect(p.leftAt).toBeDefined()
      })
    })

    it('should allow participant to end session', async () => {
      const participant = testUsers[1]

      await sessionService.endSession(testSessionId, participant.id)

      const session = await sessionService.getSessionById(testSessionId)
      expect(session!.endTime).toBeDefined()
    })

    it('should throw error if session does not exist', async () => {
      const creator = testUsers[0]

      await expect(sessionService.endSession('non-existent-id', creator.id))
        .rejects.toThrow('Session not found')
    })

    it('should throw error if session has already ended', async () => {
      const creator = testUsers[0]

      // End session first time
      await sessionService.endSession(testSessionId, creator.id)

      // Try to end again
      await expect(sessionService.endSession(testSessionId, creator.id))
        .rejects.toThrow('Session has already ended')
    })

    it('should throw error if user does not have permission', async () => {
      // Create a user that's not in the Havruta
      const nonParticipant = await prisma.user.create({
        data: {
          email: 'test-session-nonparticipant@example.com',
          name: 'Non Participant',
          oauthProvider: 'google',
          oauthId: 'test-session-nonparticipant-oauth-id'
        }
      })

      await expect(sessionService.endSession(testSessionId, nonParticipant.id))
        .rejects.toThrow('User does not have permission to end this session')

      // Clean up
      await prisma.user.delete({ where: { id: nonParticipant.id } })
    })
  })

  describe('getSessionState', () => {
    beforeEach(async () => {
      const sessionData = {
        havrutaId: testHavruta.id
      }
      const session = await sessionService.initializeSession(sessionData)
      testSessionId = session.id
    })

    it('should return session state', async () => {
      const state = await sessionService.getSessionState(testSessionId)

      expect(state).toBeDefined()
      expect(state!.id).toBe(testSessionId)
      expect(state!.havrutaId).toBe(testHavruta.id)
      expect(state!.isActive).toBe(true)
      expect(state!.activeParticipants).toHaveLength(3)
      expect(state!.sectionsStudied).toEqual([])
    })

    it('should return null for non-existent session', async () => {
      const state = await sessionService.getSessionState('non-existent-id')
      expect(state).toBeNull()
    })

    it('should only include active participants', async () => {
      const participant = testUsers[1]

      // Leave session
      await sessionService.leaveSession(participant.id, testSessionId)

      const state = await sessionService.getSessionState(testSessionId)
      expect(state!.activeParticipants).toHaveLength(2) // Excluding the one who left

      const activeUserIds = state!.activeParticipants.map(p => p.userId)
      expect(activeUserIds).not.toContain(participant.id)
    })
  })

  describe('updateSessionProgress', () => {
    beforeEach(async () => {
      const sessionData = {
        havrutaId: testHavruta.id
      }
      const session = await sessionService.initializeSession(sessionData)
      testSessionId = session.id
    })

    it('should update session progress', async () => {
      const participant = testUsers[0]
      const sectionsStudied = ['Genesis 1:1', 'Genesis 1:2', 'Genesis 1:3']

      await sessionService.updateSessionProgress(testSessionId, sectionsStudied, participant.id)

      const session = await sessionService.getSessionById(testSessionId)
      expect(session!.sectionsStudied).toEqual(sectionsStudied)
    })

    it('should throw error if user is not in session', async () => {
      // Create a user that's not in the session
      const nonParticipant = await prisma.user.create({
        data: {
          email: 'test-session-nonparticipant@example.com',
          name: 'Non Participant',
          oauthProvider: 'google',
          oauthId: 'test-session-nonparticipant-oauth-id'
        }
      })

      const sectionsStudied = ['Genesis 1:1']

      await expect(sessionService.updateSessionProgress(testSessionId, sectionsStudied, nonParticipant.id))
        .rejects.toThrow('User is not in this session')

      // Clean up
      await prisma.user.delete({ where: { id: nonParticipant.id } })
    })
  })

  describe('trackUserProgress', () => {
    beforeEach(async () => {
      const sessionData = {
        havrutaId: testHavruta.id
      }
      const session = await sessionService.initializeSession(sessionData)
      testSessionId = session.id
    })

    it('should track user progress and update Havruta', async () => {
      const participant = testUsers[0]
      const progressData = {
        sectionsStudied: ['Genesis 1:1', 'Genesis 1:2'],
        currentSection: 'Genesis 1:2',
        timeStudied: 30 // 30 minutes
      }

      await sessionService.trackUserProgress(testSessionId, participant.id, progressData)

      // Verify user progress was created/updated
      const progress = await prisma.progress.findUnique({
        where: {
          userId_havrutaId: {
            userId: participant.id,
            havrutaId: testHavruta.id
          }
        }
      })
      expect(progress).toBeDefined()
      expect(progress!.sectionsCompleted).toEqual(progressData.sectionsStudied)
      expect(progress!.lastSection).toBe(progressData.currentSection)
      expect(progress!.totalTimeStudied).toBe(progressData.timeStudied)

      // Verify Havruta current section was updated
      const updatedHavruta = await prisma.havruta.findUnique({
        where: { id: testHavruta.id }
      })
      expect(updatedHavruta!.currentSection).toBe(progressData.currentSection)
    })

    it('should increment time studied on subsequent updates', async () => {
      const participant = testUsers[0]

      // First update
      await sessionService.trackUserProgress(testSessionId, participant.id, {
        timeStudied: 30
      })

      // Second update
      await sessionService.trackUserProgress(testSessionId, participant.id, {
        timeStudied: 20
      })

      const progress = await prisma.progress.findUnique({
        where: {
          userId_havrutaId: {
            userId: participant.id,
            havrutaId: testHavruta.id
          }
        }
      })
      expect(progress!.totalTimeStudied).toBe(50) // 30 + 20
    })

    it('should throw error if user is not in session', async () => {
      // Create a user that's not in the session
      const nonParticipant = await prisma.user.create({
        data: {
          email: 'test-session-nonparticipant@example.com',
          name: 'Non Participant',
          oauthProvider: 'google',
          oauthId: 'test-session-nonparticipant-oauth-id'
        }
      })

      await expect(sessionService.trackUserProgress(testSessionId, nonParticipant.id, {
        currentSection: 'Genesis 1:1'
      })).rejects.toThrow('User is not in this session')

      // Clean up
      await prisma.user.delete({ where: { id: nonParticipant.id } })
    })
  })

  describe('getActiveSessionForHavruta', () => {
    it('should return active session for Havruta', async () => {
      const sessionData = {
        havrutaId: testHavruta.id
      }
      const createdSession = await sessionService.initializeSession(sessionData)

      const activeSession = await sessionService.getActiveSessionForHavruta(testHavruta.id)

      expect(activeSession).toBeDefined()
      expect(activeSession!.id).toBe(createdSession.id)
      expect(activeSession!.endTime).toBeNull()
    })

    it('should return null if no active session exists', async () => {
      const activeSession = await sessionService.getActiveSessionForHavruta(testHavruta.id)
      expect(activeSession).toBeNull()
    })

    it('should return null if session has ended', async () => {
      const sessionData = {
        havrutaId: testHavruta.id
      }
      const session = await sessionService.initializeSession(sessionData)

      // End the session
      await sessionService.endSession(session.id, testUsers[0].id)

      const activeSession = await sessionService.getActiveSessionForHavruta(testHavruta.id)
      expect(activeSession).toBeNull()
    })
  })

  describe('getUserActiveSessions', () => {
    it('should return user\'s active sessions', async () => {
      const user = testUsers[0]

      // Create session
      const sessionData = {
        havrutaId: testHavruta.id
      }
      await sessionService.initializeSession(sessionData)

      const activeSessions = await sessionService.getUserActiveSessions(user.id)

      expect(activeSessions).toHaveLength(1)
      expect(activeSessions[0].havrutaId).toBe(testHavruta.id)
      expect(activeSessions[0].endTime).toBeNull()
    })

    it('should not return sessions user has left', async () => {
      const user = testUsers[1]

      // Create session
      const sessionData = {
        havrutaId: testHavruta.id
      }
      const session = await sessionService.initializeSession(sessionData)

      // User leaves session
      await sessionService.leaveSession(user.id, session.id)

      const activeSessions = await sessionService.getUserActiveSessions(user.id)
      expect(activeSessions).toHaveLength(0)
    })

    it('should not return ended sessions', async () => {
      const user = testUsers[0]

      // Create and end session
      const sessionData = {
        havrutaId: testHavruta.id
      }
      const session = await sessionService.initializeSession(sessionData)
      await sessionService.endSession(session.id, user.id)

      const activeSessions = await sessionService.getUserActiveSessions(user.id)
      expect(activeSessions).toHaveLength(0)
    })
  })

  describe('cleanupInactiveSessions', () => {
    it('should cleanup sessions older than specified hours', async () => {
      // Create session with old start time
      const oldStartTime = new Date()
      oldStartTime.setHours(oldStartTime.getHours() - 25) // 25 hours ago

      const sessionData = {
        havrutaId: testHavruta.id,
        startTime: oldStartTime
      }
      const session = await sessionService.initializeSession(sessionData)

      const cleanedCount = await sessionService.cleanupInactiveSessions(24)

      expect(cleanedCount).toBe(1)

      // Verify session was ended
      const updatedSession = await sessionService.getSessionById(session.id)
      expect(updatedSession!.endTime).toBeDefined()
    })

    it('should not cleanup recent sessions', async () => {
      // Create recent session
      const sessionData = {
        havrutaId: testHavruta.id
      }
      await sessionService.initializeSession(sessionData)

      const cleanedCount = await sessionService.cleanupInactiveSessions(24)

      expect(cleanedCount).toBe(0)
    })
  })

  describe('hasSessionAccess', () => {
    beforeEach(async () => {
      const sessionData = {
        havrutaId: testHavruta.id
      }
      const session = await sessionService.initializeSession(sessionData)
      testSessionId = session.id
    })

    it('should return true for session participants', async () => {
      const participant = testUsers[0]

      const hasAccess = await sessionService.hasSessionAccess(testSessionId, participant.id)
      expect(hasAccess).toBe(true)
    })

    it('should return false for non-participants', async () => {
      // Create a user that's not in the session
      const nonParticipant = await prisma.user.create({
        data: {
          email: 'test-session-nonparticipant@example.com',
          name: 'Non Participant',
          oauthProvider: 'google',
          oauthId: 'test-session-nonparticipant-oauth-id'
        }
      })

      const hasAccess = await sessionService.hasSessionAccess(testSessionId, nonParticipant.id)
      expect(hasAccess).toBe(false)

      // Clean up
      await prisma.user.delete({ where: { id: nonParticipant.id } })
    })
  })
})