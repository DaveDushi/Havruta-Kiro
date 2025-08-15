import { Router, Request, Response } from 'express'
import { sefariaService } from '../services/sefariaService'
import { optionalAuth } from '../middleware/auth'

const router = Router()

/**
 * Get index of all available texts
 * GET /api/sefaria/index
 */
router.get('/index', optionalAuth, async (req: Request, res: Response) => {
  try {
    const index = await sefariaService.getIndex()
    res.json(index)
  } catch (error) {
    console.error('Error fetching Sefaria index:', error)
    res.status(500).json({ 
      error: 'Failed to fetch text index',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

/**
 * Get specific text content by reference
 * GET /api/sefaria/texts/:ref
 */
router.get('/texts/:ref', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { ref } = req.params
    
    console.log('Fetching text for ref:', ref)
    
    if (!ref) {
      return res.status(400).json({ error: 'Text reference is required' })
    }

    const decodedRef = decodeURIComponent(ref)
    console.log('Decoded ref:', decodedRef)
    
    const text = await sefariaService.getText(decodedRef)
    console.log('Successfully fetched text:', text.ref)
    res.json(text)
  } catch (error) {
    console.error('Error fetching Sefaria text:', error)
    res.status(500).json({ 
      error: 'Failed to fetch text',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

/**
 * Get text structure and table of contents
 * GET /api/sefaria/structure/:title
 */
router.get('/structure/:title', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { title } = req.params
    
    if (!title) {
      return res.status(400).json({ error: 'Text title is required' })
    }

    const structure = await sefariaService.getTextStructure(decodeURIComponent(title))
    res.json(structure)
  } catch (error) {
    console.error('Error fetching Sefaria text structure:', error)
    res.status(500).json({ 
      error: 'Failed to fetch text structure',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

/**
 * Search texts
 * GET /api/sefaria/search?q=query&limit=20
 */
router.get('/search', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { q: query, limit } = req.query
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Search query is required' })
    }

    const searchLimit = limit ? parseInt(limit as string, 10) : 20
    
    if (isNaN(searchLimit) || searchLimit < 1 || searchLimit > 100) {
      return res.status(400).json({ error: 'Limit must be a number between 1 and 100' })
    }

    const results = await sefariaService.searchTexts(query, searchLimit)
    res.json(results)
  } catch (error) {
    console.error('Error searching Sefaria texts:', error)
    res.status(500).json({ 
      error: 'Failed to search texts',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

/**
 * Get links between texts
 * GET /api/sefaria/links/:ref
 */
router.get('/links/:ref', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { ref } = req.params
    
    if (!ref) {
      return res.status(400).json({ error: 'Text reference is required' })
    }

    const links = await sefariaService.getLinks(decodeURIComponent(ref))
    res.json(links)
  } catch (error) {
    console.error('Error fetching Sefaria links:', error)
    res.status(500).json({ 
      error: 'Failed to fetch text links',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

/**
 * Get cache statistics (admin only)
 * GET /api/sefaria/cache/stats
 */
router.get('/cache/stats', optionalAuth, async (req: Request, res: Response) => {
  try {
    const stats = sefariaService.getCacheStats()
    res.json(stats)
  } catch (error) {
    console.error('Error fetching cache stats:', error)
    res.status(500).json({ 
      error: 'Failed to fetch cache statistics',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

/**
 * Clear cache (admin only)
 * DELETE /api/sefaria/cache
 */
router.delete('/cache', optionalAuth, async (req: Request, res: Response) => {
  try {
    sefariaService.clearCache()
    res.json({ message: 'Cache cleared successfully' })
  } catch (error) {
    console.error('Error clearing cache:', error)
    res.status(500).json({ 
      error: 'Failed to clear cache',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

export default router