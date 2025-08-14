import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { createServer } from 'http'
import { Server } from 'socket.io'
import dotenv from 'dotenv'
import passport from './config/passport'
import { prisma } from './utils/database'
import { WebSocketService } from './services/websocketService'
import { SyncService } from './services/syncService'
import authRoutes from './routes/auth'
import userRoutes from './routes/users'
import havrutotRoutes from './routes/havrutot'
import sessionRoutes from './routes/sessions'

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

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
})
app.use(limiter)

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Initialize Passport
app.use(passport.initialize())

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/havrutot', havrutotRoutes)
app.use('/api/sessions', sessionRoutes)

// Basic health check route
app.get('/api/health', async (_req, res) => {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      database: 'connected'
    })
  } catch (error) {
    res.status(503).json({ 
      status: 'error', 
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: 'Database connection failed'
    })
  }
})

// Initialize WebSocket and Sync services
const websocketService = new WebSocketService(io)
const syncService = new SyncService(websocketService)

// Set sync service reference in websocket service
websocketService.setSyncService(syncService)

// Cleanup inactive rooms and sync data every 30 minutes
setInterval(() => {
  websocketService.cleanupInactiveRooms(60)
  syncService.cleanupInactiveSessions()
}, 30 * 60 * 1000)

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})