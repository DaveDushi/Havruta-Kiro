import { Session } from '../types'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

export interface RecurrencePattern {
  frequency: 'once' | 'daily' | 'weekly' | 'bi-weekly' | 'monthly'
  interval: number
  endDate?: string
  daysOfWeek: number[]
}

export interface ScheduledSessionData {
  havrutaId: string
  startTime: string
  participantIds: string[]
  isRecurring: boolean
  recurrencePattern?: RecurrencePattern
}

export interface UpcomingSession extends Session {
  havruta: {
    id: string
    name: string
    bookTitle: string
    currentSection: string
  }
  participants: Array<{
    user: {
      id: string
      name: string
      email: string
    }
  }>
  recurrencePattern?: RecurrencePattern
}

class SchedulingService {
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = localStorage.getItem('authToken')
    
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
    }

    return response.json()
  }

  /**
   * Schedule a new session (single or recurring)
   */
  async scheduleSession(data: ScheduledSessionData): Promise<{
    message: string
    session?: Session
    sessions?: Session[]
    recurrencePatternId?: string
  }> {
    return this.makeRequest<{
      message: string
      session?: Session
      sessions?: Session[]
      recurrencePatternId?: string
    }>('/scheduling/sessions', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  /**
   * Get upcoming sessions for the current user
   */
  async getUpcomingSessions(days: number = 30): Promise<{
    sessions: UpcomingSession[]
    dateRange: {
      start: string
      end: string
    }
  }> {
    return this.makeRequest<{
      sessions: UpcomingSession[]
      dateRange: {
        start: string
        end: string
      }
    }>(`/scheduling/sessions/upcoming?days=${days}`)
  }

  /**
   * Reschedule an existing session
   */
  async rescheduleSession(
    sessionId: string, 
    newStartTime: string, 
    updateFutureInstances: boolean = false
  ): Promise<{
    message: string
    session: Session
  }> {
    return this.makeRequest<{
      message: string
      session: Session
    }>(`/scheduling/sessions/${sessionId}`, {
      method: 'PUT',
      body: JSON.stringify({
        startTime: newStartTime,
        updateFutureInstances
      }),
    })
  }

  /**
   * Cancel a session
   */
  async cancelSession(
    sessionId: string, 
    cancelFutureInstances: boolean = false
  ): Promise<{
    message: string
  }> {
    return this.makeRequest<{
      message: string
    }>(`/scheduling/sessions/${sessionId}`, {
      method: 'DELETE',
      body: JSON.stringify({
        cancelFutureInstances
      }),
    })
  }

  /**
   * Get recurrence pattern details
   */
  async getRecurrencePattern(patternId: string): Promise<{
    pattern: RecurrencePattern
  }> {
    return this.makeRequest<{
      pattern: RecurrencePattern
    }>(`/scheduling/patterns/${patternId}`)
  }

  /**
   * Update a recurrence pattern
   */
  async updateRecurrencePattern(
    patternId: string, 
    data: Partial<RecurrencePattern>
  ): Promise<{
    message: string
    pattern: RecurrencePattern
  }> {
    return this.makeRequest<{
      message: string
      pattern: RecurrencePattern
    }>(`/scheduling/patterns/${patternId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  /**
   * Delete a recurrence pattern
   */
  async deleteRecurrencePattern(patternId: string): Promise<{
    message: string
  }> {
    return this.makeRequest<{
      message: string
    }>(`/scheduling/patterns/${patternId}`, {
      method: 'DELETE',
    })
  }

  /**
   * Quick schedule a session for a Havruta (simplified version)
   */
  async quickScheduleSession(
    havrutaId: string, 
    startTime?: Date
  ): Promise<Session> {
    const sessionData: ScheduledSessionData = {
      havrutaId,
      startTime: (startTime || new Date()).toISOString(),
      participantIds: [], // Will use all Havruta participants
      isRecurring: false
    }

    const result = await this.scheduleSession(sessionData)
    return result.session!
  }
}

export const schedulingService = new SchedulingService()