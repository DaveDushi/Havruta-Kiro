import { test, expect } from '@playwright/test';

test.describe('Load Testing', () => {
  test('should handle concurrent user sessions', async ({ browser }) => {
    const contexts = [];
    const pages = [];
    const userCount = 10;
    
    // Create multiple browser contexts to simulate different users
    for (let i = 0; i < userCount; i++) {
      const context = await browser.newContext();
      const page = await context.newPage();
      
      // Mock authentication for each user
      await page.evaluate((userId) => {
        localStorage.setItem('token', `mock-jwt-token-${userId}`);
        localStorage.setItem('user', JSON.stringify({
          id: userId.toString(),
          name: `User ${userId}`,
          email: `user${userId}@example.com`
        }));
      }, i + 1);
      
      contexts.push(context);
      pages.push(page);
    }
    
    // Mock API responses for concurrent requests
    for (const page of pages) {
      await page.route('**/api/havrutot', async route => {
        // Add artificial delay to simulate real API
        await new Promise(resolve => setTimeout(resolve, 100));
        
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: '1',
              name: 'Concurrent Study',
              bookTitle: 'Genesis',
              participants: ['Test User'],
              currentSection: 'Genesis 1:1',
              isActive: true
            }
          ])
        });
      });
    }
    
    // Measure concurrent dashboard loading
    const startTime = Date.now();
    
    const loadPromises = pages.map(async (page, index) => {
      const pageStartTime = Date.now();
      await page.goto('/dashboard');
      
      // Wait for content to load
      await expect(page.locator('[data-testid="havruta-card"]')).toBeVisible();
      
      const pageLoadTime = Date.now() - pageStartTime;
      console.log(`User ${index + 1} dashboard loaded in ${pageLoadTime}ms`);
      
      return pageLoadTime;
    });
    
    const loadTimes = await Promise.all(loadPromises);
    const totalTime = Date.now() - startTime;
    
    console.log(`All ${userCount} users loaded dashboards in ${totalTime}ms`);
    console.log(`Average load time: ${loadTimes.reduce((a, b) => a + b, 0) / loadTimes.length}ms`);
    console.log(`Max load time: ${Math.max(...loadTimes)}ms`);
    
    // Verify all pages loaded successfully
    expect(loadTimes.every(time => time < 5000)).toBe(true); // All should load within 5 seconds
    
    // Clean up
    for (const context of contexts) {
      await context.close();
    }
  });

  test('should handle concurrent session joins', async ({ browser }) => {
    const sessionId = 'load-test-session';
    const userCount = 5;
    const contexts = [];
    const pages = [];
    
    // Create multiple users
    for (let i = 0; i < userCount; i++) {
      const context = await browser.newContext();
      const page = await context.newPage();
      
      await page.evaluate((userId) => {
        localStorage.setItem('token', `mock-jwt-token-${userId}`);
        localStorage.setItem('user', JSON.stringify({
          id: userId.toString(),
          name: `User ${userId}`,
          email: `user${userId}@example.com`
        }));
      }, i + 1);
      
      // Mock session API
      await page.route(`**/api/sessions/${sessionId}`, async route => {
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            id: sessionId,
            havrutaId: '1',
            participants: Array.from({ length: userCount }, (_, idx) => ({
              id: (idx + 1).toString(),
              name: `User ${idx + 1}`,
              isOnline: true
            })),
            currentSection: 'Genesis 1:1',
            bookTitle: 'Genesis'
          })
        });
      });
      
      // Mock text content
      await page.route('**/api/sefaria/text/*', async route => {
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            ref: 'Genesis 1:1',
            text: ['In the beginning God created the heaven and the earth.'],
            he: ['בְּרֵאשִׁית בָּרָא אֱלֹהִים אֵת הַשָּׁמַיִם וְאֵת הָאָרֶץ׃']
          })
        });
      });
      
      contexts.push(context);
      pages.push(page);
    }
    
    // Measure concurrent session joins
    const startTime = Date.now();
    
    const joinPromises = pages.map(async (page, index) => {
      const joinStartTime = Date.now();
      await page.goto(`/session/${sessionId}`);
      
      // Wait for session to load
      await expect(page.locator('[data-testid="session-header"]')).toBeVisible();
      await expect(page.locator('[data-testid="text-viewer"]')).toBeVisible();
      
      const joinTime = Date.now() - joinStartTime;
      console.log(`User ${index + 1} joined session in ${joinTime}ms`);
      
      return joinTime;
    });
    
    const joinTimes = await Promise.all(joinPromises);
    const totalTime = Date.now() - startTime;
    
    console.log(`All ${userCount} users joined session in ${totalTime}ms`);
    console.log(`Average join time: ${joinTimes.reduce((a, b) => a + b, 0) / joinTimes.length}ms`);
    
    // Verify all users joined successfully
    expect(joinTimes.every(time => time < 3000)).toBe(true); // All should join within 3 seconds
    
    // Test concurrent navigation
    const navStartTime = Date.now();
    
    const navPromises = pages.map(async (page, index) => {
      // Mock navigation API
      await page.route(`**/api/sessions/${sessionId}/navigate`, async route => {
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({ success: true })
        });
      });
      
      await page.click('[data-testid="next-section"]');
      return Date.now() - navStartTime;
    });
    
    await Promise.all(navPromises);
    
    // Clean up
    for (const context of contexts) {
      await context.close();
    }
  });

  test('should measure API response times', async ({ page }) => {
    const apiMetrics = {
      dashboard: [],
      session: [],
      text: [],
      navigation: []
    };
    
    // Intercept and measure API calls
    await page.route('**/api/havrutot', async route => {
      const startTime = Date.now();
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify([])
      });
      apiMetrics.dashboard.push(Date.now() - startTime);
    });
    
    await page.route('**/api/sessions/*', async route => {
      const startTime = Date.now();
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'test-session',
          participants: [],
          currentSection: 'Genesis 1:1'
        })
      });
      apiMetrics.session.push(Date.now() - startTime);
    });
    
    await page.route('**/api/sefaria/text/*', async route => {
      const startTime = Date.now();
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          ref: 'Genesis 1:1',
          text: ['Sample text'],
          he: ['טקסט לדוגמה']
        })
      });
      apiMetrics.text.push(Date.now() - startTime);
    });
    
    // Mock authentication
    await page.evaluate(() => {
      localStorage.setItem('token', 'mock-jwt-token');
      localStorage.setItem('user', JSON.stringify({
        id: '1',
        name: 'Test User',
        email: 'test@example.com'
      }));
    });
    
    // Test multiple page loads
    for (let i = 0; i < 5; i++) {
      await page.goto('/dashboard');
      await page.waitForTimeout(100);
      
      await page.goto('/session/test-session');
      await page.waitForTimeout(100);
    }
    
    // Calculate and verify metrics
    const avgDashboard = apiMetrics.dashboard.reduce((a, b) => a + b, 0) / apiMetrics.dashboard.length;
    const avgSession = apiMetrics.session.reduce((a, b) => a + b, 0) / apiMetrics.session.length;
    const avgText = apiMetrics.text.reduce((a, b) => a + b, 0) / apiMetrics.text.length;
    
    console.log(`Average API response times:`);
    console.log(`Dashboard: ${avgDashboard}ms`);
    console.log(`Session: ${avgSession}ms`);
    console.log(`Text: ${avgText}ms`);
    
    // Verify response times are acceptable
    expect(avgDashboard).toBeLessThan(200);
    expect(avgSession).toBeLessThan(200);
    expect(avgText).toBeLessThan(200);
  });

  test('should handle memory usage during extended session', async ({ page }) => {
    // Mock authentication
    await page.evaluate(() => {
      localStorage.setItem('token', 'mock-jwt-token');
      localStorage.setItem('user', JSON.stringify({
        id: '1',
        name: 'Test User',
        email: 'test@example.com'
      }));
    });
    
    // Mock session and text APIs
    await page.route('**/api/sessions/memory-test', async route => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'memory-test',
          participants: [{ id: '1', name: 'Test User', isOnline: true }],
          currentSection: 'Genesis 1:1'
        })
      });
    });
    
    let sectionCounter = 1;
    await page.route('**/api/sefaria/text/*', async route => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          ref: `Genesis 1:${sectionCounter}`,
          text: [`Sample text for verse ${sectionCounter}`],
          he: [`טקסט לדוגמה לפסוק ${sectionCounter}`]
        })
      });
      sectionCounter++;
    });
    
    await page.route('**/api/sessions/memory-test/navigate', async route => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      });
    });
    
    // Start session
    await page.goto('/session/memory-test');
    await expect(page.locator('[data-testid="session-header"]')).toBeVisible();
    
    // Measure initial memory
    const initialMemory = await page.evaluate(() => {
      return (performance as any).memory ? (performance as any).memory.usedJSHeapSize : 0;
    });
    
    // Simulate extended navigation (100 sections)
    for (let i = 0; i < 100; i++) {
      await page.click('[data-testid="next-section"]');
      await page.waitForTimeout(50);
      
      // Check memory every 20 navigations
      if (i % 20 === 0) {
        const currentMemory = await page.evaluate(() => {
          return (performance as any).memory ? (performance as any).memory.usedJSHeapSize : 0;
        });
        
        console.log(`Memory after ${i} navigations: ${(currentMemory / 1024 / 1024).toFixed(2)} MB`);
      }
    }
    
    // Measure final memory
    const finalMemory = await page.evaluate(() => {
      return (performance as any).memory ? (performance as any).memory.usedJSHeapSize : 0;
    });
    
    const memoryIncrease = finalMemory - initialMemory;
    console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)} MB`);
    
    // Verify memory usage is reasonable (less than 50MB increase)
    expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
  });
});