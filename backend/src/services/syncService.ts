import { Server } from 'socket.io'
import { WebSocketService } from './websocketService'
import { prisma } from '../utils/database'

export interface NavigationEvent {
  havrutaId: string
  section: string
  navigatedBy: {
    id: string
    name: string
  }
  timestamp: string
  conflictResolution?: 'accept' | 'reject' | 'merge'
}

export interface SyncConflict {
  havrutaId: string
  conflictingNavigations: NavigationEvent[]
  currentSection: string
  timestamp: string
}

export class SyncService {
  private websocketService: WebSocketService
  private navigationHistory: Map<string, NavigationEvent[]> = new Map()
  private conflictResolutionTimeout = 5000 // 5 seconds

  constructor(websocketService: WebSocketService) {
    this.websocketService = websocketService
  }

  /**
   * Broadcast navigation event to all participants in a Havruta
   */
  async broadcastNavigation(
    havrutaId: string, 
    section: string, 
    navigatedBy: { id: string; name: string }
  ): Promise<void> {
    try {
      const navigationEvent: NavigationEvent = {
        havrutaId,
        section,
        navigatedBy,
        timestamp: new Date().toISOString()
      }

      // Check for conflicts
      const conflict = await this.detectNavigationConflict(navigationEvent)
      
      if (conflict) {
        await this.handleNavigationConflict(conflict)
        return
      }

      // Store navigation in history
      this.addToNavigationHistory(havrutaId, navigationEvent)

      // Update database
      await prisma.havruta.update({
        where: { id: havrutaId },
        data: { 
          currentSection: section,
          lastStudiedAt: new Date()
        }
      })

      // Broadcast to all participants
      this.websocketService.broadcastToRoom(havrutaId, 'text-navigation', navigationEvent)

      console.log(`Navigation broadcasted: ${navigatedBy.name} -> ${section} in ${havrutaId}`)
    } catch (error) {
      console.error('Error broadcasting navigation:', error)
      throw error
    }
  }

  /**
   * Handle participant joining a Havruta session
   */
  async syncParticipantJoin(havrutaId: string, userId: string, userName: string): Promise<void> {
    try {
      // Get current Havruta state
      const havruta = await prisma.havruta.findUnique({
        where: { id: havrutaId }
      })

      if (!havruta) {
        throw new Error('Havruta not found')
      }

      // Get room info from WebSocket service
      const room = this.websocketService.getRoomInfo(havrutaId)
      
      // Broadcast participant join event
      this.websocketService.broadcastToRoom(havrutaId, 'participant-joined', {
        userId,
        userName,
        currentSection: havruta.currentSection,
        participantCount: room?.participants.size || 1,
        timestamp: new Date().toISOString()
      })

      console.log(`Participant ${userName} joined Havruta ${havrutaId}`)
    } catch (error) {
      console.error('Error syncing participant join:', error)
      throw error
    }
  }

  /**
   * Handle participant leaving a Havruta session
   */
  async syncParticipantLeave(havrutaId: string, userId: string, userName: string): Promise<void> {
    try {
      const room = this.websocketService.getRoomInfo(havrutaId)
      
      // Broadcast participant leave event
      this.websocketService.broadcastToRoom(havrutaId, 'participant-left', {
        userId,
        userName,
        participantCount: room?.participants.size || 0,
        timestamp: new Date().toISOString()
      })

      console.log(`Participant ${userName} left Havruta ${havrutaId}`)
    } catch (error) {
      console.error('Error syncing participant leave:', error)
      throw error
    }
  }

  /**
   * Detect navigation conflicts when multiple users navigate simultaneously
   */
  private async detectNavigationConflict(navigationEvent: NavigationEvent): Promise<SyncConflict | null> {
    const { havrutaId, timestamp } = navigationEvent
    const history = this.navigationHistory.get(havrutaId) || []
    
    // Check for recent navigation events (within conflict resolution timeout)
    const recentEvents = history.filter(event => {
      const eventTime = new Date(event.timestamp).getTime()
      const currentTime = new Date(timestamp).getTime()
      return (currentTime - eventTime) < this.conflictResolutionTimeout
    })

    // If there are recent conflicting navigations
    if (recentEvents.length > 0) {
      const lastEvent = recentEvents[recentEvents.length - 1]
      
      // Check if navigating to different sections
      if (lastEvent.section !== navigationEvent.section) {
        return {
          havrutaId,
          conflictingNavigations: [...recentEvents, navigationEvent],
          currentSection: lastEvent.section,
          timestamp: new Date().toISOString()
        }
      }
    }

    return null
  }

