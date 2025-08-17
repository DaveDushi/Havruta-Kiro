import { logger } from '../utils/logger'
import { prisma } from '../utils/database'

interface SystemMetrics {
  timestamp: string
  memory: {
    used: number
    total: number
    percentage: number
  }
  cpu: {
    usage: number
  }
  database: {
    connected: boolean
    activeConnections?: number
  }
  uptime: number
  version: string
  environment: string
}

interface AlertThresholds {
  memoryUsagePercent: number
  cpuUsagePercent: number
  responseTimeMs: number
  errorRatePercent: number
}

class MonitoringService {
  private metrics: SystemMetrics[] = []
  private alertThresholds: AlertThresholds = {
    memoryUsagePercent: 85,
    cpuUsagePercent: 80,
    responseTimeMs: 5000,
    errorRatePercent: 5
  }
  private isMonitoring = false
  private monitoringInterval?: NodeJS.Timeout

  constructor() {
    this.setupProcessMonitoring()
  }

  private setupProcessMonitoring(): void {
    // Monitor memory usage
    setInterval(() => {
      const memUsage = process.memoryUsage()
      const totalMemory = memUsage.heapTotal + memUsage.external
      const usedMemory = memUsage.heapUsed
      const memoryPercentage = (usedMemory / totalMemory) * 100

      if (memoryPercentage > this.alertThresholds.memoryUsagePercent) {
        logger.warn('High memory usage detected', {
          memoryUsage: {
            used: usedMemory,
            total: totalMemory,
            percentage: memoryPercentage
          }
        })
      }
    }, 60000) // Check every minute

    // Monitor uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception detected', {
        error: error.message,
        stack: error.stack
      }, { error })
      
      this.sendAlert('CRITICAL', 'Uncaught Exception', error.message)
    })

    // Monitor unhandled rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection detected', {
        reason: reason instanceof Error ? reason.message : String(reason),
        promise: promise.toString()
      })
      
      this.sendAlert('CRITICAL', 'Unhandled Rejection', String(reason))
    })
  }

  async collectMetrics(): Promise<SystemMetrics> {
    const memUsage = process.memoryUsage()
    const totalMemory = memUsage.heapTotal + memUsage.external
    const usedMemory = memUsage.heapUsed

    let databaseConnected = false
    try {
      await prisma.$queryRaw`SELECT 1`
      databaseConnected = true
    } catch (error) {
      logger.error('Database health check failed', {}, { error: error as Error })
    }

    const metrics: SystemMetrics = {
      timestamp: new Date().toISOString(),
      memory: {
        used: usedMemory,
        total: totalMemory,
        percentage: (usedMemory / totalMemory) * 100
      },
      cpu: {
        usage: process.cpuUsage().user / 1000000 // Convert to seconds
      },
      database: {
        connected: databaseConnected
      },
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    }

    // Store metrics (keep last 100 entries)
    this.metrics.push(metrics)
    if (this.metrics.length > 100) {
      this.metrics.shift()
    }

    return metrics
  }

  getMetrics(): SystemMetrics[] {
    return [...this.metrics]
  }

  getLatestMetrics(): SystemMetrics | null {
    return this.metrics.length > 0 ? this.metrics[this.metrics.length - 1] : null
  }

  startMonitoring(intervalMs: number = 60000): void {
    if (this.isMonitoring) {
      logger.warn('Monitoring is already running')
      return
    }

    this.isMonitoring = true
    logger.info('Starting system monitoring', { intervalMs })

    this.monitoringInterval = setInterval(async () => {
      try {
        const metrics = await this.collectMetrics()
        
        // Check for alerts
        this.checkAlerts(metrics)
        
        logger.debug('System metrics collected', metrics)
      } catch (error) {
        logger.error('Error collecting metrics', {}, { error: error as Error })
      }
    }, intervalMs)
  }

  stopMonitoring(): void {
    if (!this.isMonitoring) {
      return
    }

    this.isMonitoring = false
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = undefined
    }

    logger.info('System monitoring stopped')
  }

  private checkAlerts(metrics: SystemMetrics): void {
    // Memory usage alert
    if (metrics.memory.percentage > this.alertThresholds.memoryUsagePercent) {
      this.sendAlert(
        'WARNING',
        'High Memory Usage',
        `Memory usage is at ${metrics.memory.percentage.toFixed(1)}%`
      )
    }

    // Database connection alert
    if (!metrics.database.connected) {
      this.sendAlert(
        'CRITICAL',
        'Database Connection Lost',
        'Unable to connect to the database'
      )
    }
  }

  private async sendAlert(
    severity: 'INFO' | 'WARNING' | 'CRITICAL',
    title: string,
    message: string
  ): Promise<void> {
    const alert = {
      severity,
      title,
      message,
      timestamp: new Date().toISOString(),
      service: 'havruta-backend',
      environment: process.env.NODE_ENV || 'development'
    }

    // Log the alert
    const logLevel = severity === 'CRITICAL' ? 'error' : 
                    severity === 'WARNING' ? 'warn' : 'info'
    
    logger[logLevel](`ALERT: ${title}`, alert)

    // Send to external monitoring service if configured
    if (process.env.MONITORING_WEBHOOK_URL) {
      try {
        const response = await fetch(process.env.MONITORING_WEBHOOK_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(alert)
        })

        if (!response.ok) {
          logger.error('Failed to send monitoring alert', {
            status: response.status,
            statusText: response.statusText
          })
        }
      } catch (error) {
        logger.error('Error sending monitoring alert', {}, { error: error as Error })
      }
    }
  }

  // Health check method
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy'
    checks: Record<string, { status: 'pass' | 'fail'; message?: string }>
    timestamp: string
  }> {
    const checks: Record<string, { status: 'pass' | 'fail'; message?: string }> = {}
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'

    // Database check
    try {
      await prisma.$queryRaw`SELECT 1`
      checks.database = { status: 'pass' }
    } catch (error) {
      checks.database = { 
        status: 'fail', 
        message: 'Database connection failed' 
      }
      overallStatus = 'unhealthy'
    }

    // Memory check
    const metrics = await this.collectMetrics()
    if (metrics.memory.percentage > this.alertThresholds.memoryUsagePercent) {
      checks.memory = { 
        status: 'fail', 
        message: `High memory usage: ${metrics.memory.percentage.toFixed(1)}%` 
      }
      if (overallStatus === 'healthy') overallStatus = 'degraded'
    } else {
      checks.memory = { status: 'pass' }
    }

    return {
      status: overallStatus,
      checks,
      timestamp: new Date().toISOString()
    }
  }

  // Update alert thresholds
  updateAlertThresholds(thresholds: Partial<AlertThresholds>): void {
    this.alertThresholds = { ...this.alertThresholds, ...thresholds }
    logger.info('Alert thresholds updated', this.alertThresholds)
  }
}

export const monitoringService = new MonitoringService()

// Start monitoring in production
if (process.env.NODE_ENV === 'production') {
  monitoringService.startMonitoring(30000) // Every 30 seconds in production
} else {
  monitoringService.startMonitoring(60000) // Every minute in development
}