import { Havruta } from '../types'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

class HavrutaService {
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

  async getUserHavrutot(params?: {
    page?: number
    limit?: number
    search?: string
    status?: 'active' | 'inactive' | 'all'
    sortBy?: 'name' | 'lastStudied' | 'sessions'
    sortOrder?: 'asc' | 'desc'
  }): Promise<{
    havrutot: Havruta[]
    pagination: {
      page: number
      limit: number
      total: number
      totalPages: number
    }
  }> {
    const searchParams = new URLSearchParams()
    
    if (params?.page) searchParams.append('page', params.page.toString())
    if (params?.limit) searchParams.append('limit', params.limit.toString())
    if (params?.search) searchParams.append('search', params.search)
    if (params?.status && params.status !== 'all') searchParams.append('status', params.status)
    if (params?.sortBy) searchParams.append('sortBy', params.sortBy)
    if (params?.sortOrder) searchParams.append('sortOrder', params.sortOrder)

    const queryString = searchParams.toString()
    const endpoint = `/havrutot${queryString ? `?${queryString}` : ''}`
    
    return this.makeRequest<{
      havrutot: Havruta[]
      pagination: {
        page: number
        limit: number
        total: number
        totalPages: number
      }
    }>(endpoint)
  }

  async getActiveHavrutot(): Promise<Havruta[]> {
    return this.makeRequest<Havruta[]>('/havrutot/active')
  }

  async getHavrutaById(id: string): Promise<Havruta> {
    return this.makeRequest<Havruta>(`/havrutot/${id}`)
  }

  async createHavruta(data: {
    name: string
    bookId: string
    bookTitle: string
    currentSection?: string
  }): Promise<Havruta> {
    return this.makeRequest<Havruta>('/havrutot', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateHavruta(id: string, data: Partial<Havruta>): Promise<Havruta> {
    return this.makeRequest<Havruta>(`/havrutot/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteHavruta(id: string): Promise<void> {
    await this.makeRequest<void>(`/havrutot/${id}`, {
      method: 'DELETE',
    })
  }

  async joinHavruta(id: string): Promise<void> {
    await this.makeRequest<void>(`/havrutot/${id}/join`, {
      method: 'POST',
    })
  }

  async leaveHavruta(id: string): Promise<void> {
    await this.makeRequest<void>(`/havrutot/${id}/leave`, {
      method: 'POST',
    })
  }

  async updateProgress(id: string, currentSection: string): Promise<void> {
    await this.makeRequest<void>(`/havrutot/${id}/progress`, {
      method: 'PUT',
      body: JSON.stringify({ currentSection }),
    })
  }

  async getHavrutaState(id: string): Promise<any> {
    return this.makeRequest<any>(`/havrutot/${id}/state`)
  }
}

export const havrutaService = new HavrutaService()