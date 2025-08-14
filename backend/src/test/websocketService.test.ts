import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Server as SocketIOServer } from 'socket.io'
import { createServer } from 'http'
import { WebSocketService } from '../services/websocketService'

// Mock dependencies
vi.mock('../services/authService', () => ({
  authService: {
    validateJWT: vi.fn(),
    updateLastActive: vi.fn()
  }
}))

vi.mock('../utils/database', () => ({
  prisma: {
    havruta: {
      findFirst: vi.fn(),
      update: vi.fn()
    },
    progress: {
      upsert: vi.fn()
    }
  }
}))

describe('WebSocketService', () => {
  let httpServer: any
  let io: SocketIOServer
  let websocketService: WebSocketService

  beforeEach(() => {
    // Create HTTP server and Socket.IO instance
    httpServer = createServer()
    io = new SocketIOServer(httpServer)
    
    // Mock io.use and io.on to prevent actual event binding during tests
    io.use = vi.fn()
    io.on = vi.fn()
    io.to = vi.fn().mockReturnValue({ emit: vi.fn() })
    
    // Create WebSocket service
    websocketService = new WebSocketService(io)
  })

  describe('WebSocket Service Initialization', () => {
    it('should initialize with middleware and connection handlers', () => {
      expect(io.use).toHaveBeenCalled()
      expect(io.on).toHaveBeenCalledWith('connection', expect.any(Function))
    })

    it('should have empty rooms initially', () => {
      const activeRooms = websocketService.getActiveRooms()
      expect(activeRooms.size).toBe(0)
    })
  })

  describe('Room Management', () => {
    it('should return undefined for non-existent room', () => {
      const room = websocketService.getRoomInfo('non-existent')
      expect(room).toBeUndefined()
    })

    it('should manage active rooms', () => {
      const activeRooms = websocketService.getActiveRooms()
      expect(activeRooms).toBeInstanceOf(Map)
      expect(activeRooms.size).toBe(0)
    })
  })

  describe('Broadcasting', () => {
    it('should broadcast to specific room', () => {
      const havrutaId = 'havruta-1'
      const eventData = { test: 'data' }
      
      websocketService.broadcastToRoom(havrutaId, 'test-event', eventData)
      
      expect(io.to).toHaveBeenCalledWith(havrutaId)
    })
  })

  describe('Room Cleanup', () => {
    it('should clean up inactive rooms', () => {
      // Test cleanup functionality - should not throw errors
      expect(() => {
        websocketService.cleanupInactiveRooms(60)
      }).not.toThrow()
      
      const activeRooms = websocketService.getActiveRooms()
      expect(activeRooms.size).toBe(0)
    })

    it('should handle cleanup with different time limits', () => {
      expect(() => {
        websocketService.cleanupInactiveRooms(30)
      }).not.toThrow()
      
      expect(() => {
        websocketService.cleanupInactiveRooms(120)
      }).not.toThrow()
    })
  })
})