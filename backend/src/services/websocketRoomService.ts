import { Server, Socket } from 'socket.io'
import { User } from '@prisma/client'
import { redisClient } from '../utils/redis'
import { logger } from '../utils/logger'
import { prisma } from '../utils/database'

export interface AuthenticatedSocket extends Socket {
  user?: User
}

export interface RoomParticipant {
  userId: string
  userName: string
  socketId: string
  joinedAt: Date
}

export interface SessionRoomState {
  sessionId: string
  havrutaId: string
  currentSection?: string
  participantCount: number
  lastActivity: Date
  createdAt: Date
}

export interface JoinRoomResult {
  success: boolean
  roomState?: SessionRoomState
  participants?: RoomParticipant[]
  error?: string
}

export interface LeaveRoomResult {
  success: boolean
  participantCount: number
  roomDeleted: boolean
  error?: string
}

export class WebSocketRoomService {
  private io: Server
  private roomCleanupInterval: NodeJS.Timeout | null = null
  private readonly ROOM_TIMEOUT_MINUTES = 60
  private readonly CLEANUP_INTERVAL_MINUTES = 30

  constructor(io: Server) {
    this.io = io
    this.startRoomCleanup()
  }

  /**
   * Initialize Redis connection
   */
  async initialize(): Promise<void> {
    try {
      await redisClient.connect()
      logger.info('WebSocketRoomService initialized with Redis')
    } catch (error) {
      logger.error('Failed to initialize WebSocketRoomService:', error)
      throw error
    }
  }

  /**
   * Join a session room
   */
  async joinRoom(socket: AuthenticatedSocket, sessionId: string): Promise<JoinRoomResult> {
    try {
      if (!socket.user) {
        return { success: false, error: 'User not authenticated' }
      }

      // Verify user has access to this session
      const hasAccess = await this.verifySessionAccess(sessionId, socket.user.id)
      if (!hasAccess) {
        return { success: false, error: 'Session not found or access denied' }
      }

      // Get session details
      const session = await prisma.session.findUnique({
        where: { id: sessionId },
        include: {
          havruta: {
            select: {
              id: true,
              name: true,
              lastPlace: true
            }
          }
        }
      })

      if (!session) {
        return { success: false, error: 'Session not found' }
      }

      // Join the socket room
      await socket.join(sessionId)

      // Add participant to Redis room
      const participantData = {
        userId: socket.user.id,
        userName: socket.user.name,
        socketId: socket.id
      }

      await redisClient.addToRoom(sessionId, socket.user.id, participantData)

      // Get or create room state
      let roomState = await redisClient.getRoomState(sessionId)
      if (!roomState) {
        roomState = {
          sessionId,
          havrutaId: session.havrutaId,
          currentSection: session.havruta.lastPlace,
          participantCount: 1,
          lastActivity: new Date(),
          createdAt: new Date()
        }
      } else {
        roomState.lastActivity = new Date()
        roomState.participantCount = await redisClient.getRoomParticipantCount(sessionId)
      }

      await redisClient.setRoomState(sessionId, roomState)

      // Get all participants
      const participants = await this.getRoomParticipants(sessionId)

      // Notify other participants about the new joiner
      socket.to(sessionId).emit('participant-joined', {
        userId: socket.user.id,
        userName: socket.user.name,
        participantCount: roomState.participantCount,
        timestamp: new Date().toISOString()
      })

      logger.info(`User ${socket.user.name} joined session room ${sessionId}`)

      return {
        success: true,
        roomState,
        participants
      }
    } catch (error) {
      logger.error('Error joining room:', error)
      return { success: false, error: 'Failed to join room' }
    }
  }

