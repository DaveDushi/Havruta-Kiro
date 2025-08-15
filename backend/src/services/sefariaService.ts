import axios, { AxiosInstance, AxiosError } from 'axios'
import {
  SefariaText,
  SefariaIndex,
  SefariaTextStructure,
  SefariaSearchResult,
  SefariaLink,
  SefariaApiError,
  CachedSefariaData
} from '../types/sefaria'

export class SefariaService {
  private readonly httpClient: AxiosInstance
  private readonly cache: Map<string, CachedSefariaData<any>>
  private readonly baseUrl: string
  private readonly defaultTtl: number
  private readonly maxRetries: number
  private readonly retryDelay: number

  constructor() {
    this.baseUrl = process.env.SEFARIA_API_URL || 'https://www.sefaria.org/api'
    this.defaultTtl = parseInt(process.env.SEFARIA_CACHE_TTL || '300000') // 5 minutes default
    this.maxRetries = parseInt(process.env.SEFARIA_MAX_RETRIES || '3')
    this.retryDelay = parseInt(process.env.SEFARIA_RETRY_DELAY || '1000') // 1 second default
    
    this.cache = new Map()
    
    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      timeout: 10000, // 10 second timeout
      headers: {
        'User-Agent': 'Havruta-Platform/1.0',
        'Accept': 'application/json'
      }
    })

    // Add response interceptor for error handling
    this.httpClient.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response?.data) {
          const sefariaError = error.response.data as SefariaApiError
          const errorMessage = `Sefaria API Error: ${sefariaError.error || sefariaError.message || 'Unknown error'}`
          const newError = new Error(errorMessage)
          newError.name = 'SefariaApiError'
          throw newError
        }
        throw error
      }
    )
  }

  /**
   * Get index of all available texts
   */
  async getIndex(): Promise<SefariaIndex[]> {
    const cacheKey = 'index'
    const cached = this.getFromCache<SefariaIndex[]>(cacheKey)
    
    if (cached) {
      return cached
    }

    const data = await this.makeRequestWithRetry<SefariaIndex[]>('/index')
    this.setCache(cacheKey, data, this.defaultTtl * 2) // Cache index for longer
    
    return data
  }

  /**
   * Get specific text content by reference (e.g., "Genesis 1:1-3")
   */
  async getText(ref: string): Promise<SefariaText> {
    if (!ref || ref.trim() === '') {
      throw new Error('Text reference cannot be empty')
    }

    const cacheKey = `text:${ref}`
    const cached = this.getFromCache<SefariaText>(cacheKey)
    
    if (cached) {
      return cached
    }

    const encodedRef = encodeURIComponent(ref)
    const data = await this.makeRequestWithRetry<SefariaText>(`/texts/${encodedRef}`)
    this.setCache(cacheKey, data)
    
    return data
  }

  /**
   * Get text structure and table of contents
   */
  async getTextStructure(title: string): Promise<SefariaTextStructure> {
    if (!title || title.trim() === '') {
      throw new Error('Text title cannot be empty')
    }

    const cacheKey = `structure:${title}`
    const cached = this.getFromCache<SefariaTextStructure>(cacheKey)
    
    if (cached) {
      return cached
    }

    const encodedTitle = encodeURIComponent(title)
    const data = await this.makeRequestWithRetry<SefariaTextStructure>(`/index/titles/${encodedTitle}`)
    this.setCache(cacheKey, data, this.defaultTtl * 2) // Cache structure for longer
    
    return data
  }

  /**
   * Search texts
   */
  async searchTexts(query: string, limit: number = 20): Promise<SefariaSearchResult[]> {
    if (!query || query.trim() === '') {
      throw new Error('Search query cannot be empty')
    }

    const cacheKey = `search:${query}:${limit}`
    const cached = this.getFromCache<SefariaSearchResult[]>(cacheKey)
    
    if (cached) {
      return cached
    }

    const params = new URLSearchParams({
      q: query,
      limit: limit.toString()
    })

    const data = await this.makeRequestWithRetry<SefariaSearchResult[]>(`/search-wrapper?${params}`)
    this.setCache(cacheKey, data, this.defaultTtl / 2) // Cache searches for shorter time
    
    return data
  }

  /**
   * Get links between texts
   */
  async getLinks(ref: string): Promise<SefariaLink[]> {
    if (!ref || ref.trim() === '') {
      throw new Error('Text reference cannot be empty')
    }

    const cacheKey = `links:${ref}`
    const cached = this.getFromCache<SefariaLink[]>(cacheKey)
    
    if (cached) {
      return cached
    }

    const encodedRef = encodeURIComponent(ref)
    const data = await this.makeRequestWithRetry<SefariaLink[]>(`/links/${encodedRef}`)
    this.setCache(cacheKey, data)
    
    return data
  }

  /**
   * Make HTTP request with retry logic
   */
  private async makeRequestWithRetry<T>(endpoint: string, retryCount: number = 0): Promise<T> {
    try {
      const response = await this.httpClient.get<T>(endpoint)
      return response.data
    } catch (error) {
      if (retryCount < this.maxRetries) {
        console.warn(`Sefaria API request failed, retrying (${retryCount + 1}/${this.maxRetries}):`, error)
        
        // Exponential backoff
        const delay = this.retryDelay * Math.pow(2, retryCount)
        await this.sleep(delay)
        
        return this.makeRequestWithRetry<T>(endpoint, retryCount + 1)
      }
      
      console.error('Sefaria API request failed after all retries:', error)
      throw error
    }
  }

  /**
   * Get data from cache if not expired
   */
  private getFromCache<T>(key: string): T | null {
    const cached = this.cache.get(key)
    
    if (!cached) {
      return null
    }

    const now = Date.now()
    if (now - cached.timestamp > cached.ttl) {
      this.cache.delete(key)
      return null
    }

    return cached.data as T
  }

  /**
   * Set data in cache with TTL
   */
  private setCache<T>(key: string, data: T, ttl: number = this.defaultTtl): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    })
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.cache.clear()
  }

  /**
   * Clear expired cache entries
   */
  clearExpiredCache(): void {
    const now = Date.now()
    
    for (const [key, cached] of this.cache.entries()) {
      if (now - cached.timestamp > cached.ttl) {
        this.cache.delete(key)
      }
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    }
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

export const sefariaService = new SefariaService()