import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { SefariaText, SefariaIndex, SefariaTextStructure } from '../types/sefaria'

// Mock axios
vi.mock('axios', () => ({
  default: {
    create: vi.fn()
  }
}))

// Mock environment variables
const originalEnv = process.env
beforeEach(() => {
  process.env = {
    ...originalEnv,
    SEFARIA_API_URL: 'https://test.sefaria.org/api',
    SEFARIA_CACHE_TTL: '60000',
    SEFARIA_MAX_RETRIES: '2',
    SEFARIA_RETRY_DELAY: '100'
  }
})

afterEach(() => {
  process.env = originalEnv
  vi.clearAllMocks()
})

describe('SefariaService', () => {
  let sefariaService: any
  let mockAxiosInstance: any
  let mockedAxios: any
  let SefariaService: any

  beforeEach(async () => {
    mockAxiosInstance = {
      get: vi.fn(),
      interceptors: {
        response: {
          use: vi.fn()
        }
      }
    }

    // Import axios after mocking
    const axios = await import('axios')
    mockedAxios = vi.mocked(axios.default)
    mockedAxios.create.mockReturnValue(mockAxiosInstance)

    // Import SefariaService after setting up mocks
    const sefariaModule = await import('../services/sefariaService')
    SefariaService = sefariaModule.SefariaService
    sefariaService = new SefariaService()
  })

  describe('constructor', () => {
    it('should initialize with default values when env vars are not set', () => {
      process.env = {}
      const service = new SefariaService()
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: 'https://www.sefaria.org/api',
        timeout: 10000,
        headers: {
          'User-Agent': 'Havruta-Platform/1.0',
          'Accept': 'application/json'
        }
      })
    })

    it('should use environment variables when provided', () => {
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: 'https://test.sefaria.org/api',
        timeout: 10000,
        headers: {
          'User-Agent': 'Havruta-Platform/1.0',
          'Accept': 'application/json'
        }
      })
    })
  })

  describe('getIndex', () => {
    const mockIndexData: SefariaIndex[] = [
      {
        title: 'Genesis',
        heTitle: 'בראשית',
        categories: ['Tanakh', 'Torah'],
        primary_category: 'Tanakh',
        enDesc: 'The first book of the Torah',
        compDate: '-1000',
        era: 'Tannaitic'
      },
      {
        title: 'Exodus',
        heTitle: 'שמות',
        categories: ['Tanakh', 'Torah'],
        primary_category: 'Tanakh',
        enDesc: 'The second book of the Torah',
        compDate: '-1000',
        era: 'Tannaitic'
      }
    ]

    it('should fetch index data successfully', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({ data: mockIndexData })

      const result = await sefariaService.getIndex()

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/v2/index')
      expect(result).toEqual(mockIndexData)
    })

    it('should return cached data on subsequent calls', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({ data: mockIndexData })

      // First call
      const result1 = await sefariaService.getIndex()
      // Second call
      const result2 = await sefariaService.getIndex()

      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1)
      expect(result1).toEqual(mockIndexData)
      expect(result2).toEqual(mockIndexData)
    })

    it('should retry on failure and eventually succeed', async () => {
      mockAxiosInstance.get
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ data: mockIndexData })

      const result = await sefariaService.getIndex()

      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(2)
      expect(result).toEqual(mockIndexData)
    })

    it('should throw error after max retries', async () => {
      const error = new Error('Persistent network error')
      mockAxiosInstance.get.mockRejectedValue(error)

      await expect(sefariaService.getIndex()).rejects.toThrow('Persistent network error')
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(3) // Initial + 2 retries
    })
  })

  describe('getText', () => {
    const mockTextData: SefariaText = {
      ref: 'Genesis 1:1',
      heRef: 'בראשית א׳:א׳',
      text: ['In the beginning God created the heaven and the earth.'],
      he: ['בְּרֵאשִׁית בָּרָא אֱלֹהִים אֵת הַשָּׁמַיִם וְאֵת הָאָרֶץ׃'],
      versions: [{
        title: 'Genesis',
        versionTitle: 'The Contemporary Torah, Jewish Publication Society, 2006',
        status: 'locked',
        priority: 3.0
      }],
      textDepth: 2,
      sectionNames: ['Chapter', 'Verse'],
      addressTypes: ['Integer', 'Integer']
    }

    it('should fetch text data successfully', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({ data: mockTextData })

      const result = await sefariaService.getText('Genesis 1:1')

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/v3/texts/Genesis%201%3A1')
      expect(result).toEqual(mockTextData)
    })

    it('should throw error for empty reference', async () => {
      await expect(sefariaService.getText('')).rejects.toThrow('Text reference cannot be empty')
      await expect(sefariaService.getText('   ')).rejects.toThrow('Text reference cannot be empty')
    })

    it('should return cached data on subsequent calls', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({ data: mockTextData })

      const result1 = await sefariaService.getText('Genesis 1:1')
      const result2 = await sefariaService.getText('Genesis 1:1')

      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1)
      expect(result1).toEqual(mockTextData)
      expect(result2).toEqual(mockTextData)
    })

    it('should handle URL encoding correctly', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({ data: mockTextData })

      await sefariaService.getText('Genesis 1:1-3')

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/v3/texts/Genesis%201%3A1-3')
    })
  })

  describe('getTextStructure', () => {
    const mockStructureData: SefariaTextStructure = {
      title: 'Genesis',
      heTitle: 'בראשית',
      titleVariants: ['Gen', 'Bereshit'],
      heTitleVariants: ['בר׳', 'בראשית'],
      sectionNames: ['Chapter', 'Verse'],
      depth: 2,
      addressTypes: ['Integer', 'Integer'],
      textDepth: 2,
      categories: ['Tanakh', 'Torah'],
      order: [1],
      schema: {
        nodeType: 'JaggedArrayNode',
        depth: 2,
        addressTypes: ['Integer', 'Integer'],
        sectionNames: ['Chapter', 'Verse'],
        titles: [
          { text: 'Genesis', lang: 'en', primary: true },
          { text: 'בראשית', lang: 'he', primary: true }
        ]
      }
    }

    it('should fetch text structure successfully', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({ data: mockStructureData })

      const result = await sefariaService.getTextStructure('Genesis')

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/v2/index/Genesis')
      expect(result).toEqual(mockStructureData)
    })

    it('should throw error for empty title', async () => {
      await expect(sefariaService.getTextStructure('')).rejects.toThrow('Text title cannot be empty')
      await expect(sefariaService.getTextStructure('   ')).rejects.toThrow('Text title cannot be empty')
    })

    it('should return cached data on subsequent calls', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({ data: mockStructureData })

      const result1 = await sefariaService.getTextStructure('Genesis')
      const result2 = await sefariaService.getTextStructure('Genesis')

      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1)
      expect(result1).toEqual(mockStructureData)
      expect(result2).toEqual(mockStructureData)
    })
  })

  describe('searchTexts', () => {
    const mockSearchResults = [
      {
        ref: 'Genesis 1:1',
        heRef: 'בראשית א׳:א׳',
        version: 'The Contemporary Torah, Jewish Publication Society, 2006',
        content: 'In the beginning God created the heaven and the earth.',
        highlight: ['beginning', 'created'],
        type: 'text'
      }
    ]

    it('should search texts successfully', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({ data: mockSearchResults })

      const result = await sefariaService.searchTexts('beginning')

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/search-wrapper?q=beginning&limit=20')
      expect(result).toEqual(mockSearchResults)
    })

    it('should throw error for empty query', async () => {
      await expect(sefariaService.searchTexts('')).rejects.toThrow('Search query cannot be empty')
      await expect(sefariaService.searchTexts('   ')).rejects.toThrow('Search query cannot be empty')
    })

    it('should handle custom limit parameter', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({ data: mockSearchResults })

      await sefariaService.searchTexts('beginning', 10)

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/search-wrapper?q=beginning&limit=10')
    })
  })

  describe('getLinks', () => {
    const mockLinksData = [
      {
        _id: 'link123',
        refs: ['Genesis 1:1', 'Rashi on Genesis 1:1:1'],
        anchorRef: 'Genesis 1:1',
        sourceRef: 'Rashi on Genesis 1:1:1',
        sourceHeRef: 'רש״י על בראשית א׳:א׳:א׳',
        anchorVerse: 1,
        type: 'commentary',
        auto: false
      }
    ]

    it('should fetch links successfully', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({ data: mockLinksData })

      const result = await sefariaService.getLinks('Genesis 1:1')

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/links/Genesis%201%3A1')
      expect(result).toEqual(mockLinksData)
    })

    it('should throw error for empty reference', async () => {
      await expect(sefariaService.getLinks('')).rejects.toThrow('Text reference cannot be empty')
    })
  })

  describe('cache management', () => {
    it('should clear all cache', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: [] })
      
      await sefariaService.getIndex()
      expect(sefariaService.getCacheStats().size).toBe(1)
      
      sefariaService.clearCache()
      expect(sefariaService.getCacheStats().size).toBe(0)
    })

    it('should return cache statistics', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: [] })
      
      await sefariaService.getIndex()
      await sefariaService.getText('Genesis 1:1')
      
      const stats = sefariaService.getCacheStats()
      expect(stats.size).toBe(2)
      expect(stats.keys).toContain('index')
      expect(stats.keys).toContain('text:Genesis 1:1')
    })

    it('should expire cache entries after TTL', async () => {
      // Set very short TTL for testing
      process.env.SEFARIA_CACHE_TTL = '1'
      const shortTtlService = new SefariaService()
      
      mockAxiosInstance.get.mockResolvedValue({ data: [] })
      
      await shortTtlService.getIndex()
      expect(shortTtlService.getCacheStats().size).toBe(1)
      
      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 10))
      
      // This should make a new request since cache expired
      await shortTtlService.getIndex()
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(2)
    })
  })

  describe('error handling', () => {
    it('should handle axios errors with Sefaria error response', async () => {
      const sefariaError = new Error('Sefaria API Error: Text not found')
      sefariaError.name = 'SefariaApiError'
      
      mockAxiosInstance.get.mockRejectedValue(sefariaError)
      
      await expect(sefariaService.getText('NonExistent 1:1')).rejects.toThrow('Sefaria API Error: Text not found')
    })

    it('should handle network errors', async () => {
      const networkError = new Error('Network Error')
      mockAxiosInstance.get.mockRejectedValue(networkError)
      
      await expect(sefariaService.getText('Genesis 1:1')).rejects.toThrow('Network Error')
    })
  })
})