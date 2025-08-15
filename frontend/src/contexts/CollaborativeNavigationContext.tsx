import React, { createContext, useContext, useReducer, useEffect, ReactNode, useCallback } from 'react'
import { ParticipantPosition, NavigationEvent, NavigationConflict, CollaborativeState } from '../types'
import { socketService } from '../services/socketService'
import type { SocketEvents } from '../services/socketService'
import { useAuth } from './AuthContext'

// Action types
type CollaborativeAction =
  | { type: 'SET_CONNECTED'; payload: boolean }
  | { type: 'SET_SESSION_ID'; payload: string | null }
  | { type: 'SET_PARTICIPANTS'; payload: ParticipantPosition[] }
  | { type: 'ADD_PARTICIPANT'; payload: ParticipantPosition }
  | { type: 'REMOVE_PARTICIPANT'; payload: string }
  | { type: 'UPDATE_PARTICIPANT_POSITION'; payload: { userId: string, ref: string } }
  | { type: 'SET_CONFLICT'; payload: NavigationConflict | null }
  | { type: 'SET_NAVIGATION_LOCKED'; payload: boolean }
  | { type: 'RESET_STATE' }

// Initial state
const initialState: CollaborativeState = {
  isConnected: false,
  sessionId: null,
  participants: [],
  currentConflict: null,
  isNavigationLocked: false,
}

// Reducer
const collaborativeReducer = (state: CollaborativeState, action: CollaborativeAction): CollaborativeState => {
  switch (action.type) {
    case 'SET_CONNECTED':
      return { ...state, isConnected: action.payload }
    
    case 'SET_SESSION_ID':
      return { ...state, sessionId: action.payload }
    
    case 'SET_PARTICIPANTS':
      return { ...state, participants: action.payload }
    
    case 'ADD_PARTICIPANT':
      return {
        ...state,
        participants: [...state.participants.filter(p => p.userId !== action.payload.userId), action.payload]
      }
    
    case 'REMOVE_PARTICIPANT':
      return {
        ...state,
        participants: state.participants.filter(p => p.userId !== action.payload)
      }
    
    case 'UPDATE_PARTICIPANT_POSITION':
      return {
        ...state,
        participants: state.participants.map(p =>
          p.userId === action.payload.userId
            ? { ...p, currentRef: action.payload.ref, timestamp: new Date(), isActive: true }
            : p
        )
      }
    
    case 'SET_CONFLICT':
      return { ...state, currentConflict: action.payload }
    
    case 'SET_NAVIGATION_LOCKED':
      return { ...state, isNavigationLocked: action.payload }
    
    case 'RESET_STATE':
      return initialState
    
    default:
      return state
  }
}

// Context type
interface CollaborativeNavigationContextType {
  state: CollaborativeState
  connectToSession: (sessionId: string) => Promise<void>
  disconnectFromSession: () => void
  broadcastNavigation: (ref: string) => void
  syncToReference: (ref: string) => void
  resolveConflict: (chosenRef: string) => void
  onNavigationUpdate: (callback: (event: NavigationEvent) => void) => void
  offNavigationUpdate: (callback: (event: NavigationEvent) => void) => void
}

// Create context
const CollaborativeNavigationContext = createContext<CollaborativeNavigationContextType | undefined>(undefined)

// Provider component
interface CollaborativeNavigationProviderProps {
  children: ReactNode
}

