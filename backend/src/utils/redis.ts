import { createClient, RedisClientType } from 'redis'
import { logger } from './logger'

export class RedisClient {
  private client: RedisClientType
  private isConnected: boolean = false

  constructor() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'

    this.client = createClient({
      url: redisUrl,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            logger.error('Redis reconnection failed after 10 attempts')
            return new Error('Redis reconnection failed')
          }
          return Math.min(retries * 50, 1000)
        }
      }
    })

    this.setupEventHandlers()
  }

  private setupEventHandlers(): void {
    this.client.on('connect', () => {
      logger.info('Redis client connecting...')
    })

    this.client.on('ready', () => {
      this.isConnected = true
      logger.info('Redis client connected and ready')
    })

    this.client.on('error', (error) => {
      this.isConnected = false
      logger.error('Redis client error:', error)
    })

    this.client.on('end', () => {
      this.isConnected = false
      logger.info('Redis client connection ended')
    })
  }

  async connect(): Promise<void> {
    try {
      if (!this.isConnected) {
        await this.client.connect()
      }
    } catch (error) {
      logger.error('Failed to connect to Redis:', error)
      throw error
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.isConnected) {
        await this.client.disconnect()
        this.isConnected = false
      }
    } catch (error) {
      logger.error('Failed to disconnect from Redis:', error)
      throw error
    }
  }

  getClient(): RedisClientType {
    return this.client
  }

  isReady(): boolean {
    return this.isConnected
  }

  // Room management methods
  async addToRoom(roomId: string, userId: string, userData: any): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Redis client not connected')
    }

    const key = `room:${roomId}:participants`
    await this.client.hSet(key, userId, JSON.stringify({
      ...userData,
      joinedAt: new Date().toISOString()
    }))

    // Set room expiration (24 hours)
    await this.client.expire(key, 24 * 60 * 60)
  }

  async removeFromRoom(roomId: string, userId: string): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Redis client not connected')
    }

    const key = `room:${roomId}:participants`
    await this.client.hDel(key, userId)
  }

  async getRoomParticipants(roomId: string): Promise<Record<string, any>> {
    if (!this.isConnected) {
      throw new Error('Redis client not connected')
    }

    const key = `room:${roomId}:participants`
    const participants = await this.client.hGetAll(key)

    // Parse JSON data for each participant
    const parsedParticipants: Record<string, any> = {}
    for (const [userId, data] of Object.entries(participants)) {
      try {
        parsedParticipants[userId] = JSON.parse(data)
      } catch (error) {
        logger.error(`Failed to parse participant data for user ${userId}:`, error)
      }
    }

    return parsedParticipants
  }

  async getRoomParticipantCount(roomId: string): Promise<number> {
    if (!this.isConnected) {
      throw new Error('Redis client not connected')
    }

    const key = `room:${roomId}:participants`
    return await this.client.hLen(key)
  }

  async setRoomState(roomId: string, state: any): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Redis client not connected')
    }

    const key = `room:${roomId}:state`
    await this.client.set(key, JSON.stringify({
      ...state,
      lastActivity: new Date().toISOString()
    }), { EX: 24 * 60 * 60 }) // 24 hour expiration
  }

  async getRoomState(roomId: string): Promise<any | null> {
    if (!this.isConnected) {
      throw new Error('Redis client not connected')
    }

    const key = `room:${roomId}:state`
    const state = await this.client.get(key)

    if (!state) {
      return null
    }

    try {
      return JSON.parse(state)
    } catch (error) {
      logger.error(`Failed to parse room state for room ${roomId}:`, error)
      return null
    }
  }

  async deleteRoom(roomId: string): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Redis client not connected')
    }

    const participantsKey = `room:${roomId}:participants`
    const stateKey = `room:${roomId}:state`

    await Promise.all([
      this.client.del(participantsKey),
      this.client.del(stateKey)
    ])
  }

  async getActiveRooms(): Promise<string[]> {
    if (!this.isConnected) {
      throw new Error('Redis client not connected')
    }

    const keys = await this.client.keys('room:*:participants')
    return keys.map(key => {
      const match = key.match(/^room:(.+):participants$/)
      return match ? match[1] : null
    }).filter(Boolean) as string[]
  }

  async cleanupEmptyRooms(): Promise<number> {
    if (!this.isConnected) {
      throw new Error('Redis client not connected')
    }

    const roomIds = await this.getActiveRooms()
    let cleanedCount = 0

    for (const roomId of roomIds) {
      const participantCount = await this.getRoomParticipantCount(roomId)
      if (participantCount === 0) {
        await this.deleteRoom(roomId)
        cleanedCount++
      }
    }

    return cleanedCount
  }
}

// Create singleton instance
export const redisClient = new RedisClient()