  /**
   * Leave a session room
   */
  async leaveRoom(socket: AuthenticatedSocket, sessionId: string): Promise<LeaveRoomResult> {
    try {
      if (!socket.user) {
        return { success: false, participantCount: 0, roomDeleted: false, error: 'User not authenticated' }
      }

      // Leave the socket room
      await socket.leave(sessionId)

      // Remove participant from Redis room
      await redisClient.removeFromRoom(sessionId, socket.user.id)

      // Get updated participant count
      const participantCount = await redisClient.getRoomParticipantCount(sessionId)

      // Update room state or delete if empty
      let roomDeleted = false
      if (participantCount === 0) {
        await redisClient.deleteRoom(sessionId)
        roomDeleted = true
        logger.info(`Empty session room ${sessionId} deleted`)
      } else {
        // Update room state with new participant count
        const roomState = await redisClient.getRoomState(sessionId)
        if (roomState) {
          roomState.participantCount = participantCount
          roomState.lastActivity = new Date()
          await redisClient.setRoomState(sessionId, roomState)
        }
      }

      // Notify other participants about the leave
      socket.to(sessionId).emit('participant-left', {
        userId: socket.user.id,
        userName: socket.user.name,
        participantCount,
        timestamp: new Date().toISOString()
      })

      logger.info(`User ${socket.user.name} left session room ${sessionId}`)

      return {
        success: true,
        participantCount,
        roomDeleted
      }
    } catch (error) {
      logger.error('Error leaving room:', error)
      return { success: false, participantCount: 0, roomDeleted: false, error: 'Failed to leave room' }
    }
  }

  /**
   * Handle socket disconnection - remove from all rooms
   */
  async handleDisconnect(socket: AuthenticatedSocket): Promise<void> {
    try {
      if (!socket.user) return

      logger.info(`User ${socket.user.name} disconnected: ${socket.id}`)

      // Get all active rooms to find which ones this user was in
      const activeRooms = await redisClient.getActiveRooms()
      
      for (const roomId of activeRooms) {
        const participants = await redisClient.getRoomParticipants(roomId)
        
        // Check if user was in this room
        if (participants[socket.user.id]) {
          const participant = participants[socket.user.id]
          
          // Only remove if this was the same socket
          if (participant.socketId === socket.id) {
            await this.leaveRoom(socket, roomId)
          }
        }
      }
    } catch (error) {
      logger.error('Error handling disconnect:', error)
    }
  }

  /**
   * Get room participants
   */
  async getRoomParticipants(sessionId: string): Promise<RoomParticipant[]> {
    try {
      const participants = await redisClient.getRoomParticipants(sessionId)
      
      return Object.values(participants).map(p => ({
        userId: p.userId,
        userName: p.userName,
        socketId: p.socketId,
        joinedAt: new Date(p.joinedAt)
      }))
    } catch (error) {
      logger.error('Error getting room participants:', error)
      return []
    }
  }

  /**
   * Get room state
   */
  async getRoomState(sessionId: string): Promise<SessionRoomState | null> {
    try {
      const state = await redisClient.getRoomState(sessionId)
      if (!state) return null

      return {
        sessionId: state.sessionId,
        havrutaId: state.havrutaId,
        currentSection: state.currentSection,
        participantCount: state.participantCount,
        lastActivity: new Date(state.lastActivity),
        createdAt: new Date(state.createdAt)
      }
    } catch (error) {
      logger.error('Error getting room state:', error)
      return null
    }
  }

  /**
   * Update room's current section
   */
  async updateRoomSection(sessionId: string, section: string, userId: string): Promise<void> {
    try {
      const roomState = await redisClient.getRoomState(sessionId)
      if (!roomState) {
        logger.warn(`Attempted to update section for non-existent room: ${sessionId}`)
        return
      }

      roomState.currentSection = section
      roomState.lastActivity = new Date()
      
      await redisClient.setRoomState(sessionId, roomState)

      // Broadcast section update to all participants in the room
      this.io.to(sessionId).emit('section-updated', {
        section,
        updatedBy: userId,
        timestamp: new Date().toISOString()
      })

      logger.info(`Room ${sessionId} section updated to ${section} by user ${userId}`)
    } catch (error) {
      logger.error('Error updating room section:', error)
    }
  }

  /**
   * Broadcast message to room
   */
  broadcastToRoom(sessionId: string, event: string, data: any): void {
    this.io.to(sessionId).emit(event, data)
  }

