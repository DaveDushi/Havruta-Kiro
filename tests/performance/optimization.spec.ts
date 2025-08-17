import { test, expect } from '@playwright/test';
import { PerformanceMonitor } from './performance-monitor';

test.describe('Performance Optimization', () => {
  test('should meet Core Web Vitals thresholds', async ({ page }) => {
    const monitor = new PerformanceMonitor(page);
    
    // Mock authentication and data
    await page.evaluate(() => {
      localStorage.setItem('token', 'mock-jwt-token');
      localStorage.setItem('user', JSON.stringify({
        id: '1',
        name: 'Test User',
        email: 'test@example.com'
      }));
    });
    
    await page.route('**/api/havrutot', async route => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: '1',
            name: 'Genesis Study',
            bookTitle: 'Genesis',
            participants: ['Test User'],
            currentSection: 'Genesis 1:1',
            isActive: true
          }
        ])
      });
    });
    
    // Measure dashboard performance
    const metrics = await monitor.measurePageLoad('/dashboard');
    
    console.log('Core Web Vitals:', {
      'First Contentful Paint': `${metrics.firstContentfulPaint.toFixed(2)}ms`,
      'Largest Contentful Paint': `${metrics.largestContentfulPaint.toFixed(2)}ms`,
      'Cumulative Layout Shift': metrics.cumulativeLayoutShift.toFixed(3),
      'First Input Delay': `${metrics.firstInputDelay.toFixed(2)}ms`,
      'Total Blocking Time': `${metrics.totalBlockingTime.toFixed(2)}ms`
    });
    
    // Core Web Vitals thresholds (good performance)
    expect(metrics.firstContentfulPaint).toBeLessThan(1800); // Good: < 1.8s
    expect(metrics.largestContentfulPaint).toBeLessThan(2500); // Good: < 2.5s
    expect(metrics.cumulativeLayoutShift).toBeLessThan(0.1); // Good: < 0.1
    expect(metrics.firstInputDelay).toBeLessThan(100); // Good: < 100ms
    expect(metrics.totalBlockingTime).toBeLessThan(200); // Good: < 200ms
  });

  test('should optimize bundle size and loading', async ({ page }) => {
    const resourceSizes: { [key: string]: number } = {};
    const resourceCount = { js: 0, css: 0, images: 0, fonts: 0 };
    
    // Monitor resource loading
    page.on('response', (response) => {
      const url = response.url();
      const contentLength = parseInt(response.headers()['content-length'] || '0', 10);
      
      if (contentLength > 0) {
        resourceSizes[url] = contentLength;
        
        if (url.endsWith('.js')) resourceCount.js++;
        else if (url.endsWith('.css')) resourceCount.css++;
        else if (url.match(/\.(png|jpg|jpeg|gif|svg|webp)$/)) resourceCount.images++;
        else if (url.match(/\.(woff|woff2|ttf|eot)$/)) resourceCount.fonts++;
      }
    });
    
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Calculate total bundle sizes
    const jsBundleSize = Object.entries(resourceSizes)
      .filter(([url]) => url.endsWith('.js'))
      .reduce((total, [, size]) => total + size, 0);
    
    const cssBundleSize = Object.entries(resourceSizes)
      .filter(([url]) => url.endsWith('.css'))
      .reduce((total, [, size]) => total + size, 0);
    
    const totalImageSize = Object.entries(resourceSizes)
      .filter(([url]) => url.match(/\.(png|jpg|jpeg|gif|svg|webp)$/))
      .reduce((total, [, size]) => total + size, 0);
    
    console.log('Bundle Analysis:', {
      'JavaScript Bundle': `${(jsBundleSize / 1024).toFixed(2)} KB`,
      'CSS Bundle': `${(cssBundleSize / 1024).toFixed(2)} KB`,
      'Images Total': `${(totalImageSize / 1024).toFixed(2)} KB`,
      'Resource Counts': resourceCount
    });
    
    // Bundle size thresholds
    expect(jsBundleSize).toBeLessThan(500 * 1024); // < 500KB for JS
    expect(cssBundleSize).toBeLessThan(100 * 1024); // < 100KB for CSS
    expect(resourceCount.js).toBeLessThan(10); // Reasonable number of JS files
    expect(resourceCount.css).toBeLessThan(5); // Reasonable number of CSS files
  });

  test('should implement efficient caching strategies', async ({ page }) => {
    const cacheHeaders: { [key: string]: string } = {};
    
    // Monitor cache headers
    page.on('response', (response) => {
      const url = response.url();
      const cacheControl = response.headers()['cache-control'];
      const etag = response.headers()['etag'];
      const lastModified = response.headers()['last-modified'];
      
      if (cacheControl || etag || lastModified) {
        cacheHeaders[url] = JSON.stringify({
          cacheControl,
          etag,
          lastModified
        });
      }
    });
    
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Check that static assets have proper cache headers
    const staticAssets = Object.keys(cacheHeaders).filter(url => 
      url.match(/\.(js|css|png|jpg|jpeg|gif|svg|woff|woff2)$/)
    );
    
    console.log(`Found ${staticAssets.length} static assets with cache headers`);
    
    // Verify static assets have long-term caching
    for (const asset of staticAssets) {
      const headers = JSON.parse(cacheHeaders[asset]);
      const hasLongTermCache = headers.cacheControl && 
        (headers.cacheControl.includes('max-age=') || headers.cacheControl.includes('immutable'));
      
      if (!hasLongTermCache) {
        console.warn(`Asset missing long-term cache: ${asset}`);
      }
    }
    
    // At least 80% of static assets should have proper caching
    const properlycachedAssets = staticAssets.filter(asset => {
      const headers = JSON.parse(cacheHeaders[asset]);
      return headers.cacheControl && 
        (headers.cacheControl.includes('max-age=') || headers.cacheControl.includes('immutable'));
    });
    
    const cacheRatio = properlycachedAssets.length / staticAssets.length;
    expect(cacheRatio).toBeGreaterThan(0.8);
  });

  test('should optimize database queries and API responses', async ({ page }) => {
    const monitor = new PerformanceMonitor(page);
    
    // Mock authentication
    await page.evaluate(() => {
      localStorage.setItem('token', 'mock-jwt-token');
      localStorage.setItem('user', JSON.stringify({
        id: '1',
        name: 'Test User',
        email: 'test@example.com'
      }));
    });
    
    // Mock API with realistic delays
    await page.route('**/api/havrutot', async route => {
      // Simulate database query time
      await new Promise(resolve => setTimeout(resolve, 50));
      
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(Array.from({ length: 10 }, (_, i) => ({
          id: (i + 1).toString(),
          name: `Study Group ${i + 1}`,
          bookTitle: `Book ${i + 1}`,
          participants: ['Test User'],
          currentSection: `Section ${i + 1}:1`,
          isActive: i % 2 === 0
        })))
      });
    });
    
    await page.route('**/api/sessions/*', async route => {
      await new Promise(resolve => setTimeout(resolve, 30));
      
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'test-session',
          participants: [{ id: '1', name: 'Test User', isOnline: true }],
          currentSection: 'Genesis 1:1'
        })
      });
    });
    
    await page.route('**/api/sefaria/text/*', async route => {
      await new Promise(resolve => setTimeout(resolve, 100));
      
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          ref: 'Genesis 1:1',
          text: ['Sample text content'],
          he: ['טקסט לדוגמה']
        })
      });
    });
    
    // Test dashboard loading
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    const apiMetrics = monitor.getAPIMetrics();
    
    // Verify API response times
    const dashboardAPI = apiMetrics.find(m => m.endpoint.includes('/havrutot'));
    expect(dashboardAPI?.responseTime).toBeLessThan(200); // < 200ms for dashboard API
    
    // Test session loading
    await page.goto('/session/test-session');
    await page.waitForLoadState('networkidle');
    
    const sessionMetrics = monitor.getAPIMetrics();
    const sessionAPI = sessionMetrics.find(m => m.endpoint.includes('/sessions/'));
    const textAPI = sessionMetrics.find(m => m.endpoint.includes('/sefaria/text/'));
    
    expect(sessionAPI?.responseTime).toBeLessThan(150); // < 150ms for session API
    expect(textAPI?.responseTime).toBeLessThan(300); // < 300ms for text API (external)
    
    console.log('API Performance:', {
      'Dashboard API': `${dashboardAPI?.responseTime || 0}ms`,
      'Session API': `${sessionAPI?.responseTime || 0}ms`,
      'Text API': `${textAPI?.responseTime || 0}ms`
    });
  });

  test('should handle memory leaks and cleanup', async ({ page }) => {
    // Mock authentication
    await page.evaluate(() => {
      localStorage.setItem('token', 'mock-jwt-token');
      localStorage.setItem('user', JSON.stringify({
        id: '1',
        name: 'Test User',
        email: 'test@example.com'
      }));
    });
    
    // Mock APIs
    await page.route('**/api/**', async route => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      });
    });
    
    // Measure initial memory
    const getMemoryUsage = async () => {
      return await page.evaluate(() => {
        if ((performance as any).memory) {
          return {
            used: (performance as any).memory.usedJSHeapSize,
            total: (performance as any).memory.totalJSHeapSize,
            limit: (performance as any).memory.jsHeapSizeLimit
          };
        }
        return { used: 0, total: 0, limit: 0 };
      });
    };
    
    const initialMemory = await getMemoryUsage();
    console.log('Initial memory:', `${(initialMemory.used / 1024 / 1024).toFixed(2)} MB`);
    
    // Navigate through multiple pages to test for memory leaks
    const pages = ['/dashboard', '/session/test-1', '/dashboard', '/session/test-2', '/dashboard'];
    
    for (let i = 0; i < 3; i++) { // Repeat cycle 3 times
      for (const pagePath of pages) {
        await page.goto(pagePath);
        await page.waitForTimeout(500);
        
        // Force garbage collection if available
        await page.evaluate(() => {
          if ((window as any).gc) {
            (window as any).gc();
          }
        });
      }
      
      const currentMemory = await getMemoryUsage();
      console.log(`Memory after cycle ${i + 1}:`, `${(currentMemory.used / 1024 / 1024).toFixed(2)} MB`);
    }
    
    const finalMemory = await getMemoryUsage();
    const memoryIncrease = finalMemory.used - initialMemory.used;
    const memoryIncreasePercent = (memoryIncrease / initialMemory.used) * 100;
    
    console.log('Memory analysis:', {
      'Initial': `${(initialMemory.used / 1024 / 1024).toFixed(2)} MB`,
      'Final': `${(finalMemory.used / 1024 / 1024).toFixed(2)} MB`,
      'Increase': `${(memoryIncrease / 1024 / 1024).toFixed(2)} MB (${memoryIncreasePercent.toFixed(1)}%)`
    });
    
    // Memory increase should be reasonable (less than 50% increase)
    expect(memoryIncreasePercent).toBeLessThan(50);
    
    // Absolute memory increase should be less than 20MB
    expect(memoryIncrease).toBeLessThan(20 * 1024 * 1024);
  });

  test('should optimize real-time features performance', async ({ page }) => {
    const monitor = new PerformanceMonitor(page);
    
    // Mock authentication and session
    await page.evaluate(() => {
      localStorage.setItem('token', 'mock-jwt-token');
      localStorage.setItem('user', JSON.stringify({
        id: '1',
        name: 'Test User',
        email: 'test@example.com'
      }));
    });
    
    await page.route('**/api/sessions/realtime-test', async route => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'realtime-test',
          participants: [
            { id: '1', name: 'Test User', isOnline: true },
            { id: '2', name: 'Partner', isOnline: true }
          ],
          currentSection: 'Genesis 1:1'
        })
      });
    });
    
    await page.route('**/api/sefaria/text/*', async route => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          ref: 'Genesis 1:1',
          text: ['Sample text'],
          he: ['טקסט לדוגמה']
        })
      });
    });
    
    // Mock WebSocket for real-time features
    await page.evaluate(() => {
      let eventHandlers: { [key: string]: Function[] } = {};
      
      (window as any).io = () => ({
        on: (event: string, handler: Function) => {
          if (!eventHandlers[event]) eventHandlers[event] = [];
          eventHandlers[event].push(handler);
        },
        emit: (event: string, data: any) => {
          // Simulate real-time response
          if (event === 'navigation') {
            setTimeout(() => {
              eventHandlers['navigation-sync']?.forEach(handler => 
                handler({ section: data.section, participantId: '2' })
              );
            }, 10);
          }
        },
        disconnect: () => {
          eventHandlers = {};
        }
      });
    });
    
    await page.goto('/session/realtime-test');
    await page.waitForLoadState('networkidle');
    
    // Measure real-time event performance
    const eventTimes: number[] = [];
    
    // Simulate multiple navigation events
    for (let i = 0; i < 20; i++) {
      const startTime = Date.now();
      
      // Trigger navigation event
      await page.evaluate((section) => {
        const io = (window as any).io();
        io.emit('navigation', { section });
      }, `Genesis 1:${i + 2}`);
      
      // Wait for UI update
      await page.waitForTimeout(50);
      
      const eventTime = Date.now() - startTime;
      eventTimes.push(eventTime);
    }
    
    const averageEventTime = eventTimes.reduce((a, b) => a + b, 0) / eventTimes.length;
    const maxEventTime = Math.max(...eventTimes);
    
    console.log('Real-time Performance:', {
      'Average Event Time': `${averageEventTime.toFixed(2)}ms`,
      'Max Event Time': `${maxEventTime}ms`,
      'Events Processed': eventTimes.length
    });
    
    // Real-time events should be processed quickly
    expect(averageEventTime).toBeLessThan(100); // < 100ms average
    expect(maxEventTime).toBeLessThan(200); // < 200ms max
    
    // Check for frame drops during real-time updates
    const frameDrops = await page.evaluate(() => {
      return new Promise((resolve) => {
        let frameCount = 0;
        let droppedFrames = 0;
        let lastTime = performance.now();
        
        const checkFrame = (currentTime: number) => {
          const deltaTime = currentTime - lastTime;
          if (deltaTime > 20) { // More than 20ms between frames (< 50fps)
            droppedFrames++;
          }
          frameCount++;
          lastTime = currentTime;
          
          if (frameCount < 60) { // Check 60 frames
            requestAnimationFrame(checkFrame);
          } else {
            resolve(droppedFrames);
          }
        };
        
        requestAnimationFrame(checkFrame);
      });
    });
    
    console.log(`Frame drops: ${frameDrops}/60 frames`);
    expect(frameDrops).toBeLessThan(5); // Less than 5 dropped frames out of 60
  });
});