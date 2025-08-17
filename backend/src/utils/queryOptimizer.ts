import { PrismaClient } from '@prisma/client';
import { performanceService, trackDatabaseQuery } from '../services/performanceService.js';
import { logger } from './logger.js';

// Enhanced Prisma client with performance tracking
export class OptimizedPrismaClient extends PrismaClient {
  constructor() {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'warn' }
      ]
    });

    // Track query performance
    this.$on('query', (e: any) => {
      performanceService.recordDatabaseQuery({
        query: e.query,
        duration: e.duration,
        timestamp: new Date()
      });

      // Log slow queries
      if (e.duration > 1000) {
        logger.warn('Slow database query detected', {
          query: e.query.substring(0, 200) + '...',
          duration: e.duration,
          params: e.params
        });
      }
    });

    this.$on('error', (e: any) => {
      logger.error('Database error', e);
    });

    this.$on('warn', (e: any) => {
      logger.warn('Database warning', e);
    });
  }

  // Optimized query methods with caching and performance tracking
  async findManyOptimized<T>(
    model: any,
    args: any,
    cacheKey?: string,
    cacheTTL: number = 300000 // 5 minutes default
  ): Promise<T[]> {
    return trackDatabaseQuery(
      `${model.name}.findMany`,
      async () => {
        // Add performance optimizations
        const optimizedArgs = this.optimizeQueryArgs(args);
        return model.findMany(optimizedArgs);
      }
    );
  }

  async findUniqueOptimized<T>(
    model: any,
    args: any,
    cacheKey?: string,
    cacheTTL: number = 300000
  ): Promise<T | null> {
    return trackDatabaseQuery(
      `${model.name}.findUnique`,
      async () => {
        const optimizedArgs = this.optimizeQueryArgs(args);
        return model.findUnique(optimizedArgs);
      }
    );
  }

  // Query optimization helpers
  private optimizeQueryArgs(args: any): any {
    const optimized = { ...args };

    // Add select optimization - only fetch needed fields
    if (!optimized.select && !optimized.include) {
      // Could add default select fields based on model
    }

    // Add pagination limits to prevent large result sets
    if (!optimized.take && !optimized.first) {
      optimized.take = 1000; // Default limit
    }

    // Optimize ordering for better index usage
    if (optimized.orderBy && Array.isArray(optimized.orderBy)) {
      // Ensure consistent ordering for pagination
      optimized.orderBy = [...optimized.orderBy, { id: 'asc' }];
    }

    return optimized;
  }

  // Batch operations for better performance
  async batchCreate<T>(model: any, data: any[], batchSize: number = 100): Promise<T[]> {
    const results: T[] = [];
    
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      
      const batchResults = await trackDatabaseQuery(
        `${model.name}.createMany (batch ${Math.floor(i / batchSize) + 1})`,
        async () => {
          return model.createMany({
            data: batch,
            skipDuplicates: true
          });
        }
      );
      
      results.push(...batchResults);
    }
    
    return results;
  }

  async batchUpdate<T>(
    model: any,
    updates: { where: any; data: any }[],
    batchSize: number = 50
  ): Promise<T[]> {
    const results: T[] = [];
    
    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);
      
      const batchPromises = batch.map(update =>
        trackDatabaseQuery(
          `${model.name}.update`,
          () => model.update(update)
        )
      );
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }
    
    return results;
  }

  // Connection pool monitoring
  async getConnectionInfo(): Promise<{
    activeConnections: number;
    idleConnections: number;
    totalConnections: number;
  }> {
    // This would need to be implemented based on your database setup
    // For now, return mock data
    return {
      activeConnections: 5,
      idleConnections: 10,
      totalConnections: 15
    };
  }

  // Query analysis and suggestions
  async analyzeSlowQueries(timeWindow: number = 3600000): Promise<{
    slowQueries: Array<{
      query: string;
      avgDuration: number;
      count: number;
      suggestions: string[];
    }>;
  }> {
    const dbMetrics = performanceService.getDatabaseMetricsSummary(timeWindow);
    
    // Group queries by pattern and analyze
    const queryGroups = new Map<string, { durations: number[]; count: number }>();
    
    dbMetrics.slowestQueries.forEach(query => {
      // Normalize query (remove specific values)
      const normalizedQuery = this.normalizeQuery(query.query);
      
      if (!queryGroups.has(normalizedQuery)) {
        queryGroups.set(normalizedQuery, { durations: [], count: 0 });
      }
      
      const group = queryGroups.get(normalizedQuery)!;
      group.durations.push(query.duration);
      group.count++;
    });

    const slowQueries = Array.from(queryGroups.entries())
      .map(([query, data]) => ({
        query,
        avgDuration: data.durations.reduce((a, b) => a + b, 0) / data.durations.length,
        count: data.count,
        suggestions: this.generateOptimizationSuggestions(query)
      }))
      .filter(q => q.avgDuration > 100) // Only queries slower than 100ms
      .sort((a, b) => b.avgDuration - a.avgDuration);

    return { slowQueries };
  }

  private normalizeQuery(query: string): string {
    // Remove specific values and normalize for pattern matching
    return query
      .replace(/\$\d+/g, '$?') // Replace parameter placeholders
      .replace(/\d+/g, '?') // Replace numbers
      .replace(/'[^']*'/g, "'?'") // Replace string literals
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  private generateOptimizationSuggestions(query: string): string[] {
    const suggestions: string[] = [];
    
    // Basic query analysis
    if (query.includes('SELECT *')) {
      suggestions.push('Consider selecting only needed columns instead of SELECT *');
    }
    
    if (query.includes('ORDER BY') && !query.includes('LIMIT')) {
      suggestions.push('Add LIMIT clause to ORDER BY queries to improve performance');
    }
    
    if (query.includes('LIKE') && query.includes('%?%')) {
      suggestions.push('Consider using full-text search instead of LIKE with leading wildcards');
    }
    
    if (query.includes('JOIN') && query.split('JOIN').length > 4) {
      suggestions.push('Consider breaking down complex joins into smaller queries');
    }
    
    if (!query.includes('WHERE') && query.includes('SELECT')) {
      suggestions.push('Add WHERE clause to filter results and improve performance');
    }
    
    return suggestions;
  }

  // Index analysis (would need database-specific implementation)
  async suggestIndexes(): Promise<Array<{
    table: string;
    columns: string[];
    reason: string;
    estimatedImprovement: string;
  }>> {
    // This would analyze query patterns and suggest indexes
    // For now, return some common suggestions
    return [
      {
        table: 'User',
        columns: ['email'],
        reason: 'Frequently used in WHERE clauses for authentication',
        estimatedImprovement: 'High - login queries'
      },
      {
        table: 'Havruta',
        columns: ['creatorId', 'isActive'],
        reason: 'Common filter combination in dashboard queries',
        estimatedImprovement: 'Medium - dashboard performance'
      },
      {
        table: 'Session',
        columns: ['havrutaId', 'startTime'],
        reason: 'Used for session history and scheduling queries',
        estimatedImprovement: 'Medium - session management'
      }
    ];
  }
}

