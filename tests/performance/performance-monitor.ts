import { Page } from '@playwright/test';

export interface PerformanceMetrics {
  loadTime: number;
  domContentLoaded: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  cumulativeLayoutShift: number;
  firstInputDelay: number;
  timeToInteractive: number;
  totalBlockingTime: number;
}

export interface APIMetrics {
  endpoint: string;
  method: string;
  responseTime: number;
  status: number;
  size: number;
}

export class PerformanceMonitor {
  private page: Page;
  private apiMetrics: APIMetrics[] = [];
  private performanceObserver: any;

  constructor(page: Page) {
    this.page = page;
    this.setupAPIMonitoring();
    this.setupPerformanceObserver();
  }

  private async setupAPIMonitoring() {
    this.page.on('response', (response) => {
      const request = response.request();
      const url = new URL(request.url());
      
      // Only monitor API calls
      if (url.pathname.startsWith('/api/')) {
        this.apiMetrics.push({
          endpoint: url.pathname,
          method: request.method(),
          responseTime: response.timing().responseEnd - response.timing().requestStart,
          status: response.status(),
          size: parseInt(response.headers()['content-length'] || '0', 10)
        });
      }
    });
  }

  private async setupPerformanceObserver() {
    await this.page.addInitScript(() => {
      // Store performance metrics in window object
      (window as any).performanceMetrics = {
        navigationTiming: {},
        paintTiming: {},
        layoutShift: 0,
        inputDelay: 0,
        blockingTime: 0
      };

      // Observe paint timing
      if ('PerformanceObserver' in window) {
        try {
          const paintObserver = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (entry.name === 'first-contentful-paint') {
                (window as any).performanceMetrics.paintTiming.fcp = entry.startTime;
              }
            }
          });
          paintObserver.observe({ entryTypes: ['paint'] });

          // Observe largest contentful paint
          const lcpObserver = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const lastEntry = entries[entries.length - 1];
            (window as any).performanceMetrics.paintTiming.lcp = lastEntry.startTime;
          });
          lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