  /**
   * Broadcast message to specific user in room
   */
  async broadcastToUserInRoom(sessionId: string, userId: string, event: string, data: any): Promise<boolean> {
    try {
      const participants = await redisClient.getRoomParticipants(sessionId)
      const participant = participants[userId]
      
      if (!participant) {
        return false
      }

      // Find the socket by ID
      const socket = this.io.sockets.sockets.get(participant.socketId)
      if (socket) {
        socket.emit(event, data)
        return true
      }

      return false
    } catch (error) {
      logger.error('Error broadcasting to user in room:', error)
      return false
    }
  }

  /**
   * Get active rooms count
   */
  async getActiveRoomsCount(): Promise<number> {
    try {
      const rooms = await redisClient.getActiveRooms()
      return rooms.length
    } catch (error) {
      logger.error('Error getting active rooms count:', error)
      return 0
    }
  }

  /**
   * Get room statistics
   */
  async getRoomStatistics(): Promise<{
    totalRooms: number
    totalParticipants: number
    averageParticipantsPerRoom: number
  }> {
    try {
      const rooms = await redisClient.getActiveRooms()
      let totalParticipants = 0

      for (const roomId of rooms) {
        const count = await redisClient.getRoomParticipantCount(roomId)
        totalParticipants += count
      }

      return {
        totalRooms: rooms.length,
        totalParticipants,
        averageParticipantsPerRoom: rooms.length > 0 ? totalParticipants / rooms.length : 0
      }
    } catch (error) {
      logger.error('Error getting room statistics:', error)
      return {
        totalRooms: 0,
        totalParticipants: 0,
        averageParticipantsPerRoom: 0
      }
    }
  }

  /**
   * Verify user has access to session
   */
  private async verifySessionAccess(sessionId: string, userId: string): Promise<boolean> {
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
      logger.error('Error verifying session access:', error)
      return false
    }
  }

  /**
   * Start automatic room cleanup
   */
  private startRoomCleanup(): void {
    this.roomCleanupInterval = setInterval(async () => {
      await this.cleanupInactiveRooms()
    }, this.CLEANUP_INTERVAL_MINUTES * 60 * 1000)

    logger.info(`Room cleanup started - runs every ${this.CLEANUP_INTERVAL_MINUTES} minutes`)
  }

  /**
   * Clean up inactive rooms
   */
  async cleanupInactiveRooms(): Promise<number> {
    try {
      const cutoffTime = new Date(Date.now() - this.ROOM_TIMEOUT_MINUTES * 60 * 1000)
      const rooms = await redisClient.getActiveRooms()
      let cleanedCount = 0

      for (const roomId of rooms) {
        const roomState = await redisClient.getRoomState(roomId)
        
        if (!roomState) {
          // Room state missing, clean up
          await redisClient.deleteRoom(roomId)
          cleanedCount++
          continue
        }

        const lastActivity = new Date(roomState.lastActivity)
        const participantCount = await redisClient.getRoomParticipantCount(roomId)

        // Clean up if room is empty or inactive for too long
        if (participantCount === 0 || lastActivity < cutoffTime) {
          await redisClient.deleteRoom(roomId)
          cleanedCount++
          logger.info(`Cleaned up inactive room: ${roomId}`)
        }
      }

      if (cleanedCount > 0) {
        logger.info(`Cleaned up ${cleanedCount} inactive rooms`)
      }

      return cleanedCount
    } catch (error) {
      logger.error('Error during room cleanup:', error)
      return 0
    }
  }

  /**
   * Stop room cleanup and disconnect Redis
   */
  async shutdown(): Promise<void> {
    try {
      if (this.roomCleanupInterval) {
        clearInterval(this.roomCleanupInterval)
        this.roomCleanupInterval = null
      }

      await redisClient.disconnect()
      logger.info('WebSocketRoomService shutdown complete')
    } catch (error) {
      logger.error('Error during WebSocketRoomService shutdown:', error)
    }
  }
}