import { createWriteStream, existsSync, mkdirSync } from 'fs'
import { join } from 'path'

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

export interface LogEntry {
  timestamp: string
  level: string
  message: string
  meta?: any
  requestId?: string
  userId?: string
  sessionId?: string
  error?: {
    name: string
    message: string
    stack?: string
  }
}

class Logger {
  private logLevel: LogLevel
  private logDir: string
  private logStreams: Map<string, NodeJS.WritableStream>

  constructor() {
    this.logLevel = this.getLogLevel()
    this.logDir = process.env.LOG_DIR || 'logs'
    this.logStreams = new Map()
    this.ensureLogDirectory()
  }

  private getLogLevel(): LogLevel {
    const level = process.env.LOG_LEVEL?.toUpperCase() || 'INFO'
    switch (level) {
      case 'ERROR': return LogLevel.ERROR
      case 'WARN': return LogLevel.WARN
      case 'INFO': return LogLevel.INFO
      case 'DEBUG': return LogLevel.DEBUG
      default: return LogLevel.INFO
    }
  }

  private ensureLogDirectory(): void {
    if (!existsSync(this.logDir)) {
      mkdirSync(this.logDir, { recursive: true })
    }
  }

  private getLogStream(filename: string): NodeJS.WritableStream {
    if (!this.logStreams.has(filename)) {
      const logPath = join(this.logDir, filename)
      const stream = createWriteStream(logPath, { flags: 'a' })
      this.logStreams.set(filename, stream)
    }
    return this.logStreams.get(filename)!
  }

  private formatLogEntry(entry: LogEntry): string {
    return JSON.stringify(entry) + '\n'
  }

  private writeLog(level: LogLevel, message: string, meta?: any, context?: {
    requestId?: string
    userId?: string
    sessionId?: string
    error?: Error
  }): void {
    if (level > this.logLevel) return

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel[level],
      message,
      ...context
    }

    if (meta) {
      entry.meta = meta
    }

    if (context?.error) {
      entry.error = {
        name: context.error.name,
        message: context.error.message,
        stack: context.error.stack
      }
    }

    // Write to console in development
    if (process.env.NODE_ENV !== 'production') {
      const consoleMethod = level === LogLevel.ERROR ? 'error' : 
                           level === LogLevel.WARN ? 'warn' : 'log'
      console[consoleMethod](`[${entry.level}] ${entry.message}`, entry.meta || '')
    }

    // Write to file
    const filename = level === LogLevel.ERROR ? 'error.log' : 'app.log'
    const stream = this.getLogStream(filename)
    stream.write(this.formatLogEntry(entry))

    // Send to monitoring service in production
    if (process.env.NODE_ENV === 'production' && level <= LogLevel.WARN) {
      this.sendToMonitoring(entry)
    }
  }

  private async sendToMonitoring(entry: LogEntry): Promise<void> {
    // In a real application, this would send to services like:
    // - Sentry
    // - DataDog
    // - New Relic
    // - CloudWatch
    // For now, we'll just log that monitoring would be triggered
    if (process.env.MONITORING_WEBHOOK_URL) {
      try {
        // Example webhook notification
        const response = await fetch(process.env.MONITORING_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            alert: 'Havruta Platform Error',
            level: entry.level,
            message: entry.message,
            timestamp: entry.timestamp,
            environment: process.env.NODE_ENV,
            service: 'havruta-backend',
            ...entry.meta
          })
        })
        
        if (!response.ok) {
          console.error('Failed to send monitoring alert:', response.statusText)
        }
      } catch (error) {
        console.error('Error sending monitoring alert:', error)
      }
    }
  }

  error(message: string, meta?: any, context?: {
    requestId?: string
    userId?: string
    sessionId?: string
    error?: Error
  }): void {
    this.writeLog(LogLevel.ERROR, message, meta, context)
  }

  warn(message: string, meta?: any, context?: {
    requestId?: string
    userId?: string
    sessionId?: string
  }): void {
    this.writeLog(LogLevel.WARN, message, meta, context)
  }

  info(message: string, meta?: any, context?: {
    requestId?: string
    userId?: string
    sessionId?: string
  }): void {
    this.writeLog(LogLevel.INFO, message, meta, context)
  }

  debug(message: string, meta?: any, context?: {
    requestId?: string
    userId?: string
    sessionId?: string
  }): void {
    this.writeLog(LogLevel.DEBUG, message, meta, context)
  }

  // Convenience method for HTTP request logging
  logRequest(req: any, res: any, duration: number): void {
    const entry = {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.connection.remoteAddress
    }

    const level = res.statusCode >= 500 ? LogLevel.ERROR :
                  res.statusCode >= 400 ? LogLevel.WARN : LogLevel.INFO

    this.writeLog(level, `${req.method} ${req.url} ${res.statusCode}`, entry, {
      requestId: req.requestId,
      userId: req.user?.id
    })
  }

  // Cleanup method to close log streams
  close(): void {
    for (const stream of this.logStreams.values()) {
      stream.end()
    }
    this.logStreams.clear()
  }
}

export const logger = new Logger()

// Graceful shutdown
process.on('SIGINT', () => {
  logger.close()
  process.exit(0)
})

process.on('SIGTERM', () => {
  logger.close()
  process.exit(0)
})