          // Observe layout shift
          const clsObserver = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (!(entry as any).hadRecentInput) {
                (window as any).performanceMetrics.layoutShift += (entry as any).value;
              }
            }
          });
          clsObserver.observe({ entryTypes: ['layout-shift'] });

          // Observe first input delay
          const fidObserver = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              (window as any).performanceMetrics.inputDelay = (entry as any).processingStart - entry.startTime;
            }
          });
          fidObserver.observe({ entryTypes: ['first-input'] });

          // Observe long tasks for Total Blocking Time
          const longTaskObserver = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              const blockingTime = Math.max(0, entry.duration - 50);
              (window as any).performanceMetrics.blockingTime += blockingTime;
            }
          });
          longTaskObserver.observe({ entryTypes: ['longtask'] });
        } catch (e) {
          console.warn('Performance Observer not fully supported:', e);
        }
      }

      // Store navigation timing when page loads
      window.addEventListener('load', () => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        (window as any).performanceMetrics.navigationTiming = {
          domContentLoaded: navigation.domContentLoadedEventEnd - navigation.navigationStart,
          loadComplete: navigation.loadEventEnd - navigation.navigationStart,
          timeToInteractive: navigation.domInteractive - navigation.navigationStart
        };
      });
    });
  }

  async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    // Wait for metrics to be collected
    await this.page.waitForTimeout(1000);

    const metrics = await this.page.evaluate(() => {
      const perf = (window as any).performanceMetrics;
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      
      return {
        loadTime: perf.navigationTiming.loadComplete || 0,
        domContentLoaded: perf.navigationTiming.domContentLoaded || 0,
        firstContentfulPaint: perf.paintTiming.fcp || 0,
        largestContentfulPaint: perf.paintTiming.lcp || 0,
        cumulativeLayoutShift: perf.layoutShift || 0,
        firstInputDelay: perf.inputDelay || 0,
        timeToInteractive: perf.navigationTiming.timeToInteractive || 0,
        totalBlockingTime: perf.blockingTime || 0
      };
    });

    return metrics;
  }

  getAPIMetrics(): APIMetrics[] {
    return [...this.apiMetrics];
  }

  clearMetrics() {
    this.apiMetrics = [];
  }

  async measurePageLoad(url: string): Promise<PerformanceMetrics> {
    this.clearMetrics();
    
    const startTime = Date.now();
    await this.page.goto(url);
    
    // Wait for page to be fully loaded
    await this.page.waitForLoadState('networkidle');
    
    return this.getPerformanceMetrics();
  }

  async measureUserFlow(actions: (() => Promise<void>)[]): Promise<{
    totalTime: number;
    stepTimes: number[];
    metrics: PerformanceMetrics;
  }> {
    const startTime = Date.now();
    const stepTimes: number[] = [];
    
    for (const action of actions) {
      const stepStart = Date.now();
      await action();
      stepTimes.push(Date.now() - stepStart);
    }
    
    const totalTime = Date.now() - startTime;
    const metrics = await this.getPerformanceMetrics();
    
    return { totalTime, stepTimes, metrics };
  }

  generateReport(): {
    performance: PerformanceMetrics;
    api: {
      totalRequests: number;
      averageResponseTime: number;
      slowestEndpoint: APIMetrics | null;
      errorRate: number;
    };
  } {
    const performance = this.getPerformanceMetrics();
    const apiMetrics = this.getAPIMetrics();
    
    const totalRequests = apiMetrics.length;
    const averageResponseTime = totalRequests > 0 
      ? apiMetrics.reduce((sum, metric) => sum + metric.responseTime, 0) / totalRequests 
      : 0;
    
    const slowestEndpoint = apiMetrics.length > 0
      ? apiMetrics.reduce((slowest, current) => 
          current.responseTime > slowest.responseTime ? current : slowest
        )
      : null;
    
    const errorCount = apiMetrics.filter(metric => metric.status >= 400).length;
    const errorRate = totalRequests > 0 ? (errorCount / totalRequests) * 100 : 0;
    
    return {
      performance: performance as PerformanceMetrics,
      api: {
        totalRequests,
        averageResponseTime,
        slowestEndpoint,
        errorRate
      }
    };
  }

  async waitForGoodPerformance(thresholds: Partial<PerformanceMetrics> = {}): Promise<boolean> {
    const defaultThresholds: PerformanceMetrics = {
      loadTime: 3000,
      domContentLoaded: 2000,
      firstContentfulPaint: 1500,
      largestContentfulPaint: 2500,
      cumulativeLayoutShift: 0.1,
      firstInputDelay: 100,
      timeToInteractive: 3000,
      totalBlockingTime: 300
    };
    
    const finalThresholds = { ...defaultThresholds, ...thresholds };
    
    // Wait up to 10 seconds for good performance
    for (let i = 0; i < 10; i++) {
      const metrics = await this.getPerformanceMetrics();
      
      const isGoodPerformance = (
        metrics.loadTime <= finalThresholds.loadTime &&
        metrics.domContentLoaded <= finalThresholds.domContentLoaded &&
        metrics.firstContentfulPaint <= finalThresholds.firstContentfulPaint &&
        metrics.largestContentfulPaint <= finalThresholds.largestContentfulPaint &&
        metrics.cumulativeLayoutShift <= finalThresholds.cumulativeLayoutShift &&
        metrics.firstInputDelay <= finalThresholds.firstInputDelay &&
        metrics.timeToInteractive <= finalThresholds.timeToInteractive &&
        metrics.totalBlockingTime <= finalThresholds.totalBlockingTime
      );
      
      if (isGoodPerformance) {
        return true;
      }
      
      await this.page.waitForTimeout(1000);
    }
    
    return false;
  }
}

export async function createPerformanceMonitor(page: Page): Promise<PerformanceMonitor> {
  return new PerformanceMonitor(page);
}