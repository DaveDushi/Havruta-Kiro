import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest'
import { Server } from 'socket.io'
import { createServer } from 'http'
import { WebSocketRoomService, AuthenticatedSocket } from '../services/websocketRoomService'
import { redisClient } from '../utils/redis'
import { prisma } from '../utils/database'

// Mock Redis client
vi.mock('../utils/redis', () => ({
  redisClient: {
    connect: vi.fn(),
    disconnect: vi.fn(),
    addToRoom: vi.fn(),
    removeFromRoom: vi.fn(),
    getRoomParticipants: vi.fn(),
    getRoomParticipantCount: vi.fn(),
    setRoomState: vi.fn(),
    getRoomState: vi.fn(),
    deleteRoom: vi.fn(),
    getActiveRooms: vi.fn(),
    cleanupEmptyRooms: vi.fn()
  }
}))

// Mock Prisma
vi.mock('../utils/database', () => ({
  prisma: {
    session: {
      findUnique: vi.fn()
    },
    sessionParticipant: {
      findUnique: vi.fn()
    }
  }
}))

// Mock logger
vi.mock('../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  }
}))

describe('WebSocketRoomService', () => {
  let roomService: WebSocketRoomService
  let io: Server
  let httpServer: any
  let mockSocket: AuthenticatedSocket

  beforeAll(async () => {
    httpServer = createServer()
    io = new Server(httpServer)
    roomService = new WebSocketRoomService(io)
  })

  afterAll(async () => {
    await roomService.shutdown()
    httpServer.close()
  })

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks()

    // Create mock socket
    mockSocket = {
      id: 'socket-123',
      user: {
        id: 'user-123',
        name: 'Test User',
        email: 'test@example.com',
        createdAt: new Date(),
        updatedAt: new Date(),
        profilePicture: null,
        lastActiveAt: new Date(),
        isActive: true
      },
      join: vi.fn(),
      leave: vi.fn(),
      to: vi.fn(() => ({
        emit: vi.fn()
      })),
      emit: vi.fn()
    } as any
  })

  describe('initialize', () => {
    it('should connect to Redis successfully', async () => {
      vi.mocked(redisClient.connect).mockResolvedValue(undefined)

      await roomService.initialize()

      expect(redisClient.connect).toHaveBeenCalledOnce()
    })

    it('should throw error if Redis connection fails', async () => {
      const error = new Error('Redis connection failed')
      vi.mocked(redisClient.connect).mockRejectedValue(error)

      await expect(roomService.initialize()).rejects.toThrow('Redis connection failed')
    })
  })

  describe('joinRoom', () => {
    const sessionId = 'session-123'
    const havrutaId = 'havruta-123'

    beforeEach(() => {
      // Mock session participant verification
      vi.mocked(prisma.sessionParticipant.findUnique).mockResolvedValue({
        id: 'participant-123',
        userId: 'user-123',
        sessionId,
        joinedAt: new Date(),
        leftAt: null
      })

      // Mock session data
      vi.mocked(prisma.session.findUnique).mockResolvedValue({
        id: sessionId,
        havrutaId,
        type: 'instant',
        status: 'active',
        startTime: new Date(),
        endTime: null,
        startingSection: 'Genesis 1:1',
        endingSection: null,
        coverageRange: null,
        sectionsStudied: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        havruta: {
          id: havrutaId,
          name: 'Test Havruta',
          lastPlace: 'Genesis 1:1'
        }
      } as any)
    })

    it('should successfully join a room', async () => {
      vi.mocked(redisClient.addToRoom).mockResolvedValue(undefined)
      vi.mocked(redisClient.getRoomState).mockResolvedValue(null)
      vi.mocked(redisClient.setRoomState).mockResolvedValue(undefined)
      vi.mocked(redisClient.getRoomParticipantCount).mockResolvedValue(1)
      vi.mocked(redisClient.getRoomParticipants).mockResolvedValue({
        'user-123': {
          userId: 'user-123',
          userName: 'Test User',
          socketId: 'socket-123',
          joinedAt: new Date().toISOString()
        }
      })

      const result = await roomService.joinRoom(mockSocket, sessionId)

      expect(result.success).toBe(true)
      expect(result.roomState).toBeDefined()
      expect(result.participants).toBeDefined()
      expect(mockSocket.join).toHaveBeenCalledWith(sessionId)
      expect(redisClient.addToRoom).toHaveBeenCalledWith(
        sessionId,
        'user-123',
        expect.objectContaining({
          userId: 'user-123',
          userName: 'Test User',
          socketId: 'socket-123'
        })
      )
    })

    it('should fail if user is not authenticated', async () => {
      mockSocket.user = undefined

      const result = await roomService.joinRoom(mockSocket, sessionId)

      expect(result.success).toBe(false)
      expect(result.error).toBe('User not authenticated')
    })

    it('should fail if user does not have session access', async () => {
      vi.mocked(prisma.sessionParticipant.findUnique).mockResolvedValue(null)

      const result = await roomService.joinRoom(mockSocket, sessionId)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Session not found or access denied')
    })

    it('should fail if session does not exist', async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue(null)

      const result = await roomService.joinRoom(mockSocket, sessionId)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Session not found')
    })

    it('should update existing room state when joining', async () => {
      const existingRoomState = {
        sessionId,
        havrutaId,
        currentSection: 'Genesis 1:2',
        participantCount: 1,
        lastActivity: new Date(),
        createdAt: new Date()
      }

      vi.mocked(redisClient.addToRoom).mockResolvedValue(undefined)
      vi.mocked(redisClient.getRoomState).mockResolvedValue(existingRoomState)
      vi.mocked(redisClient.setRoomState).mockResolvedValue(undefined)
      vi.mocked(redisClient.getRoomParticipantCount).mockResolvedValue(2)
      vi.mocked(redisClient.getRoomParticipants).mockResolvedValue({})

      const result = await roomService.joinRoom(mockSocket, sessionId)

      expect(result.success).toBe(true)
      expect(result.roomState?.participantCount).toBe(2)
      expect(redisClient.setRoomState).toHaveBeenCalledWith(
        sessionId,
        expect.objectContaining({
          participantCount: 2
        })
      )
    })
  })

  describe('leaveRoom', () => {
    const sessionId = 'session-123'

    it('should successfully leave a room', async () => {
      vi.mocked(redisClient.removeFromRoom).mockResolvedValue(undefined)
      vi.mocked(redisClient.getRoomParticipantCount).mockResolvedValue(1)
      vi.mocked(redisClient.getRoomState).mockResolvedValue({
        sessionId,
        havrutaId: 'havruta-123',
        participantCount: 2,
        lastActivity: new Date(),
        createdAt: new Date()
      })
      vi.mocked(redisClient.setRoomState).mockResolvedValue(undefined)

      const result = await roomService.leaveRoom(mockSocket, sessionId)

      expect(result.success).toBe(true)
      expect(result.participantCount).toBe(1)
      expect(result.roomDeleted).toBe(false)
      expect(mockSocket.leave).toHaveBeenCalledWith(sessionId)
      expect(redisClient.removeFromRoom).toHaveBeenCalledWith(sessionId, 'user-123')
    })

    it('should delete room when last participant leaves', async () => {
      vi.mocked(redisClient.removeFromRoom).mockResolvedValue(undefined)
      vi.mocked(redisClient.getRoomParticipantCount).mockResolvedValue(0)
      vi.mocked(redisClient.deleteRoom).mockResolvedValue(undefined)

      const result = await roomService.leaveRoom(mockSocket, sessionId)

      expect(result.success).toBe(true)
      expect(result.participantCount).toBe(0)
      expect(result.roomDeleted).toBe(true)
      expect(redisClient.deleteRoom).toHaveBeenCalledWith(sessionId)
    })

    it('should fail if user is not authenticated', async () => {
      mockSocket.user = undefined

      const result = await roomService.leaveRoom(mockSocket, sessionId)

      expect(result.success).toBe(false)
      expect(result.error).toBe('User not authenticated')
    })
  })

  describe('handleDisconnect', () => {
    it('should remove user from all rooms on disconnect', async () => {
      const roomIds = ['session-1', 'session-2']
      const participants = {
        'user-123': {
          userId: 'user-123',
          userName: 'Test User',
          socketId: 'socket-123',
          joinedAt: new Date().toISOString()
        }
      }

      vi.mocked(redisClient.getActiveRooms).mockResolvedValue(roomIds)
      vi.mocked(redisClient.getRoomParticipants).mockResolvedValue(participants)
      vi.mocked(redisClient.removeFromRoom).mockResolvedValue(undefined)
      vi.mocked(redisClient.getRoomParticipantCount).mockResolvedValue(0)
      vi.mocked(redisClient.deleteRoom).mockResolvedValue(undefined)

      await roomService.handleDisconnect(mockSocket)

      expect(redisClient.getActiveRooms).toHaveBeenCalledOnce()
      expect(redisClient.getRoomParticipants).toHaveBeenCalledTimes(2)
      expect(redisClient.removeFromRoom).toHaveBeenCalledTimes(2)
    })

    it('should handle disconnect gracefully when user not in any rooms', async () => {
      vi.mocked(redisClient.getActiveRooms).mockResolvedValue([])

      await roomService.handleDisconnect(mockSocket)

      expect(redisClient.getActiveRooms).toHaveBeenCalledOnce()
      expect(redisClient.removeFromRoom).not.toHaveBeenCalled()
    })
  })

  describe('getRoomParticipants', () => {
    it('should return formatted participants list', async () => {
      const sessionId = 'session-123'
      const mockParticipants = {
        'user-1': {
          userId: 'user-1',
          userName: 'User One',
          socketId: 'socket-1',
          joinedAt: new Date().toISOString()
        },
        'user-2': {
          userId: 'user-2',
          userName: 'User Two',
          socketId: 'socket-2',
          joinedAt: new Date().toISOString()
        }
      }

      vi.mocked(redisClient.getRoomParticipants).mockResolvedValue(mockParticipants)

      const participants = await roomService.getRoomParticipants(sessionId)

      expect(participants).toHaveLength(2)
      expect(participants[0]).toMatchObject({
        userId: 'user-1',
        userName: 'User One',
        socketId: 'socket-1'
      })
      expect(participants[0].joinedAt).toBeInstanceOf(Date)
    })
  })

  describe('updateRoomSection', () => {
    it('should update room section and broadcast to participants', async () => {
      const sessionId = 'session-123'
      const section = 'Genesis 2:1'
      const userId = 'user-123'
      const roomState = {
        sessionId,
        havrutaId: 'havruta-123',
        currentSection: 'Genesis 1:1',
        participantCount: 2,
        lastActivity: new Date(),
        createdAt: new Date()
      }

      vi.mocked(redisClient.getRoomState).mockResolvedValue(roomState)
      vi.mocked(redisClient.setRoomState).mockResolvedValue(undefined)

      const ioToSpy = vi.fn(() => ({
        emit: vi.fn()
      }))
      io.to = ioToSpy

      await roomService.updateRoomSection(sessionId, section, userId)

      expect(redisClient.setRoomState).toHaveBeenCalledWith(
        sessionId,
        expect.objectContaining({
          currentSection: section
        })
      )
      expect(ioToSpy).toHaveBeenCalledWith(sessionId)
    })

    it('should handle non-existent room gracefully', async () => {
      vi.mocked(redisClient.getRoomState).mockResolvedValue(null)

      await roomService.updateRoomSection('non-existent', 'Genesis 1:1', 'user-123')

      expect(redisClient.setRoomState).not.toHaveBeenCalled()
    })
  })

  describe('cleanupInactiveRooms', () => {
    it('should clean up empty and inactive rooms', async () => {
      const activeRooms = ['room-1', 'room-2', 'room-3']
      const oldDate = new Date(Date.now() - 2 * 60 * 60 * 1000) // 2 hours ago

      vi.mocked(redisClient.getActiveRooms).mockResolvedValue(activeRooms)
      
      // Mock room states and participant counts
      vi.mocked(redisClient.getRoomState)
        .mockResolvedValueOnce(null) // room-1: no state
        .mockResolvedValueOnce({ // room-2: inactive
          sessionId: 'room-2',
          lastActivity: oldDate,
          participantCount: 1
        })
        .mockResolvedValueOnce({ // room-3: active
          sessionId: 'room-3',
          lastActivity: new Date(),
          participantCount: 2
        })

      vi.mocked(redisClient.getRoomParticipantCount)
        .mockResolvedValueOnce(0) // room-2: empty
        .mockResolvedValueOnce(2) // room-3: has participants

      vi.mocked(redisClient.deleteRoom).mockResolvedValue(undefined)

      const cleanedCount = await roomService.cleanupInactiveRooms()

      expect(cleanedCount).toBe(2) // room-1 (no state) + room-2 (inactive)
      expect(redisClient.deleteRoom).toHaveBeenCalledTimes(2)
      expect(redisClient.deleteRoom).toHaveBeenCalledWith('room-1')
      expect(redisClient.deleteRoom).toHaveBeenCalledWith('room-2')
    })

    it('should handle cleanup errors gracefully', async () => {
      vi.mocked(redisClient.getActiveRooms).mockRejectedValue(new Error('Redis error'))

      const cleanedCount = await roomService.cleanupInactiveRooms()

      expect(cleanedCount).toBe(0)
    })
  })

  describe('getRoomStatistics', () => {
    it('should return correct room statistics', async () => {
      const activeRooms = ['room-1', 'room-2', 'room-3']
      
      vi.mocked(redisClient.getActiveRooms).mockResolvedValue(activeRooms)
      vi.mocked(redisClient.getRoomParticipantCount)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(1)

      const stats = await roomService.getRoomStatistics()

      expect(stats).toEqual({
        totalRooms: 3,
        totalParticipants: 6,
        averageParticipantsPerRoom: 2
      })
    })

    it('should handle empty rooms', async () => {
      vi.mocked(redisClient.getActiveRooms).mockResolvedValue([])

      const stats = await roomService.getRoomStatistics()

      expect(stats).toEqual({
        totalRooms: 0,
        totalParticipants: 0,
        averageParticipantsPerRoom: 0
      })
    })
  })
})