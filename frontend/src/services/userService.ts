import { User } from '../types'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

interface UserProfile extends User {
  statistics?: {
    totalHavrutot: number
    totalSessions: number
    activeHavrutot: number
    totalStudyPartners: number
    totalStudyTime: number
  }
}

interface HavrutotSummary {
  totalHavrutot: number
  activeHavrutot: number
  totalSessions: number
  totalStudyPartners: number
  recentActivity: {
    lastSessionDate?: Date
    upcomingSession?: {
      havrutaName: string
      scheduledTime: Date
    }
  }
}

class UserService {
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

  async getUserProfile(): Promise<{ user: UserProfile }> {
    return this.makeRequest<{ user: UserProfile }>('/users/profile')
  }

  async updateUserProfile(data: Partial<User>): Promise<{ user: UserProfile }> {
    return this.makeRequest<{ user: UserProfile }>('/users/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteUser(): Promise<void> {
    await this.makeRequest<void>('/users/profile', {
      method: 'DELETE',
    })
  }

  async getUserById(id: string): Promise<{ user: User }> {
    return this.makeRequest<{ user: User }>(`/users/${id}`)
  }

  async getHavrutotSummary(): Promise<{ summary: HavrutotSummary }> {
    return this.makeRequest<{ summary: HavrutotSummary }>('/users/profile/havrutot-summary')
  }
}

export const userService = new UserService()