  /**
   * Handle navigation conflicts using last-writer-wins strategy
   */
  private async handleNavigationConflict(conflict: SyncConflict): Promise<void> {
    const { havrutaId, conflictingNavigations } = conflict
    
    // Use last-writer-wins strategy - take the most recent navigation
    const winningNavigation = conflictingNavigations[conflictingNavigations.length - 1]
    winningNavigation.conflictResolution = 'accept'
    
    // Mark other navigations as rejected
    conflictingNavigations.slice(0, -1).forEach(nav => {
      nav.conflictResolution = 'reject'
    })

    // Store resolved navigation in history
    this.addToNavigationHistory(havrutaId, winningNavigation)

    // Update database with winning navigation
    await prisma.havruta.update({
      where: { id: havrutaId },
      data: { 
        currentSection: winningNavigation.section,
        lastStudiedAt: new Date()
      }
    })

    // Broadcast conflict resolution
    this.websocketService.broadcastToRoom(havrutaId, 'navigation-conflict-resolved', {
      winningNavigation,
      rejectedNavigations: conflictingNavigations.slice(0, -1),
      timestamp: new Date().toISOString()
    })

    console.log(`Navigation conflict resolved in ${havrutaId}: ${winningNavigation.section} wins`)
  }

  /**
   * Add navigation event to history
   */
  private addToNavigationHistory(havrutaId: string, navigationEvent: NavigationEvent): void {
    if (!this.navigationHistory.has(havrutaId)) {
      this.navigationHistory.set(havrutaId, [])
    }
    
    const history = this.navigationHistory.get(havrutaId)!
    history.push(navigationEvent)
    
    // Keep only recent history (last 50 events)
    if (history.length > 50) {
      history.splice(0, history.length - 50)
    }
  }

  /**
   * Get navigation history for a Havruta
   */
  getNavigationHistory(havrutaId: string): NavigationEvent[] {
    return this.navigationHistory.get(havrutaId) || []
  }

  /**
   * Clear navigation history for a Havruta (when session ends)
   */
  clearNavigationHistory(havrutaId: string): void {
    this.navigationHistory.delete(havrutaId)
  }

  /**
   * Sync progress update across participants
   */
  async syncProgressUpdate(
    havrutaId: string, 
    userId: string, 
    section: string, 
    sectionsCompleted: string[]
  ): Promise<void> {
    try {
      // Update user progress in database
      await prisma.progress.upsert({
        where: {
          userId_havrutaId: {
            userId,
            havrutaId
          }
        },
        update: {
          lastSection: section,
          sectionsCompleted,
          updatedAt: new Date()
        },
        create: {
          userId,
          havrutaId,
          lastSection: section,
          sectionsCompleted,
          totalTimeStudied: 0
        }
      })

      // Broadcast progress update
      this.websocketService.broadcastToRoom(havrutaId, 'progress-updated', {
        userId,
        section,
        sectionsCompleted,
        timestamp: new Date().toISOString()
      })

      console.log(`Progress synced for user ${userId} in ${havrutaId}: ${section}`)
    } catch (error) {
      console.error('Error syncing progress update:', error)
      throw error
    }
  }

  /**
   * Sync session state (start/pause/resume/end)
   */
  async syncSessionState(
    havrutaId: string, 
    state: 'started' | 'paused' | 'resumed' | 'ended',
    triggeredBy: { id: string; name: string }
  ): Promise<void> {
    try {
      const stateEvent = {
        havrutaId,
        state,
        triggeredBy,
        timestamp: new Date().toISOString()
      }

      // Update database if session ended
      if (state === 'ended') {
        await prisma.havruta.update({
          where: { id: havrutaId },
          data: { 
            isActive: false,
            lastStudiedAt: new Date()
          }
        })
      }

      // Broadcast state change
      this.websocketService.broadcastToRoom(havrutaId, 'session-state-changed', stateEvent)

      console.log(`Session state synced in ${havrutaId}: ${state} by ${triggeredBy.name}`)
    } catch (error) {
      console.error('Error syncing session state:', error)
      throw error
    }
  }

  /**
   * Clean up sync data for inactive sessions
   */
  cleanupInactiveSessions(): void {
    const activeRooms = this.websocketService.getActiveRooms()
    
    // Remove navigation history for rooms that no longer exist
    for (const havrutaId of this.navigationHistory.keys()) {
      if (!activeRooms.has(havrutaId)) {
        this.navigationHistory.delete(havrutaId)
        console.log(`Cleaned up navigation history for inactive session: ${havrutaId}`)
      }
    }
  }
}