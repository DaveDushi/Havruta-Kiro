import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { socketService } from '../services/socketService'
import { User, NavigationEvent, NavigationConflict } from '../types'

// Mock socket.io-client
const mockSocket = {
  connected: false,
  connect: vi.fn(),
  disconnect: vi.fn(),
  emit: vi.fn(),
  on: vi.fn(),
  once: vi.fn(),
  off: vi.fn()
}

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => mockSocket)
}))

const mockUser: User = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
  oauthProvider: 'google',
  oauthId: 'google-123',
  createdAt: new Date(),
  lastActiveAt: new Date()
}

describe('SocketService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSocket.connected = false
  })

  afterEach(() => {
    socketService.disconnect()
  })

  describe('Connection Management', () => {
    it('should connect to WebSocket server', async () => {
      mockSocket.connected = true
      
      // Mock successful connection
      mockSocket.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'connect') {
          setTimeout(callback, 0)
        }
      })

      await socketService.connect(mockUser)

      expect(mockSocket.on).toHaveBeenCalledWith('connect', expect.any(Function))
      expect(mockSocket.on).toHaveBeenCalledWith('connect_error', expect.any(Function))
      expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function))
    })

    it('should handle connection errors', async () => {
      const error = new Error('Connection failed')
      
      mockSocket.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'connect_error') {
          setTimeout(() => callback(error), 0)
        }
      })

      await expect(socketService.connect(mockUser)).rejects.toThrow('Connection failed')
    })

    it('should disconnect properly', () => {
      mockSocket.connected = true
      socketService.disconnect()

      expect(mockSocket.disconnect).toHaveBeenCalled()
    })

    it('should return connection status', () => {
      mockSocket.connected = false
      expect(socketService.isConnected()).toBe(false)

      mockSocket.connected = true
      expect(socketService.isConnected()).toBe(true)
    })
  })

  describe('Session Management', () => {
    beforeEach(async () => {
      mockSocket.connected = true
      mockSocket.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'connect') {
          setTimeout(callback, 0)
        }
      })
      await socketService.connect(mockUser)
    })

    it('should join session successfully', async () => {
      const sessionId = 'test-session'
      
      mockSocket.once.mockImplementation((event: string, callback: Function) => {
        if (event === 'session:joined') {
          setTimeout(() => callback(sessionId), 0)
        }
      })

      await socketService.joinSession(sessionId)

      expect(mockSocket.emit).toHaveBeenCalledWith('session:join', {
        sessionId,
        userId: mockUser.id,
        userName: mockUser.name
      })
    })

    it('should handle session join errors', async () => {
      const sessionId = 'test-session'
      const error = 'Session not found'
      
      mockSocket.once.mockImplementation((event: string, callback: Function) => {
        if (event === 'session:error') {
          setTimeout(() => callback(error), 0)
        }
      })

      await expect(socketService.joinSession(sessionId)).rejects.toThrow(error)
    })

    it('should handle session join timeout', async () => {
      const sessionId = 'test-session'
      
      // Don't call any callbacks to simulate timeout
      mockSocket.once.mockImplementation(() => {})

      await expect(socketService.joinSession(sessionId)).rejects.toThrow('Session join timeout')
    })

    it('should leave session', () => {
      const sessionId = 'test-session'
      
      // First join a session
      socketService['currentSessionId'] = sessionId
      
      socketService.leaveSession()

      expect(mockSocket.emit).toHaveBeenCalledWith('session:leave', {
        sessionId,
        userId: mockUser.id
      })
    })
  })

  describe('Navigation Broadcasting', () => {
    beforeEach(async () => {
      mockSocket.connected = true
      mockSocket.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'connect') {
          setTimeout(callback, 0)
        }
      })
      await socketService.connect(mockUser)
      socketService['currentSessionId'] = 'test-session'
    })

    it('should broadcast navigation events', () => {
      const newRef = 'Genesis 2:1'
      
      socketService.broadcastNavigation(newRef)

      expect(mockSocket.emit).toHaveBeenCalledWith('navigation:update', {
        sessionId: 'test-session',
        userId: mockUser.id,
        userName: mockUser.name,
        newRef,
        timestamp: expect.any(Date)
      })
    })

    it('should sync to reference', () => {
      const ref = 'Genesis 3:1'
      
      socketService.syncToReference(ref)

      expect(mockSocket.emit).toHaveBeenCalledWith('navigation:sync', {
        sessionId: 'test-session',
        ref
      })
    })

    it('should resolve conflicts', () => {
      const chosenRef = 'Genesis 4:1'
      
      socketService.resolveConflict(chosenRef)

      expect(mockSocket.emit).toHaveBeenCalledWith('navigation:resolve-conflict', {
        sessionId: 'test-session',
        chosenRef,
        userId: mockUser.id
      })
    })

    it('should not broadcast when not connected to session', () => {
      socketService['currentSessionId'] = null
      
      socketService.broadcastNavigation('Genesis 2:1')

      expect(mockSocket.emit).not.toHaveBeenCalled()
    })
  })

  describe('Event Listeners', () => {
    beforeEach(async () => {
      mockSocket.connected = true
      mockSocket.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'connect') {
          setTimeout(callback, 0)
        }
      })
      await socketService.connect(mockUser)
    })

    it('should register event listeners', () => {
      const callback = vi.fn()
      
      socketService.on('navigation:update', callback)

      expect(socketService['eventListeners'].get('navigation:update')).toContain(callback)
    })

    it('should unregister event listeners', () => {
      const callback = vi.fn()
      
      socketService.on('navigation:update', callback)
      socketService.off('navigation:update', callback)

      const listeners = socketService['eventListeners'].get('navigation:update')
      expect(listeners).not.toContain(callback)
    })

    it('should forward socket events to registered listeners', () => {
      const callback = vi.fn()
      let socketCallback: Function

      // Capture the socket callback
      mockSocket.on.mockImplementation((event: string, cb: Function) => {
        if (event === 'navigation:update') {
          socketCallback = cb
        }
      })

      socketService.on('navigation:update', callback)

      // Simulate socket event
      const navigationEvent: NavigationEvent = {
        sessionId: 'test-session',
        userId: 'user-2',
        userName: 'Other User',
        newRef: 'Genesis 2:1',
        timestamp: new Date()
      }

      if (socketCallback!) {
        socketCallback(navigationEvent)
      }

      expect(callback).toHaveBeenCalledWith(navigationEvent)
    })
  })

  describe('Utility Methods', () => {
    beforeEach(async () => {
      mockSocket.connected = true
      mockSocket.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'connect') {
          setTimeout(callback, 0)
        }
      })
      await socketService.connect(mockUser)
    })

    it('should return current session ID', () => {
      const sessionId = 'test-session'
      socketService['currentSessionId'] = sessionId

      expect(socketService.getCurrentSessionId()).toBe(sessionId)
    })

    it('should return current user', () => {
      expect(socketService.getCurrentUser()).toEqual(mockUser)
    })

    it('should return null when no session or user', () => {
      socketService.disconnect()

      expect(socketService.getCurrentSessionId()).toBeNull()
      expect(socketService.getCurrentUser()).toBeNull()
    })
  })
})