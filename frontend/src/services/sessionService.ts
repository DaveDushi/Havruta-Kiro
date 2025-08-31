import { Session } from '../types'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

class SessionService {
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

  async getActiveSessions(): Promise<Session[]> {
    return this.makeRequest<Session[]>('/sessions/active')
  }

  async getSessionById(id: string): Promise<Session> {
    return this.makeRequest<Session>(`/sessions/${id}`)
  }

  async initializeSession(data: {
    havrutaId: string
    startTime?: Date
  }): Promise<Session> {
    return this.makeRequest<Session>('/sessions', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async joinSession(id: string): Promise<void> {
    await this.makeRequest<void>(`/sessions/${id}/join`, {
      method: 'POST',
    })
  }

  async leaveSession(id: string): Promise<void> {
    await this.makeRequest<void>(`/sessions/${id}/leave`, {
      method: 'POST',
    })
  }

  async endSession(id: string, endingSection: string, coverageRange?: string): Promise<void> {
    await this.makeRequest<void>(`/sessions/${id}/end`, {
      method: 'POST',
      body: JSON.stringify({ endingSection, coverageRange }),
    })
  }

  async getActiveSessionForHavruta(havrutaId: string): Promise<Session | null> {
    try {
      return await this.makeRequest<Session>(`/sessions/havruta/${havrutaId}/active`)
    } catch (error) {
      // If no active session found, return null
      if (error instanceof Error && error.message.includes('No active session found')) {
        return null
      }
      throw error
    }
  }

  async getHavrutaSessionHistory(havrutaId: string): Promise<Session[]> {
    return this.makeRequest<Session[]>(`/sessions/havruta/${havrutaId}/history`)
  }

  async updateSessionProgress(id: string, sectionsStudied: string[]): Promise<void> {
    await this.makeRequest<void>(`/sessions/${id}/progress`, {
      method: 'PUT',
      body: JSON.stringify({ sectionsStudied }),
    })
  }

  async getSessionState(id: string): Promise<any> {
    return this.makeRequest<any>(`/sessions/${id}/state`)
  }

  async createInstantSession(havrutaId: string): Promise<Session> {
    return this.makeRequest<Session>('/sessions/instant', {
      method: 'POST',
      body: JSON.stringify({ havrutaId }),
    })
  }

  async joinInstantSession(sessionId: string): Promise<{
    participant: any
    session: Session
    redirectUrl: string
  }> {
    return this.makeRequest<{
      participant: any
      session: Session
      redirectUrl: string
    }>(`/sessions/${sessionId}/join-instant`, {
      method: 'POST',
    })
  }
}

export const sessionService = new SessionService()