export const CollaborativeNavigationProvider: React.FC<CollaborativeNavigationProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(collaborativeReducer, initialState)
  const { user } = useAuth()

  // Socket event handlers
  const handleNavigationUpdate = useCallback((event: NavigationEvent) => {
    dispatch({ type: 'UPDATE_PARTICIPANT_POSITION', payload: { userId: event.userId, ref: event.newRef } })
  }, [])

  const handleNavigationConflict = useCallback((conflict: NavigationConflict) => {
    dispatch({ type: 'SET_CONFLICT', payload: conflict })
    dispatch({ type: 'SET_NAVIGATION_LOCKED', payload: true })
  }, [])

  const handleNavigationSync = useCallback((ref: string) => {
    // This event indicates all participants should sync to this reference
    dispatch({ type: 'SET_CONFLICT', payload: null })
    dispatch({ type: 'SET_NAVIGATION_LOCKED', payload: false })
  }, [])

  const handleParticipantJoined = useCallback((participant: { userId: string, userName: string }) => {
    const newParticipant: ParticipantPosition = {
      userId: participant.userId,
      userName: participant.userName,
      currentRef: '',
      timestamp: new Date(),
      isActive: true
    }
    dispatch({ type: 'ADD_PARTICIPANT', payload: newParticipant })
  }, [])

  const handleParticipantLeft = useCallback((participant: { userId: string, userName: string }) => {
    dispatch({ type: 'REMOVE_PARTICIPANT', payload: participant.userId })
  }, [])

  const handleParticipantPositions = useCallback((positions: ParticipantPosition[]) => {
    dispatch({ type: 'SET_PARTICIPANTS', payload: positions })
  }, [])

  const handleSessionJoined = useCallback((data: { havrutaId: string }) => {
    dispatch({ type: 'SET_SESSION_ID', payload: data.havrutaId })
    dispatch({ type: 'SET_CONNECTED', payload: true })
    console.log('Successfully joined havruta session:', data.havrutaId)
  }, [])

  const handleSessionLeft = useCallback((data: { havrutaId: string }) => {
    dispatch({ type: 'RESET_STATE' })
    console.log('Left havruta session:', data.havrutaId)
  }, [])

  const handleSessionError = useCallback((data: { message: string }) => {
    console.error('Session error:', data.message)
    dispatch({ type: 'SET_CONNECTED', payload: false })
  }, [])

  // Set up socket event listeners
  useEffect(() => {
    if (!user) return

    // Connect to socket service
    socketService.connect(user).catch(console.error)

    // Register event handlers
    socketService.on('navigation:update', handleNavigationUpdate)
    socketService.on('navigation:conflict', handleNavigationConflict)
    socketService.on('navigation:sync', handleNavigationSync)
    socketService.on('participant:joined', handleParticipantJoined)
    socketService.on('participant:left', handleParticipantLeft)
    socketService.on('participant:positions', handleParticipantPositions)
    socketService.on('havruta-joined', handleSessionJoined)
    socketService.on('havruta-left', handleSessionLeft)
    socketService.on('error', handleSessionError)

    return () => {
      // Clean up event listeners
      socketService.off('navigation:update', handleNavigationUpdate)
      socketService.off('navigation:conflict', handleNavigationConflict)
      socketService.off('navigation:sync', handleNavigationSync)
      socketService.off('participant:joined', handleParticipantJoined)
      socketService.off('participant:left', handleParticipantLeft)
      socketService.off('participant:positions', handleParticipantPositions)
      socketService.off('havruta-joined', handleSessionJoined)
      socketService.off('havruta-left', handleSessionLeft)
      socketService.off('error', handleSessionError)
    }
  }, [
    user,
    handleNavigationUpdate,
    handleNavigationConflict,
    handleNavigationSync,
    handleParticipantJoined,
    handleParticipantLeft,
    handleParticipantPositions,
    handleSessionJoined,
    handleSessionLeft,
    handleSessionError
  ])

  // Context methods
  const connectToSession = useCallback(async (sessionId: string) => {
    if (!user) {
      throw new Error('User not authenticated')
    }

    try {
      // Ensure socket is connected first
      if (!socketService.isConnected()) {
        console.log('Socket not connected, connecting first...')
        await socketService.connect(user)
      }
      
      console.log('Joining session:', sessionId)
      await socketService.joinSession(sessionId)
    } catch (error) {
      console.error('Failed to connect to session:', error)
      throw error
    }
  }, [user])

  const disconnectFromSession = useCallback(() => {
    socketService.leaveSession()
    dispatch({ type: 'RESET_STATE' })
  }, [])

  const broadcastNavigation = useCallback((ref: string) => {
    if (state.isNavigationLocked) {
      console.warn('Navigation is locked due to conflict')
      return
    }
    socketService.broadcastNavigation(ref)
  }, [state.isNavigationLocked])

  const syncToReference = useCallback((ref: string) => {
    socketService.syncToReference(ref)
  }, [])

  const resolveConflict = useCallback((chosenRef: string) => {
    socketService.resolveConflict(chosenRef)
    dispatch({ type: 'SET_CONFLICT', payload: null })
    dispatch({ type: 'SET_NAVIGATION_LOCKED', payload: false })
  }, [])

  const onNavigationUpdate = useCallback((callback: (event: NavigationEvent) => void) => {
    socketService.on('navigation:update', callback)
  }, [])

  const offNavigationUpdate = useCallback((callback: (event: NavigationEvent) => void) => {
    socketService.off('navigation:update', callback)
  }, [])

  const value: CollaborativeNavigationContextType = {
    state,
    connectToSession,
    disconnectFromSession,
    broadcastNavigation,
    syncToReference,
    resolveConflict,
    onNavigationUpdate,
    offNavigationUpdate,
  }

  return (
    <CollaborativeNavigationContext.Provider value={value}>
      {children}
    </CollaborativeNavigationContext.Provider>
  )
}

// Custom hook to use collaborative navigation context
export const useCollaborativeNavigation = (): CollaborativeNavigationContextType => {
  const context = useContext(CollaborativeNavigationContext)
  if (context === undefined) {
    throw new Error('useCollaborativeNavigation must be used within a CollaborativeNavigationProvider')
  }
  return context
}