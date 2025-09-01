import { useState, useEffect, useCallback } from 'react'
import { Havruta, Session } from '../types'
import { havrutaService } from '../services/havrutaService'
import { sessionService } from '../services/sessionService'
import { schedulingService } from '../services/schedulingService'
import { userService } from '../services/userService'

interface DashboardData {
  havrutot: Havruta[]
  activeSessions: Session[]
  upcomingSessions: Array<{
    id: string
    havrutaId: string
    havrutaName: string
    bookTitle: string
    currentSection: string
    startTime: Date
    isRecurring: boolean
    participants: Array<{
      user: {
        id: string
        name: string
        email: string
      }
    }>
  }>
  nextSession: {
    id: string
    name: string
    scheduledTime: Date
    currentSection: string
  } | null
  statistics: {
    totalHavrutot: number
    totalSessions: number
    activeHavrutot: number
    totalStudyPartners: number
  }
  isLoading: boolean
  error: string | null
}

interface UseDashboardDataReturn extends DashboardData {
  refetch: () => Promise<void>
  joinHavruta: (havrutaId: string) => Promise<void>
  scheduleSession: (havrutaId: string) => Promise<void>
  createHavruta: (data: {
    name: string
    bookId: string
    bookTitle: string
    currentSection?: string
  }) => Promise<void>
}

export const useDashboardData = (): UseDashboardDataReturn => {
  const [data, setData] = useState<DashboardData>({
    havrutot: [],
    activeSessions: [],
    upcomingSessions: [],
    nextSession: null,
    statistics: {
      totalHavrutot: 0,
      totalSessions: 0,
      activeHavrutot: 0,
      totalStudyPartners: 0,
    },
    isLoading: true,
    error: null,
  })

  const fetchDashboardData = useCallback(async () => {
    try {
      setData(prev => ({ ...prev, isLoading: true, error: null }))

      // Check if user is authenticated
      const token = localStorage.getItem('authToken')
      if (!token) {
        // If not authenticated, show empty state
        setData({
          havrutot: [],
          activeSessions: [],
          upcomingSessions: [],
          nextSession: null,
          statistics: {
            totalHavrutot: 0,
            totalSessions: 0,
            activeHavrutot: 0,
            totalStudyPartners: 0,
          },
          isLoading: false,
          error: null,
        })
        return
      }

      // Fetch all data in parallel
      const [
        havrutotResponse,
        upcomingSessionsResponse,
        summaryResponse
      ] = await Promise.all([
        havrutaService.getUserHavrutot({ limit: 50 }).catch(() => ({ havrutot: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } })),
        schedulingService.getUpcomingSessions(7).catch((error) => {
          console.error('❌ Failed to fetch upcoming sessions:', error)
          return { sessions: [], dateRange: { start: '', end: '' } }
        }),
        userService.getHavrutotSummary().catch(() => ({ summary: null }))
      ])

      const havrutot = havrutotResponse.havrutot || []
      
      // For each Havruta, check if there's an active session
      const activeSessionsPromises = havrutot.map(async (havruta) => {
        try {
          const activeSession = await sessionService.getActiveSessionForHavruta(havruta.id)
          return activeSession
        } catch (error) {
          // If no active session or error, return null
          return null
        }
      })
      
      const activeSessionsResults = await Promise.all(activeSessionsPromises)
      const activeSessions = activeSessionsResults.filter(session => session !== null) as Session[]
      const rawUpcomingSessions = upcomingSessionsResponse.sessions || []

      console.log('📊 Dashboard data fetched:', {
        havrutot: havrutot.length,
        activeSessions: activeSessions.length,
        rawUpcomingSessions: rawUpcomingSessions.length,
        upcomingSessionsResponse
      })

      // Transform upcoming sessions to include Havruta info
      const upcomingSessions = rawUpcomingSessions.map(session => ({
        id: session.id,
        havrutaId: session.havruta.id,
        havrutaName: session.havruta.name,
        bookTitle: session.havruta.bookTitle,
        currentSection: session.havruta.currentSection,
        startTime: new Date(session.startTime),
        isRecurring: session.isRecurring || false,
        participants: session.participants || []
      }))

      // Calculate statistics
      const totalHavrutot = havrutot.length
      const activeHavrutot = havrutot.filter(h => h.isActive).length
      const totalSessions = havrutot.reduce((sum, h) => sum + h.totalSessions, 0)
      
      // Calculate unique study partners
      const allParticipants = new Set<string>()
      havrutot.forEach(h => {
        h.participants.forEach(p => allParticipants.add(p.user.id))
      })
      const totalStudyPartners = allParticipants.size

      // Find next scheduled session from upcoming sessions
      const nextSession = upcomingSessions.length > 0 ? {
        id: upcomingSessions[0].havrutaId, // Use havruta ID for joining
        name: upcomingSessions[0].havrutaName,
        scheduledTime: upcomingSessions[0].startTime,
        currentSection: upcomingSessions[0].currentSection,
      } : null

      setData({
        havrutot,
        activeSessions,
        upcomingSessions,
        nextSession,
        statistics: {
          totalHavrutot,
          totalSessions,
          activeHavrutot,
          totalStudyPartners,
        },
        isLoading: false,
        error: null,
      })
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
      
      // If there's an authentication error, show empty state
      if (error instanceof Error && error.message.includes('401')) {
        setData({
          havrutot: [],
          activeSessions: [],
          upcomingSessions: [],
          nextSession: null,
          statistics: {
            totalHavrutot: 0,
            totalSessions: 0,
            activeHavrutot: 0,
            totalStudyPartners: 0,
          },
          isLoading: false,
          error: 'Please log in to view your Havrutot',
        })
      } else {
        setData(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to load dashboard data',
        }))
      }
    }
  }, [])

  const joinHavruta = useCallback(async (havrutaId: string) => {
    try {
      // Check if there's an active session for this Havruta
      const activeSession = await sessionService.getActiveSessionForHavruta(havrutaId)
      
      if (activeSession) {
        // Join the existing session
        await sessionService.joinSession(activeSession.id)
      } else {
        // Initialize a new session
        const newSession = await sessionService.initializeSession({ havrutaId })
        await sessionService.joinSession(newSession.id)
      }
      
      // Refresh data
      await fetchDashboardData()
    } catch (error) {
      console.error('Error joining Havruta:', error)
      throw error
    }
  }, [fetchDashboardData])

  const scheduleSession = useCallback(async (havrutaId: string) => {
    try {
      // Use the proper scheduling service to schedule a session
      await schedulingService.quickScheduleSession(havrutaId)
      await fetchDashboardData()
    } catch (error) {
      console.error('Error scheduling session:', error)
      throw error
    }
  }, [fetchDashboardData])

  const createHavruta = useCallback(async (data: {
    name: string
    bookId: string
    bookTitle: string
    currentSection?: string
  }) => {
    try {
      await havrutaService.createHavruta(data)
      await fetchDashboardData() // Refresh the data
    } catch (error) {
      console.error('Error creating Havruta:', error)
      throw error
    }
  }, [fetchDashboardData])

  useEffect(() => {
    fetchDashboardData()
  }, [fetchDashboardData])

  return {
    ...data,
    refetch: fetchDashboardData,
    joinHavruta,
    scheduleSession,
    createHavruta,
  }
}