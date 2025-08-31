import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SyncService, NavigationEvent } from '../services/syncService'
import { WebSocketService } from '../services/websocketService'

// Mock dependencies
vi.mock('../utils/database', () => ({
  prisma: {
    havruta: {
      findUnique: vi.fn(),
      update: vi.fn()
    },
    progress: {
      upsert: vi.fn()
    }
  }
}))

import { prisma } from '../utils/database'

describe('SyncService', () => {
  let syncService: SyncService
  let mockWebSocketService: Partial<WebSocketService>

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

  const mockUser = {
    id: 'user-1',
    name: 'Test User'
  }

  beforeEach(() => {
    // Mock WebSocket service
    mockWebSocketService = {
      broadcastToRoom: vi.fn(),
      getRoomInfo: vi.fn().mockReturnValue({
        id: 'havruta-1',
        participants: new Map([['user-1', {}], ['user-2', {}]]),
        currentSection: 'Genesis 1:1',
        lastActivity: new Date()
      }),
      getActiveRooms: vi.fn().mockReturnValue(new Map([
        ['havruta-1', { id: 'havruta-1', participants: new Map() }]
      ]))
    }

    // Mock prisma calls
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

    // Create sync service
    syncService = new SyncService(mockWebSocketService as WebSocketService)
  })

  describe('Navigation Broadcasting', () => {
    it('should broadcast navigation events successfully', async () => {
      const havrutaId = 'havruta-1'
      const section = 'Genesis 1:2'
      
      await syncService.broadcastNavigation(havrutaId, section, mockUser)
      
      expect(mockWebSocketService.broadcastToRoom).toHaveBeenCalledWith(
        havrutaId,
        'text-navigation',
        expect.objectContaining({
          havrutaId,
          section,
          navigatedBy: mockUser,
          timestamp: expect.any(String)
        })
      )
    })

    it('should handle navigation conflicts with last-writer-wins', async () => {
      const havrutaId = 'havruta-1'
      
      // Simulate rapid navigation events
      const navigation1 = syncService.broadcastNavigation(havrutaId, 'Genesis 1:2', mockUser)
      const navigation2 = syncService.broadcastNavigation(havrutaId, 'Genesis 1:3', {
        id: 'user-2',
        name: 'User 2'
      })
      
      await Promise.all([navigation1, navigation2])
      
      // Should have called broadcast for both navigations
      expect(mockWebSocketService.broadcastToRoom).toHaveBeenCalledTimes(2)
    })

    it('should store navigation history', async () => {
      const havrutaId = 'havruta-1'
      const section = 'Genesis 1:2'
      
      await syncService.broadcastNavigation(havrutaId, section, mockUser)
      
      const history = syncService.getNavigationHistory(havrutaId)
      expect(history).toHaveLength(1)
      expect(history[0]).toMatchObject({
        havrutaId,
        section,
        navigatedBy: mockUser
      })
    })
  })

  describe('Participant Synchronization', () => {
    it('should sync participant join events', async () => {
      const havrutaId = 'havruta-1'
      const userId = 'user-2'
      const userName = 'User 2'
      
      await syncService.syncParticipantJoin(havrutaId, userId, userName)
      
      expect(mockWebSocketService.broadcastToRoom).toHaveBeenCalledWith(
        havrutaId,
        'participant-joined',
        expect.objectContaining({
          userId,
          userName,
          participantCount: 2,
          timestamp: expect.any(String)
        })
      )
    })

    it('should sync participant leave events', async () => {
      const havrutaId = 'havruta-1'
      const userId = 'user-2'
      const userName = 'User 2'
      
      await syncService.syncParticipantLeave(havrutaId, userId, userName)
      
      expect(mockWebSocketService.broadcastToRoom).toHaveBeenCalledWith(
        havrutaId,
        'participant-left',
        expect.objectContaining({
          userId,
          userName,
          participantCount: 2,
          timestamp: expect.any(String)
        })
      )
    })
  })

  describe('Progress Synchronization', () => {
    it('should sync progress updates', async () => {
      const havrutaId = 'havruta-1'
      const userId = 'user-1'
      const section = 'Genesis 1:2'
      const sectionsCompleted = ['Genesis 1:1', 'Genesis 1:2']
      
      await syncService.syncProgressUpdate(havrutaId, userId, section, sectionsCompleted)
      
      expect(mockWebSocketService.broadcastToRoom).toHaveBeenCalledWith(
        havrutaId,
        'progress-updated',
        expect.objectContaining({
          userId,
          section,
          sectionsCompleted,
          timestamp: expect.any(String)
        })
      )
    })
  })

  describe('Session State Synchronization', () => {
    it('should sync session state changes', async () => {
      const havrutaId = 'havruta-1'
      const state = 'paused'
      
      await syncService.syncSessionState(havrutaId, state, mockUser)
      
      expect(mockWebSocketService.broadcastToRoom).toHaveBeenCalledWith(
        havrutaId,
        'session-state-changed',
        expect.objectContaining({
          havrutaId,
          state,
          triggeredBy: mockUser,
          timestamp: expect.any(String)
        })
      )
    })

    it('should handle session end state', async () => {
      const havrutaId = 'havruta-1'
      const state = 'ended'
      
      await syncService.syncSessionState(havrutaId, state, mockUser)
      
      expect(mockWebSocketService.broadcastToRoom).toHaveBeenCalledWith(
        havrutaId,
        'session-state-changed',
        expect.objectContaining({
          state: 'ended'
        })
      )
    })
  })

  describe('History Management', () => {
    it('should clear navigation history', () => {
      const havrutaId = 'havruta-1'
      
      // Add some history
      syncService.broadcastNavigation(havrutaId, 'Genesis 1:2', mockUser)
      
      // Clear history
      syncService.clearNavigationHistory(havrutaId)
      
      const history = syncService.getNavigationHistory(havrutaId)
      expect(history).toHaveLength(0)
    })

    it('should clean up inactive sessions', () => {
      // Mock empty active rooms
      mockWebSocketService.getActiveRooms = vi.fn().mockReturnValue(new Map())
      
      // Should not throw error
      expect(() => {
        syncService.cleanupInactiveSessions()
      }).not.toThrow()
    })
  })

  describe('Error Handling', () => {
    it('should handle broadcast errors gracefully', async () => {
      mockWebSocketService.broadcastToRoom = vi.fn().mockImplementation(() => {
        throw new Error('Broadcast failed')
      })
      
      await expect(
        syncService.broadcastNavigation('havruta-1', 'Genesis 1:2', mockUser)
      ).rejects.toThrow('Broadcast failed')
    })

    it('should handle missing room info', async () => {
      mockWebSocketService.getRoomInfo = vi.fn().mockReturnValue(undefined)
      
      // Should still work with undefined room info (participant count will be 1)
      await syncService.syncParticipantJoin('havruta-1', 'user-1', 'User 1')
      
      expect(mockWebSocketService.broadcastToRoom).toHaveBeenCalledWith(
        'havruta-1',
        'participant-joined',
        expect.objectContaining({
          participantCount: 1
        })
      )
    })
  })
})