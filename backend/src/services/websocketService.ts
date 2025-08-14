import { Server, Socket } from 'socket.io'
import { User } from '@prisma/client'
import { authService } from './authService'
import { prisma } from '../utils/database'

export interface AuthenticatedSocket extends Socket {
  user?: User
}

export interface HavrutaRoom {
  id: string
  participants: Map<string, AuthenticatedSocket>
  currentSection?: string
  lastActivity: Date
}

export class WebSocketService {
  private io: Server
  private rooms: Map<string, HavrutaRoom> = new Map()
  private syncService?: any // Will be set after SyncService is created

  constructor(io: Server) {
    this.io = io
    this.setupMiddleware()
    this.setupConnectionHandlers()
  }

  /**
   * Set the sync service (called after SyncService is instantiated)
   */
  setSyncService(syncService: any): void {
    this.syncService = syncService
  }

  /**
   * Set up authentication middleware for WebSocket connections
   */
  private setupMiddleware(): void {
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1]
        
        if (!token) {
          return next(new Error('Authentication token required'))
        }

        const user = await authService.validateJWT(token)
        if (!user) {
          return next(new Error('Invalid authentication token'))
        }

        socket.user = user
        await authService.updateLastActive(user.id)
        next()
      } catch (error) {
        console.error('WebSocket authentication error:', error)
        next(new Error('Authentication failed'))
      }
    })
  }

  /**
   * Set up connection event handlers
   */
  private setupConnectionHandlers(): void {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      console.log(`User ${socket.user?.name} (${socket.user?.id}) connected: ${socket.id}`)

      // Handle joining a Havruta room
      socket.on('join-havruta', async (data: { havrutaId: string }) => {
        await this.handleJoinHavruta(socket, data.havrutaId)
      })

      // Handle leaving a Havruta room
      socket.on('leave-havruta', async (data: { havrutaId: string }) => {
        await this.handleLeaveHavruta(socket, data.havrutaId)
      })

      // Handle text navigation events
      socket.on('navigate-text', async (data: { havrutaId: string; section: string }) => {
        await this.handleTextNavigation(socket, data.havrutaId, data.section)
      })

      // Handle progress updates
      socket.on('update-progress', async (data: { havrutaId: string; section: string }) => {
        await this.handleProgressUpdate(socket, data.havrutaId, data.section)
      })

      // Handle disconnection
      socket.on('disconnect', () => {
        this.handleDisconnect(socket)
      })

      // Handle connection errors
      socket.on('error', (error) => {
        console.error(`Socket error for user ${socket.user?.id}:`, error)
      })
    })
  }

  /**
   * Handle user joining a Havruta room
   */
  private async handleJoinHavruta(socket: AuthenticatedSocket, havrutaId: string): Promise<void> {
    try {
      if (!socket.user) {
        socket.emit('error', { message: 'User not authenticated' })
        return
      }

      // Verify user has access to this Havruta
      const havruta = await prisma.havruta.findFirst({
        where: {
          id: havrutaId,
          OR: [
            { creatorId: socket.user.id },
            { participants: { has: socket.user.id } }
          ]
        }
      })

      if (!havruta) {
        socket.emit('error', { message: 'Havruta not found or access denied' })
        return
      }

      // Join the socket room
      await socket.join(havrutaId)

      // Get or create room state
      let room = this.rooms.get(havrutaId)
      if (!room) {
        room = {
          id: havrutaId,
          participants: new Map(),
          currentSection: havruta.currentSection || undefined,
          lastActivity: new Date()
        }
        this.rooms.set(havrutaId, room)
      }

      // Add participant to room
      room.participants.set(socket.user.id, socket)
      room.lastActivity = new Date()

      // Notify other participants
      socket.to(havrutaId).emit('participant-joined', {
        userId: socket.user.id,
        userName: socket.user.name,
        participantCount: room.participants.size
      })

      // Send current room state to the joining user
      socket.emit('havruta-joined', {
        havrutaId,
        currentSection: room.currentSection,
        participants: Array.from(room.participants.values()).map(s => ({
          id: s.user?.id,
          name: s.user?.name
        }))
      })

      console.log(`User ${socket.user.name} joined Havruta ${havrutaId}`)
    } catch (error) {
      console.error('Error joining Havruta:', error)
      socket.emit('error', { message: 'Failed to join Havruta' })
    }
  }

  /**
   * Handle user leaving a Havruta room
   */
  private async handleLeaveHavruta(socket: AuthenticatedSocket, havrutaId: string): Promise<void> {
    try {
      if (!socket.user) return

      await socket.leave(havrutaId)

      const room = this.rooms.get(havrutaId)
      if (room) {
        room.participants.delete(socket.user.id)
        room.lastActivity = new Date()

        // Notify other participants
        socket.to(havrutaId).emit('participant-left', {
          userId: socket.user.id,
          userName: socket.user.name,
          participantCount: room.participants.size
        })

        // Clean up empty rooms
        if (room.participants.size === 0) {
          this.rooms.delete(havrutaId)
        }
      }

      socket.emit('havruta-left', { havrutaId })
      console.log(`User ${socket.user.name} left Havruta ${havrutaId}`)
    } catch (error) {
      console.error('Error leaving Havruta:', error)
    }
  }

  /**
   * Handle text navigation synchronization
   */
  private async handleTextNavigation(socket: AuthenticatedSocket, havrutaId: string, section: string): Promise<void> {
    try {
      if (!socket.user) return

      const room = this.rooms.get(havrutaId)
      if (!room || !room.participants.has(socket.user.id)) {
        socket.emit('error', { message: 'Not in Havruta room' })
        return
      }

      // Update room state
      room.currentSection = section
      room.lastActivity = new Date()

      // Use SyncService if available, otherwise fallback to direct handling
      if (this.syncService) {
        await this.syncService.broadcastNavigation(havrutaId, section, {
          id: socket.user.id,
          name: socket.user.name
        })
      } else {
        // Fallback: direct database update and broadcast
        await prisma.havruta.update({
          where: { id: havrutaId },
          data: { 
            currentSection: section,
            lastStudiedAt: new Date()
          }
        })

        socket.to(havrutaId).emit('text-navigation', {
          section,
          navigatedBy: {
            id: socket.user.id,
            name: socket.user.name
          },
          timestamp: new Date().toISOString()
        })
      }

      console.log(`User ${socket.user.name} navigated to ${section} in Havruta ${havrutaId}`)
    } catch (error) {
      console.error('Error handling text navigation:', error)
      socket.emit('error', { message: 'Failed to sync navigation' })
    }
  }

  /**
   * Handle progress updates
   */
  private async handleProgressUpdate(socket: AuthenticatedSocket, havrutaId: string, section: string): Promise<void> {
    try {
      if (!socket.user) return

      // Update user progress
      await prisma.progress.upsert({
        where: {
          userId_havrutaId: {
            userId: socket.user.id,
            havrutaId: havrutaId
          }
        },
        update: {
          lastSection: section,
          updatedAt: new Date()
        },
        create: {
          userId: socket.user.id,
          havrutaId: havrutaId,
          lastSection: section,
          sectionsCompleted: [section],
          totalTimeStudied: 0
        }
      })

      // Broadcast progress update to room
      socket.to(havrutaId).emit('progress-updated', {
        userId: socket.user.id,
        section,
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      console.error('Error updating progress:', error)
    }
  }

  /**
   * Handle socket disconnection
   */
  private handleDisconnect(socket: AuthenticatedSocket): void {
    if (!socket.user) return

    console.log(`User ${socket.user.name} (${socket.user.id}) disconnected: ${socket.id}`)

    // Remove from all rooms
    for (const [havrutaId, room] of this.rooms.entries()) {
      if (room.participants.has(socket.user.id)) {
        room.participants.delete(socket.user.id)
        
        // Notify other participants
        socket.to(havrutaId).emit('participant-left', {
          userId: socket.user.id,
          userName: socket.user.name,
          participantCount: room.participants.size
        })

        // Clean up empty rooms
        if (room.participants.size === 0) {
          this.rooms.delete(havrutaId)
        }
      }
    }
  }

  /**
   * Get room information
   */
  public getRoomInfo(havrutaId: string): HavrutaRoom | undefined {
    return this.rooms.get(havrutaId)
  }

  /**
   * Get all active rooms
   */
  public getActiveRooms(): Map<string, HavrutaRoom> {
    return this.rooms
  }

  /**
   * Broadcast message to specific room
   */
  public broadcastToRoom(havrutaId: string, event: string, data: any): void {
    this.io.to(havrutaId).emit(event, data)
  }

  /**
   * Clean up inactive rooms (can be called periodically)
   */
  public cleanupInactiveRooms(maxInactiveMinutes: number = 60): void {
    const cutoff = new Date(Date.now() - maxInactiveMinutes * 60 * 1000)
    
    for (const [havrutaId, room] of this.rooms.entries()) {
      if (room.lastActivity < cutoff && room.participants.size === 0) {
        this.rooms.delete(havrutaId)
        console.log(`Cleaned up inactive room: ${havrutaId}`)
      }
    }
  }
}