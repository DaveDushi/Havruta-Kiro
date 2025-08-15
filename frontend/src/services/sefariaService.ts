import axios from 'axios'
import { SefariaText, SefariaIndex, SefariaTextStructure, SefariaSearchResult, SefariaLink } from '../types'

const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'

class SefariaService {
  private cache = new Map<string, any>()
  private readonly CACHE_TTL = 5 * 60 * 1000 // 5 minutes

  private getCacheKey(endpoint: string, params?: Record<string, any>): string {
    const paramString = params ? JSON.stringify(params) : ''
    return `${endpoint}${paramString}`
  }

  private async cachedRequest<T>(endpoint: string, params?: Record<string, any>): Promise<T> {
    const cacheKey = this.getCacheKey(endpoint, params)
    const cached = this.cache.get(cacheKey)
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data
    }

    try {
      const url = `${API_BASE}/api/sefaria${endpoint}`
      
      // Get auth token from localStorage (optional)
      const token = localStorage.getItem('token')
      const headers: Record<string, string> = {}
      
      if (token) {
        headers.Authorization = `Bearer ${token}`
      }

      const response = await axios.get(url, { 
        params,
        headers
      })
      const data = response.data

      this.cache.set(cacheKey, {
        data,
        timestamp: Date.now()
      })

      return data
    } catch (error) {
      console.error(`Backend Sefaria API error for ${endpoint}:`, error)
      throw new Error(`Failed to fetch data from backend: ${endpoint}`)
    }
  }

  async getIndex(): Promise<SefariaIndex[]> {
    return this.cachedRequest<SefariaIndex[]>('/index')
  }

  async getText(ref: string): Promise<SefariaText> {
    return this.cachedRequest<SefariaText>(`/texts/${encodeURIComponent(ref)}`)
  }

  async getTextStructure(title: string): Promise<SefariaTextStructure> {
    return this.cachedRequest<SefariaTextStructure>(`/structure/${encodeURIComponent(title)}`)
  }

  async searchTexts(query: string, limit: number = 20): Promise<SefariaSearchResult[]> {
    return this.cachedRequest<SefariaSearchResult[]>('/search', {
      q: query,
      limit
    })
  }

  async getLinks(ref: string): Promise<SefariaLink[]> {
    return this.cachedRequest<SefariaLink[]>(`/links/${encodeURIComponent(ref)}`)
  }

  // Helper method to parse text references
  parseRef(ref: string): { book: string, chapter?: number, verse?: number } {
    const parts = ref.split(' ')
    const book = parts[0]
    
    if (parts.length > 1) {
      const location = parts[1]
      const [chapter, verse] = location.split(':').map(Number)
      return { book, chapter, verse }
    }
    
    return { book }
  }

  // Helper method to build navigation references
  buildRef(book: string, chapter?: number, verse?: number): string {
    if (chapter && verse) {
      return `${book} ${chapter}:${verse}`
    } else if (chapter) {
      return `${book} ${chapter}`
    }
    return book
  }

  // Clear cache (useful for testing or memory management)
  clearCache(): void {
    this.cache.clear()
  }
}

export const sefariaService = new SefariaService()
export default sefariaService