import { performance } from 'perf_hooks';
import { logger } from '../utils/logger.js';

export interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface APIPerformanceData {
  endpoint: string;
  method: string;
  statusCode: number;
  duration: number;
  timestamp: Date;
  userId?: string;
  userAgent?: string;
  ip?: string;
}

export interface DatabasePerformanceData {
  query: string;
  duration: number;
  timestamp: Date;
  rowCount?: number;
  error?: string;
}

class PerformanceService {
  private metrics: PerformanceMetric[] = [];
  private apiMetrics: APIPerformanceData[] = [];
  private dbMetrics: DatabasePerformanceData[] = [];
  private readonly maxMetrics = 10000; // Keep last 10k metrics in memory

  // Performance timing utilities
  startTimer(name: string): () => PerformanceMetric {
    const startTime = performance.now();
    const startTimestamp = new Date();

    return (metadata?: Record<string, any>): PerformanceMetric => {
      const duration = performance.now() - startTime;
      const metric: PerformanceMetric = {
        name,
        duration,
        timestamp: startTimestamp,
        metadata
      };

      this.addMetric(metric);
      return metric;
    };
  }

  measureAsync<T>(name: string, fn: () => Promise<T>, metadata?: Record<string, any>): Promise<T> {
    const endTimer = this.startTimer(name);
    
    return fn()
      .then(result => {
        endTimer({ ...metadata, success: true });
        return result;
      })
      .catch(error => {
        endTimer({ ...metadata, success: false, error: error.message });
        throw error;
      });
  }

  measureSync<T>(name: string, fn: () => T, metadata?: Record<string, any>): T {
    const endTimer = this.startTimer(name);
    
    try {
      const result = fn();
      endTimer({ ...metadata, success: true });
      return result;
    } catch (error) {
      endTimer({ ...metadata, success: false, error: (error as Error).message });
      throw error;
    }
  }

  // API performance tracking
  recordAPICall(data: APIPerformanceData): void {
    this.apiMetrics.push(data);
    
    // Keep only recent metrics
    if (this.apiMetrics.length > this.maxMetrics) {
      this.apiMetrics = this.apiMetrics.slice(-this.maxMetrics);
    }

    // Log slow API calls
    if (data.duration > 1000) {
      logger.warn('Slow API call detected', {
        endpoint: data.endpoint,
        method: data.method,
        duration: data.duration,
        statusCode: data.statusCode
      });
    }

    // Log errors
    if (data.statusCode >= 400) {
      logger.error('API error', {
        endpoint: data.endpoint,
        method: data.method,
        statusCode: data.statusCode,
        duration: data.duration
      });
    }
  }

  // Database performance tracking
  recordDatabaseQuery(data: DatabasePerformanceData): void {
    this.dbMetrics.push(data);
    
    // Keep only recent metrics
    if (this.dbMetrics.length > this.maxMetrics) {
      this.dbMetrics = this.dbMetrics.slice(-this.maxMetrics);
    }

    // Log slow queries
    if (data.duration > 500) {
      logger.warn('Slow database query detected', {
        query: data.query.substring(0, 100) + '...',
        duration: data.duration,
        rowCount: data.rowCount
      });
    }

    // Log query errors
    if (data.error) {
      logger.error('Database query error', {
        query: data.query.substring(0, 100) + '...',
        error: data.error,
        duration: data.duration
      });
    }
  }

  // Metrics management
  private addMetric(metric: PerformanceMetric): void {
    this.metrics.push(metric);
    
    // Keep only recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }

    // Log slow operations
    if (metric.duration > 1000) {
      logger.warn('Slow operation detected', {
        name: metric.name,
        duration: metric.duration,
        metadata: metric.metadata
      });
    }
  }

  // Analytics and reporting
  getMetricsSummary(timeWindow?: number): {
    totalMetrics: number;
    averageDuration: number;
    slowestOperations: PerformanceMetric[];
    errorRate: number;
  } {
    const cutoffTime = timeWindow ? new Date(Date.now() - timeWindow) : new Date(0);
    const recentMetrics = this.metrics.filter(m => m.timestamp >= cutoffTime);

    if (recentMetrics.length === 0) {
      return {
        totalMetrics: 0,
        averageDuration: 0,
        slowestOperations: [],
        errorRate: 0
      };
    }

    const totalDuration = recentMetrics.reduce((sum, m) => sum + m.duration, 0);
    const averageDuration = totalDuration / recentMetrics.length;
    
    const slowestOperations = recentMetrics
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10);

    const errorCount = recentMetrics.filter(m => 
      m.metadata?.success === false || m.metadata?.error
    ).length;
    const errorRate = (errorCount / recentMetrics.length) * 100;

