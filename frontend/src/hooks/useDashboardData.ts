import { useState, useEffect, useCallback } from 'react'
import { Havruta, Session } from '../types'
import { havrutaService } from '../services/havrutaService'
import { sessionService } from '../services/sessionService'
import { userService } from '../services/userService'

interface DashboardData {
  havrutot: Havruta[]
  activeSessions: Session[]
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
        activeSessionsResponse,
        summaryResponse
      ] = await Promise.all([
        havrutaService.getUserHavrutot({ limit: 50 }).catch(() => ({ havrutot: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } })),
        sessionService.getActiveSessions().catch(() => []),
        userService.getHavrutotSummary().catch(() => ({ summary: null }))
      ])

      const havrutot = havrutotResponse.havrutot || []
      const activeSessions = activeSessionsResponse || []

      // Calculate statistics
      const totalHavrutot = havrutot.length
      const activeHavrutot = havrutot.filter(h => h.isActive).length
      const totalSessions = havrutot.reduce((sum, h) => sum + h.totalSessions, 0)
      
      // Calculate unique study partners
      const allParticipants = new Set<string>()
      havrutot.forEach(h => {
        h.participants.forEach(p => allParticipants.add(p))
      })
      const totalStudyPartners = allParticipants.size

      // Find next scheduled session (mock for now - would need scheduling data)
      const nextSession = havrutot.length > 0 ? {
        id: havrutot[0].id,
        name: havrutot[0].name,
        scheduledTime: new Date(Date.now() + 3600000), // 1 hour from now
        currentSection: havrutot[0].currentSection,
      } : null

      setData({
        havrutot,
        activeSessions,
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
      // For now, just initialize a session (scheduling would be more complex)
      await sessionService.initializeSession({ havrutaId })
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