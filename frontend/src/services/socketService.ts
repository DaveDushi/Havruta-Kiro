import { io, Socket } from 'socket.io-client'
import { User } from '../types'
import { authService } from './authService'

export interface ParticipantPosition {
  userId: string
  userName: string
  currentRef: string
  timestamp: Date
  isActive: boolean
}

export interface NavigationEvent {
  sessionId: string
  userId: string
  userName: string
  newRef: string
  timestamp: Date
}

export interface NavigationConflict {
  sessionId: string
  conflictingRefs: Array<{
    ref: string
    participants: Array<{ userId: string, userName: string }>
  }>
  timestamp: Date
}

export interface InstantSessionInvitation {
  sessionId: string
  havrutaId: string
  havrutaName: string
  creatorName: string
  message: string
  joinUrl: string
  timestamp: string
}

export interface SocketEvents {
  // Navigation events
  'navigation:update': (event: NavigationEvent) => void
  'navigation:conflict': (conflict: NavigationConflict) => void
  'navigation:sync': (ref: string) => void
  
  // Participant events
  'participant:joined': (participant: { userId: string, userName: string }) => void
  'participant:left': (participant: { userId: string, userName: string }) => void
  'participant:positions': (positions: ParticipantPosition[]) => void
  
  // Session events (new Redis-based)
  'session-joined': (data: { sessionId: string, roomState?: any, participants?: any[] }) => void
  'session-left': (data: { sessionId: string, participantCount: number, roomDeleted: boolean }) => void
  
  // Legacy Havruta events
  'havruta-joined': (data: { havrutaId: string }) => void
  'havruta-left': (data: { havrutaId: string }) => void
  'participant-joined': (data: { userId: string, userName: string }) => void
  'participant-left': (data: { userId: string, userName: string }) => void
  'error': (data: { message: string }) => void

  // Instant session events
  'instant-session-invitation': (invitation: InstantSessionInvitation) => void

  // WebRTC events
  'participant-joined-call': (data: { participantId: string }) => void
  'participant-left-call': (data: { participantId: string }) => void
  'existing-call-participants': (data: { participants: string[] }) => void
  'webrtc-offer': (data: { from: string, offer: RTCSessionDescriptionInit }) => void
  'webrtc-answer': (data: { from: string, answer: RTCSessionDescriptionInit }) => void
  'webrtc-ice-candidate': (data: { from: string, candidate: RTCIceCandidateInit }) => void
}

class SocketService {
  private socket: Socket | null = null
  private currentSessionId: string | null = null
  private currentUser: User | null = null
  private eventListeners: Map<string, Function[]> = new Map()
  private isConnecting: boolean = false

  constructor() {
    // Listen for token refresh events
    window.addEventListener('auth:token-refreshed', this.handleTokenRefresh.bind(this))
  }

  private async handleTokenRefresh(): Promise<void> {
    if (this.currentUser && this.isConnected()) {
      try {
        console.log('🔄 Token refreshed, updating socket connection')
        await this.refreshConnection()
      } catch (error) {
        console.error('❌ Failed to refresh socket connection after token refresh:', error)
      }
    }
  }

  connect(user: User): Promise<void> {
    return new Promise((resolve, reject) => {
      // If already connected with the same user, resolve immediately
      if (this.socket?.connected && this.currentUser?.id === user.id) {
        console.log('Already connected with same user, resolving immediately')
        resolve()
        return
      }

      // If already connecting, wait for current connection
      if (this.isConnecting) {
        console.log('Already connecting, waiting...')
        const checkConnection = () => {
          if (this.socket?.connected) {
            resolve()
          } else if (!this.isConnecting) {
            reject(new Error('Connection failed'))
          } else {
            setTimeout(checkConnection, 100)
          }
        }
        setTimeout(checkConnection, 100)
        return
      }

      // If connected with different user, disconnect first
      if (this.socket?.connected && this.currentUser?.id !== user.id) {
        console.log('Disconnecting previous user connection')
        this.disconnect()
      }

      this.isConnecting = true
      this.currentUser = user
      
      // Get the JWT token for authentication
      const token = authService.getToken()
      if (!token) {
        this.isConnecting = false
        reject(new Error('No authentication token available'))
        return
      }
      
      console.log('Connecting to WebSocket with user:', user.name, 'token:', token.substring(0, 20) + '...')
      
      // Connect to the backend WebSocket server
      const backendUrl = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001'
      this.socket = io(backendUrl, {
        auth: {
          token: token
        },
        transports: ['websocket', 'polling'],
        forceNew: true, // Force new connection to prevent issues
        timeout: 10000 // 10 second timeout
      })

      this.socket.on('connect', () => {
        console.log('✅ Connected to WebSocket server for user:', user.name)
        this.isConnecting = false
        resolve()
      })

      this.socket.on('connect_error', (error) => {
        console.error('❌ WebSocket connection error:', error)
        console.error('Error details:', error.message, error.description, error.context)
        this.isConnecting = false
        
        // Handle specific authentication errors
        if (error.message?.includes('Authentication') || error.message?.includes('token')) {
          console.log('🔑 Authentication error detected, clearing tokens')
          authService.logout()
        }
        
        reject(error)
      })

      this.socket.on('disconnect', (reason) => {
        console.log('🔌 Disconnected from WebSocket server:', reason)
        this.isConnecting = false
        
        if (reason === 'io server disconnect') {
          console.log('🚫 Server disconnected the client - likely authentication issue')
          // Don't auto-logout here as it might be a temporary server issue
        }
      })

      this.socket.on('error', (error) => {
        console.error('🚨 Socket error:', error)
        
        // Handle authentication errors
        if (error.message?.includes('Authentication') || error.message?.includes('token')) {
          console.log('🔑 Socket authentication error, logging out')
          authService.logout()
          this.disconnect()
        }
      })

      // Set up event forwarding
      this.setupEventForwarding()
    })
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
    this.currentSessionId = null
    this.currentUser = null
    this.isConnecting = false
    this.eventListeners.clear()
  }

