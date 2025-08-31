import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Server as SocketIOServer } from 'socket.io'
import { createServer } from 'http'
import { WebSocketService } from '../services/websocketService'
import { SyncService } from '../services/syncService'

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
      findUnique: vi.fn(),
      update: vi.fn()
    },
    progress: {
      upsert: vi.fn()
    }
  }
}))

import { authService } from '../services/authService'
import { prisma } from '../utils/database'

describe('Real-time Synchronization Integration', () => {
  let httpServer: any
  let io: SocketIOServer
  let websocketService: WebSocketService
  let syncService: SyncService

  const mockUser1 = {
    id: 'user-1',
    name: 'User One',
    email: 'user1@example.com',
    oauthProvider: 'google' as const,
    oauthId: 'google-1',
    profilePicture: null,
    createdAt: new Date(),
    lastActiveAt: new Date()
  }

  const mockUser2 = {
    id: 'user-2',
    name: 'User Two',
    email: 'user2@example.com',
    oauthProvider: 'google' as const,
    oauthId: 'google-2',
    profilePicture: null,
    createdAt: new Date(),
    lastActiveAt: new Date()
  }

  const mockHavruta = {
    id: 'havruta-1',
    name: 'Test Havruta',
    bookId: 'Genesis',
    bookTitle: 'Genesis',
    ownerId: 'user-1',
    participants: ['user-1', 'user-2'],
    currentSection: 'Genesis 1:1',
    isActive: true,
    createdAt: new Date(),
    lastStudiedAt: new Date(),
    totalSessions: 1
  }

  beforeEach(() => {
    // Create HTTP server and Socket.IO instance
    httpServer = createServer()
    io = new SocketIOServer(httpServer)
    
    // Mock auth service
    authService.validateJWT = vi.fn().mockResolvedValue(mockUser1)
    authService.updateLastActive = vi.fn().mockResolvedValue(undefined)

    // Mock prisma
    prisma.havruta.findFirst = vi.fn().mockResolvedValue(mockHavruta)
    prisma.havruta.findUnique = vi.fn().mockResolvedValue(mockHavruta)
    prisma.havruta.update = vi.fn().mockResolvedValue(mockHavruta)
    prisma.progress.upsert = vi.fn().mockResolvedValue({
      id: 'progress-1',
      userId: 'user-1',
      havrutaId: 'havruta-1',
      sectionsCompleted: ['Genesis 1:1'],
      lastSection: 'Genesis 1:1',
      totalTimeStudied: 0,
      updatedAt: new Date()
    })

    // Create services
    websocketService = new WebSocketService(io)
    syncService = new SyncService(websocketService)
    websocketService.setSyncService(syncService)
  })

  afterEach(() => {
    vi.clearAllMocks()
    httpServer.close()
  })

  describe('WebSocket and Sync Service Integration', () => {
    it('should initialize services correctly', () => {
      expect(websocketService).toBeDefined()
      expect(syncService).toBeDefined()
      
      // Check that WebSocket service has sync service reference
      expect(websocketService['syncService']).toBe(syncService)
    })

    it('should handle navigation synchronization through both services', async () => {
      const havrutaId = 'havruta-1'
      const section = 'Genesis 1:2'
      const user = { id: 'user-1', name: 'User One' }

      // Test direct sync service call
      await syncService.broadcastNavigation(havrutaId, section, user)

      // Verify database was updated
      expect(prisma.havruta.update).toHaveBeenCalledWith({
        where: { id: havrutaId },
        data: {
          currentSection: section,
          lastStudiedAt: expect.any(Date)
        }
      })

      // Verify navigation history was stored
      const history = syncService.getNavigationHistory(havrutaId)
      expect(history).toHaveLength(1)
      expect(history[0]).toMatchObject({
        havrutaId,
        section,
        navigatedBy: user
      })
    })

    it('should handle participant synchronization', async () => {
      const havrutaId = 'havruta-1'
      const userId = 'user-2'
      const userName = 'User Two'

      // Test participant join
      await syncService.syncParticipantJoin(havrutaId, userId, userName)

      expect(prisma.havruta.findUnique).toHaveBeenCalledWith({
        where: { id: havrutaId }
      })

      // Test participant leave
      await syncService.syncParticipantLeave(havrutaId, userId, userName)

      // Both should complete without errors
    })

    it('should handle progress synchronization', async () => {
      const havrutaId = 'havruta-1'
      const userId = 'user-1'
      const section = 'Genesis 1:3'
      const sectionsCompleted = ['Genesis 1:1', 'Genesis 1:2', 'Genesis 1:3']

      await syncService.syncProgressUpdate(havrutaId, userId, section, sectionsCompleted)

      expect(prisma.progress.upsert).toHaveBeenCalledWith({
        where: {
          userId_havrutaId: {
            userId,
            havrutaId
          }
        },
        update: {
          lastSection: section,
          sectionsCompleted,
          updatedAt: expect.any(Date)
        },
        create: {
          userId,
          havrutaId,
          lastSection: section,
          sectionsCompleted,
          totalTimeStudied: 0
        }
      })
    })

    it('should handle session state changes', async () => {
      const havrutaId = 'havruta-1'
      const user = { id: 'user-1', name: 'User One' }

      // Test session pause
      await syncService.syncSessionState(havrutaId, 'paused', user)

      // Test session end
      await syncService.syncSessionState(havrutaId, 'ended', user)

      expect(prisma.havruta.update).toHaveBeenCalledWith({
        where: { id: havrutaId },
        data: {
          isActive: false,
          lastStudiedAt: expect.any(Date)
        }
      })
    })

    it('should handle navigation conflicts', async () => {
      const havrutaId = 'havruta-1'
      
      // Simulate concurrent navigation attempts
      const navigation1 = syncService.broadcastNavigation(havrutaId, 'Genesis 1:2', mockUser1)
      const navigation2 = syncService.broadcastNavigation(havrutaId, 'Genesis 1:3', mockUser2)

      await Promise.all([navigation1, navigation2])

      // Should have navigation history
      const history = syncService.getNavigationHistory(havrutaId)
      expect(history.length).toBeGreaterThan(0)

      // Database should be updated (last writer wins)
      expect(prisma.havruta.update).toHaveBeenCalled()
    })

    it('should clean up inactive sessions', () => {
      // Add some navigation history
      syncService.broadcastNavigation('havruta-1', 'Genesis 1:2', mockUser1)
      
      // Mock empty active rooms
      websocketService.getActiveRooms = vi.fn().mockReturnValue(new Map())
      
      // Clean up
      syncService.cleanupInactiveSessions()
      
      // History should be cleaned
      const history = syncService.getNavigationHistory('havruta-1')
      expect(history).toHaveLength(0)
    })
  })

  describe('Error Handling Integration', () => {
    it('should handle database errors in navigation', async () => {
      prisma.havruta.update = vi.fn().mockRejectedValue(new Error('Database error'))

      await expect(
        syncService.broadcastNavigation('havruta-1', 'Genesis 1:2', mockUser1)
      ).rejects.toThrow('Database error')
    })

    it('should handle missing Havruta in participant sync', async () => {
      prisma.havruta.findUnique = vi.fn().mockResolvedValue(null)

      await expect(
        syncService.syncParticipantJoin('havruta-1', 'user-1', 'User One')
      ).rejects.toThrow('Havruta not found')
    })

    it('should handle progress update errors', async () => {
      prisma.progress.upsert = vi.fn().mockRejectedValue(new Error('Progress error'))

      await expect(
        syncService.syncProgressUpdate('havruta-1', 'user-1', 'Genesis 1:2', [])
      ).rejects.toThrow('Progress error')
    })
  })

  describe('Performance and Scalability', () => {
    it('should handle multiple rapid navigation events', async () => {
      const havrutaId = 'havruta-1'
      const navigationPromises = []

      // Simulate 10 rapid navigation events
      for (let i = 1; i <= 10; i++) {
        navigationPromises.push(
          syncService.broadcastNavigation(havrutaId, `Genesis 1:${i}`, mockUser1)
        )
      }

      await Promise.all(navigationPromises)

      // Should have navigation history
      const history = syncService.getNavigationHistory(havrutaId)
      expect(history.length).toBeGreaterThan(0)
      expect(history.length).toBeLessThanOrEqual(10)
    })

    it('should limit navigation history size', async () => {
      const havrutaId = 'havruta-1'

      // Add more than 50 navigation events
      for (let i = 1; i <= 60; i++) {
        await syncService.broadcastNavigation(havrutaId, `Genesis ${i}:1`, mockUser1)
      }

      const history = syncService.getNavigationHistory(havrutaId)
      expect(history.length).toBeLessThanOrEqual(50)
    })
  })
})