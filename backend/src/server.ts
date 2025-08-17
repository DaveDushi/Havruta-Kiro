import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { createServer } from 'http'
import { Server } from 'socket.io'
import dotenv from 'dotenv'
import passport from './config/passport'
import { prisma } from './utils/database'
import { logger } from './utils/logger'
import { 
  errorHandler, 
  notFoundHandler, 
  requestIdMiddleware, 
  requestLoggingMiddleware,
  gracefulShutdown
} from './middleware/errorHandler'
import { WebSocketService } from './services/websocketService'
import { SyncService } from './services/syncService'
import { schedulingService } from './services/schedulingService'
import { monitoringService } from './services/monitoringService'
import authRoutes from './routes/auth'
import userRoutes from './routes/users'
import havrutotRoutes from './routes/havrutot'
import sessionRoutes from './routes/sessions'
import schedulingRoutes from './routes/scheduling'
import sefariaRoutes from './routes/sefaria'
import invitationRoutes from './routes/invitations'
import errorRoutes from './routes/errors'
import testAuthRoutes from '../test-auth-endpoint.js'

// Load environment variables
dotenv.config()

const app = express()
const server = createServer(app)
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
})

const PORT = process.env.PORT || 3001

// Middleware
app.use(helmet())
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}))

// Request ID and logging
app.use(requestIdMiddleware)
app.use(requestLoggingMiddleware)

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests from this IP, please try again later'
    }
  }
})
app.use(limiter)

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Initialize Passport
app.use(passport.initialize())

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/havrutot', havrutotRoutes)
app.use('/api/sessions', sessionRoutes)
app.use('/api/scheduling', schedulingRoutes)
app.use('/api/sefaria', sefariaRoutes)
app.use('/api/invitations', invitationRoutes)
app.use('/api/errors', errorRoutes)
app.use('/api/test', testAuthRoutes)

// Basic health check route
app.get('/api/health', async (req, res) => {
  try {
    const healthStatus = await monitoringService.getHealthStatus()
    
    logger.info('Health check completed', healthStatus, { requestId: req.requestId })
    
    const statusCode = healthStatus.status === 'healthy' ? 200 :
                      healthStatus.status === 'degraded' ? 200 : 503
    
    res.status(statusCode).json(healthStatus)
  } catch (error) {
    const healthStatus = {
      status: 'unhealthy',
      checks: {
        system: { status: 'fail', message: 'Health check system error' }
      },
      timestamp: new Date().toISOString()
    }
    
    logger.error('Health check system error', healthStatus, { 
      requestId: req.requestId, 
      error: error as Error 
    })
    
    res.status(503).json(healthStatus)
  }
})

// System metrics endpoint (for monitoring dashboards)
app.get('/api/metrics', async (req, res) => {
  try {
    const metrics = monitoringService.getLatestMetrics()
    
    if (!metrics) {
      return res.status(404).json({
        error: 'No metrics available yet'
      })
    }
    
    logger.info('Metrics requested', { metricsCount: 1 }, { requestId: req.requestId })
    res.json(metrics)
  } catch (error) {
    logger.error('Error retrieving metrics', {}, { 
      requestId: req.requestId, 
      error: error as Error 
    })
    
    res.status(500).json({
      error: 'Failed to retrieve metrics'
    })
  }
})

// Initialize WebSocket and Sync services
const websocketService = new WebSocketService(io)
const syncService = new SyncService(websocketService)

// Set sync service reference in websocket service
websocketService.setSyncService(syncService)

// Initialize background job system for scheduling
schedulingService.initializeBackgroundJobs()

// Cleanup inactive rooms and sync data every 30 minutes
setInterval(() => {
  websocketService.cleanupInactiveRooms(60)
  syncService.cleanupInactiveSessions()
}, 30 * 60 * 1000)

// Error handling middleware (must be last)
app.use(notFoundHandler)
app.use(errorHandler)

server.listen(PORT, () => {
  logger.info(`Server started successfully`, {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version
  })
})

// Setup graceful shutdown
gracefulShutdown(server)

// Handle uncaught exceptions and unhandled rejections
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception', { error: error.message, stack: error.stack }, { error })
  process.exit(1)
})

process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  logger.error('Unhandled Rejection', { 
    reason: reason?.message || reason, 
    promise: promise.toString() 
  }, { error: reason instanceof Error ? reason : new Error(String(reason)) })
  process.exit(1)
})