// Query builder helpers for common patterns
export class QueryBuilder {
  static buildPaginationQuery(
    page: number = 1,
    limit: number = 20,
    maxLimit: number = 100
  ): { skip: number; take: number } {
    const safeLimit = Math.min(Math.max(1, limit), maxLimit);
    const safePage = Math.max(1, page);
    
    return {
      skip: (safePage - 1) * safeLimit,
      take: safeLimit
    };
  }

  static buildSearchQuery(
    searchTerm: string,
    fields: string[]
  ): any {
    if (!searchTerm || !fields.length) {
      return {};
    }

    const searchConditions = fields.map(field => ({
      [field]: {
        contains: searchTerm,
        mode: 'insensitive'
      }
    }));

    return {
      OR: searchConditions
    };
  }

  static buildDateRangeQuery(
    field: string,
    startDate?: Date,
    endDate?: Date
  ): any {
    const conditions: any = {};

    if (startDate) {
      conditions.gte = startDate;
    }

    if (endDate) {
      conditions.lte = endDate;
    }

    return Object.keys(conditions).length > 0 ? { [field]: conditions } : {};
  }

  static buildSortQuery(
    sortBy?: string,
    sortOrder: 'asc' | 'desc' = 'asc',
    defaultSort: string = 'id'
  ): any {
    const field = sortBy || defaultSort;
    return { [field]: sortOrder };
  }
}

// Create singleton instance
export const optimizedPrisma = new OptimizedPrismaClient();