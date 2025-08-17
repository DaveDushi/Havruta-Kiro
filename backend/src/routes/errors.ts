import { Router } from 'express'
import { z } from 'zod'
import { logger } from '../utils/logger'
import { asyncHandler, ValidationError } from '../middleware/errorHandler'
import { authenticateToken } from '../middleware/auth'

const router = Router()

// Error report schema
const errorReportSchema = z.object({
  message: z.string().min(1).max(1000),
  stack: z.string().optional(),
  componentStack: z.string().optional(),
  errorId: z.string().min(1).max(100),
  timestamp: z.string().datetime(),
  userAgent: z.string().max(500),
  url: z.string().url().max(500),
  userId: z.string().optional(),
  additionalInfo: z.record(z.any()).optional()
})

// Report client-side error
router.post('/report', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const errorData = errorReportSchema.parse(req.body)
    
    // Log the client-side error
    logger.error('Client-side error reported', {
      errorId: errorData.errorId,
      message: errorData.message,
      url: errorData.url,
      userAgent: errorData.userAgent,
      timestamp: errorData.timestamp,
      stack: errorData.stack,
      componentStack: errorData.componentStack,
      additionalInfo: errorData.additionalInfo
    }, {
      requestId: req.requestId,
      userId: req.user?.id || errorData.userId
    })

    // In a production environment, you might want to:
    // 1. Store error reports in a database for analysis
    // 2. Send to external error monitoring service (Sentry, Bugsnag, etc.)
    // 3. Trigger alerts for critical errors
    // 4. Generate error reports for the development team

    res.json({
      success: true,
      message: 'Error report received',
      errorId: errorData.errorId,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError('Invalid error report data')
    }
    throw error
  }
}))

// Get error statistics (for admin/monitoring purposes)
router.get('/stats', authenticateToken, asyncHandler(async (req, res) => {
  // This would typically query a database for error statistics
  // For now, return a placeholder response
  
  logger.info('Error statistics requested', {}, {
    requestId: req.requestId,
    userId: req.user?.id
  })

  res.json({
    message: 'Error statistics endpoint - not implemented yet',
    note: 'This would return error counts, trends, and other metrics'
  })
}))

export default router