  joinSession(sessionId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.currentUser) {
        reject(new Error('Socket not connected or user not set'))
        return
      }

      this.currentSessionId = sessionId
      
      this.socket.emit('join-session', {
        sessionId: sessionId
      })

      // Wait for confirmation
      const timeout = setTimeout(() => {
        reject(new Error('Session join timeout'))
      }, 5000)

      this.socket.once('session-joined', (data: { sessionId: string }) => {
        clearTimeout(timeout)
        if (data.sessionId === sessionId) {
          resolve()
        } else {
          reject(new Error('Joined wrong session'))
        }
      })

      this.socket.once('error', (data: { message: string }) => {
        clearTimeout(timeout)
        reject(new Error(data.message))
      })
    })
  }

  leaveSession(): void {
    if (this.socket && this.currentSessionId) {
      this.socket.emit('leave-session', {
        sessionId: this.currentSessionId
      })
      this.currentSessionId = null
    }
  }

  broadcastNavigation(newRef: string): void {
    if (!this.socket || !this.currentSessionId || !this.currentUser) {
      console.warn('Cannot broadcast navigation: socket not ready')
      return
    }

    const event: NavigationEvent = {
      sessionId: this.currentSessionId,
      userId: this.currentUser.id,
      userName: this.currentUser.name,
      newRef,
      timestamp: new Date()
    }

    this.socket.emit('navigation:update', event)
  }

  syncToReference(ref: string): void {
    if (!this.socket || !this.currentSessionId) {
      console.warn('Cannot sync to reference: socket not ready')
      return
    }

    this.socket.emit('navigation:sync', {
      sessionId: this.currentSessionId,
      ref
    })
  }

  resolveConflict(chosenRef: string): void {
    if (!this.socket || !this.currentSessionId) {
      console.warn('Cannot resolve conflict: socket not ready')
      return
    }

    this.socket.emit('navigation:resolve-conflict', {
      sessionId: this.currentSessionId,
      chosenRef,
      userId: this.currentUser?.id
    })
  }

  // WebRTC signaling methods
  emit(event: string, data: any): void {
    if (!this.socket) {
      console.warn('Cannot emit event: socket not connected')
      return
    }
    this.socket.emit(event, data)
  }

  // Event listener management
  on<K extends keyof SocketEvents>(event: K, callback: SocketEvents[K]): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, [])
    }
    this.eventListeners.get(event)!.push(callback)
  }

  off<K extends keyof SocketEvents>(event: K, callback: SocketEvents[K]): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      const index = listeners.indexOf(callback)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }

  private setupEventForwarding(): void {
    if (!this.socket) return

    // Forward all socket events to registered listeners
    const events: Array<keyof SocketEvents> = [
      'navigation:update',
      'navigation:conflict',
      'navigation:sync',
      'participant:joined',
      'participant:left',
      'participant:positions',
      'session-joined',
      'session-left',
      'havruta-joined',
      'havruta-left',
      'participant-joined',
      'participant-left',
      'error',
      'instant-session-invitation',
      'participant-joined-call',
      'participant-left-call',
      'existing-call-participants',
      'webrtc-offer',
      'webrtc-answer',
      'webrtc-ice-candidate'
    ]

    events.forEach(event => {
      this.socket!.on(event, (...args: any[]) => {
        const listeners = this.eventListeners.get(event)
        if (listeners) {
          listeners.forEach(callback => callback(...args))
        }
      })
    })
  }

  // Utility methods
  isConnected(): boolean {
    return this.socket?.connected === true
  }

  /**
   * Refresh connection with new token (for token refresh scenarios)
   */
  async refreshConnection(): Promise<void> {
    if (!this.currentUser) {
      throw new Error('No current user to refresh connection for')
    }

    console.log('🔄 Refreshing socket connection with new token')
    const wasConnected = this.isConnected()
    const currentSessionId = this.currentSessionId
    
    // Disconnect current connection
    this.disconnect()
    
    // Reconnect with new token
    await this.connect(this.currentUser)
    
    // Rejoin session if we were in one
    if (wasConnected && currentSessionId) {
      console.log('🔄 Rejoining session after token refresh:', currentSessionId)
      await this.joinSession(currentSessionId)
    }
  }

  getCurrentSessionId(): string | null {
    return this.currentSessionId
  }

  getCurrentUser(): User | null {
    return this.currentUser
  }
}

// Export singleton instance
export const socketService = new SocketService()
export default socketService