    return {
      totalMetrics: recentMetrics.length,
      averageDuration,
      slowestOperations,
      errorRate
    };
  }

  getAPIMetricsSummary(timeWindow?: number): {
    totalRequests: number;
    averageResponseTime: number;
    slowestEndpoints: APIPerformanceData[];
    errorRate: number;
    requestsByEndpoint: Record<string, number>;
  } {
    const cutoffTime = timeWindow ? new Date(Date.now() - timeWindow) : new Date(0);
    const recentMetrics = this.apiMetrics.filter(m => m.timestamp >= cutoffTime);

    if (recentMetrics.length === 0) {
      return {
        totalRequests: 0,
        averageResponseTime: 0,
        slowestEndpoints: [],
        errorRate: 0,
        requestsByEndpoint: {}
      };
    }

    const totalDuration = recentMetrics.reduce((sum, m) => sum + m.duration, 0);
    const averageResponseTime = totalDuration / recentMetrics.length;
    
    const slowestEndpoints = recentMetrics
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10);

    const errorCount = recentMetrics.filter(m => m.statusCode >= 400).length;
    const errorRate = (errorCount / recentMetrics.length) * 100;

    const requestsByEndpoint = recentMetrics.reduce((acc, m) => {
      const key = `${m.method} ${m.endpoint}`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalRequests: recentMetrics.length,
      averageResponseTime,
      slowestEndpoints,
      errorRate,
      requestsByEndpoint
    };
  }

  getDatabaseMetricsSummary(timeWindow?: number): {
    totalQueries: number;
    averageQueryTime: number;
    slowestQueries: DatabasePerformanceData[];
    errorRate: number;
  } {
    const cutoffTime = timeWindow ? new Date(Date.now() - timeWindow) : new Date(0);
    const recentMetrics = this.dbMetrics.filter(m => m.timestamp >= cutoffTime);

    if (recentMetrics.length === 0) {
      return {
        totalQueries: 0,
        averageQueryTime: 0,
        slowestQueries: [],
        errorRate: 0
      };
    }

    const totalDuration = recentMetrics.reduce((sum, m) => sum + m.duration, 0);
    const averageQueryTime = totalDuration / recentMetrics.length;
    
    const slowestQueries = recentMetrics
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10);

    const errorCount = recentMetrics.filter(m => m.error).length;
    const errorRate = (errorCount / recentMetrics.length) * 100;

    return {
      totalQueries: recentMetrics.length,
      averageQueryTime,
      slowestQueries,
      errorRate
    };
  }

  // System health check
  getHealthMetrics(): {
    memoryUsage: NodeJS.MemoryUsage;
    uptime: number;
    cpuUsage: NodeJS.CpuUsage;
    performanceSummary: ReturnType<typeof this.getMetricsSummary>;
  } {
    return {
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime(),
      cpuUsage: process.cpuUsage(),
      performanceSummary: this.getMetricsSummary(300000) // Last 5 minutes
    };
  }

  // Clear old metrics
  clearOldMetrics(olderThan: number = 3600000): void { // Default: 1 hour
    const cutoffTime = new Date(Date.now() - olderThan);
    
    this.metrics = this.metrics.filter(m => m.timestamp >= cutoffTime);
    this.apiMetrics = this.apiMetrics.filter(m => m.timestamp >= cutoffTime);
    this.dbMetrics = this.dbMetrics.filter(m => m.timestamp >= cutoffTime);
    
    logger.info('Cleared old performance metrics', {
      cutoffTime,
      remainingMetrics: this.metrics.length,
      remainingAPIMetrics: this.apiMetrics.length,
      remainingDBMetrics: this.dbMetrics.length
    });
  }

  // Export metrics for external monitoring
  exportMetrics(): {
    metrics: PerformanceMetric[];
    apiMetrics: APIPerformanceData[];
    dbMetrics: DatabasePerformanceData[];
    timestamp: Date;
  } {
    return {
      metrics: [...this.metrics],
      apiMetrics: [...this.apiMetrics],
      dbMetrics: [...this.dbMetrics],
      timestamp: new Date()
    };
  }
}

// Singleton instance
export const performanceService = new PerformanceService();

// Middleware for Express to track API performance
export const performanceMiddleware = (req: any, res: any, next: any) => {
  const startTime = performance.now();
  const startTimestamp = new Date();

  // Override res.end to capture response time
  const originalEnd = res.end;
  res.end = function(...args: any[]) {
    const duration = performance.now() - startTime;
    
    performanceService.recordAPICall({
      endpoint: req.route?.path || req.path,
      method: req.method,
      statusCode: res.statusCode,
      duration,
      timestamp: startTimestamp,
      userId: req.user?.id,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });

    originalEnd.apply(this, args);
  };

  next();
};

// Database query wrapper for performance tracking
export const trackDatabaseQuery = async <T>(
  query: string,
  executor: () => Promise<T>
): Promise<T> => {
  const startTime = performance.now();
  const startTimestamp = new Date();

  try {
    const result = await executor();
    const duration = performance.now() - startTime;
    
    performanceService.recordDatabaseQuery({
      query,
      duration,
      timestamp: startTimestamp,
      rowCount: Array.isArray(result) ? result.length : undefined
    });

    return result;
  } catch (error) {
    const duration = performance.now() - startTime;
    
    performanceService.recordDatabaseQuery({
      query,
      duration,
      timestamp: startTimestamp,
      error: (error as Error).message
    });

    throw error;
  }
};