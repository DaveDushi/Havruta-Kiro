import { test, expect } from '@playwright/test';

test.describe('Havruta Session Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication
    await page.evaluate(() => {
      localStorage.setItem('token', 'mock-jwt-token');
      localStorage.setItem('user', JSON.stringify({
        id: '1',
        name: 'Test User',
        email: 'test@example.com'
      }));
    });
    
    // Mock session data
    await page.route('**/api/sessions/session-123', async route => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'session-123',
          havrutaId: '1',
          participants: [
            { id: '1', name: 'Test User', isOnline: true },
            { id: '2', name: 'Study Partner', isOnline: true }
          ],
          currentSection: 'Genesis 1:1',
          bookTitle: 'Genesis'
        })
      });
    });
    
    // Mock Sefaria text content
    await page.route('**/api/sefaria/text/*', async route => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          ref: 'Genesis 1:1',
          heRef: 'בראשית א׳:א׳',
          text: ['In the beginning God created the heaven and the earth.'],
          he: ['בְּרֵאשִׁית בָּרָא אֱלֹהִים אֵת הַשָּׁמַיִם וְאֵת הָאָרֶץ׃'],
          textDepth: 1,
          sectionNames: ['Verse']
        })
      });
    });
    
    await page.goto('/session/session-123');
  });

  test('should display session interface', async ({ page }) => {
    // Should display session header
    await expect(page.locator('[data-testid="session-header"]')).toBeVisible();
    
    // Should display book title and current section
    await expect(page.locator('text=Genesis')).toBeVisible();
    await expect(page.locator('text=Genesis 1:1')).toBeVisible();
    
    // Should display participants list
    await expect(page.locator('[data-testid="participants-list"]')).toBeVisible();
    await expect(page.locator('text=Test User')).toBeVisible();
    await expect(page.locator('text=Study Partner')).toBeVisible();
    
    // Should display online status indicators
    await expect(page.locator('[data-testid="online-indicator"]')).toHaveCount(2);
  });

  test('should display text content', async ({ page }) => {
    // Should display text viewer
    await expect(page.locator('[data-testid="text-viewer"]')).toBeVisible();
    
    // Should display Hebrew text
    await expect(page.locator('text=בְּרֵאשִׁית בָּרָא אֱלֹהִים')).toBeVisible();
    
    // Should display English text
    await expect(page.locator('text=In the beginning God created')).toBeVisible();
    
    // Should have navigation controls
    await expect(page.locator('[data-testid="prev-section"]')).toBeVisible();
    await expect(page.locator('[data-testid="next-section"]')).toBeVisible();
  });

  test('should navigate between text sections', async ({ page }) => {
    // Mock next section API
    await page.route('**/api/sefaria/text/Genesis%201:2', async route => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          ref: 'Genesis 1:2',
          heRef: 'בראשית א׳:ב׳',
          text: ['And the earth was without form, and void; and darkness was upon the face of the deep.'],
          he: ['וְהָאָרֶץ הָיְתָה תֹהוּ וָבֹהוּ וְחֹשֶׁךְ עַל־פְּנֵי תְהוֹם'],
          textDepth: 1,
          sectionNames: ['Verse']
        })
      });
    });
    
    // Mock navigation sync API
    await page.route('**/api/sessions/session-123/navigate', async route => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      });
    });
    
    // Click next section button
    await page.click('[data-testid="next-section"]');
    
    // Should update to next verse
    await expect(page.locator('text=Genesis 1:2')).toBeVisible();
    await expect(page.locator('text=And the earth was without form')).toBeVisible();
  });

  test('should handle real-time synchronization', async ({ page }) => {
    // Mock WebSocket connection
    await page.evaluate(() => {
      // Mock Socket.io client
      (window as any).io = () => ({
        on: (event: string, callback: Function) => {
          if (event === 'navigation-sync') {
            // Simulate receiving navigation event from another participant
            setTimeout(() => {
              callback({
                section: 'Genesis 1:3',
                participantId: '2',
                participantName: 'Study Partner'
              });
            }, 1000);
          }
        },
        emit: () => {},
        disconnect: () => {}
      });
    });
    
    // Mock the new section content
    await page.route('**/api/sefaria/text/Genesis%201:3', async route => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          ref: 'Genesis 1:3',
          heRef: 'בראשית א׳:ג׳',
          text: ['And God said, Let there be light: and there was light.'],
          he: ['וַיֹּאמֶר אֱלֹהִים יְהִי אוֹר וַיְהִי־אוֹר׃'],
          textDepth: 1,
          sectionNames: ['Verse']
        })
      });
    });
    
    // Wait for sync event to be processed
    await page.waitForTimeout(1500);
    
    // Should display synced content
    await expect(page.locator('text=Genesis 1:3')).toBeVisible();
    await expect(page.locator('text=And God said, Let there be light')).toBeVisible();
    
    // Should show sync notification
    await expect(page.locator('text=Study Partner navigated to Genesis 1:3')).toBeVisible();
  });

  test('should initialize video call', async ({ page }) => {
    // Mock WebRTC APIs
    await page.evaluate(() => {
      (navigator as any).mediaDevices = {
        getUserMedia: () => Promise.resolve(new MediaStream())
      };
      
      (window as any).RTCPeerConnection = class {
        createOffer() { return Promise.resolve({}); }
        createAnswer() { return Promise.resolve({}); }
        setLocalDescription() { return Promise.resolve(); }
        setRemoteDescription() { return Promise.resolve(); }
        addIceCandidate() { return Promise.resolve(); }
        addEventListener() {}
        removeEventListener() {}
      };
    });
    
    // Should display video call interface
    await expect(page.locator('[data-testid="video-call-container"]')).toBeVisible();
    
    // Should have video controls
    await expect(page.locator('[data-testid="toggle-video"]')).toBeVisible();
    await expect(page.locator('[data-testid="toggle-audio"]')).toBeVisible();
    
    // Should display local video
    await expect(page.locator('[data-testid="local-video"]')).toBeVisible();
  });

  test('should toggle video and audio', async ({ page }) => {
    // Mock media stream
    await page.evaluate(() => {
      (navigator as any).mediaDevices = {
        getUserMedia: () => Promise.resolve(new MediaStream())
      };
    });
    
    // Toggle video off
    await page.click('[data-testid="toggle-video"]');
    
    // Video button should show as disabled
    await expect(page.locator('[data-testid="toggle-video"][data-enabled="false"]')).toBeVisible();
    
    // Toggle audio off
    await page.click('[data-testid="toggle-audio"]');
    
    // Audio button should show as disabled
    await expect(page.locator('[data-testid="toggle-audio"][data-enabled="false"]')).toBeVisible();
  });

  test('should save progress automatically', async ({ page }) => {
    // Mock progress save API
    await page.route('**/api/sessions/session-123/progress', async route => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      });
    });
    
    // Navigate to trigger progress save
    await page.click('[data-testid="next-section"]');
    
    // Wait for auto-save
    await page.waitForTimeout(2000);
    
    // Should show save indicator
    await expect(page.locator('[data-testid="save-indicator"]')).toBeVisible();
  });

  test('should handle session errors gracefully', async ({ page }) => {
    // Mock API error
    await page.route('**/api/sefaria/text/*', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Failed to load text' })
      });
    });
    
    // Try to navigate
    await page.click('[data-testid="next-section"]');
    
    // Should display error message
    await expect(page.locator('text=Failed to load text')).toBeVisible();
    
    // Should provide retry option
    await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();
  });

  test('should leave session properly', async ({ page }) => {
    // Mock leave session API
    await page.route('**/api/sessions/session-123/leave', async route => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      });
    });
    
    // Click leave session button
    await page.click('[data-testid="leave-session"]');
    
    // Should show confirmation dialog
    await expect(page.locator('text=Are you sure you want to leave?')).toBeVisible();
    
    // Confirm leaving
    await page.click('[data-testid="confirm-leave"]');
    
    // Should redirect to dashboard
    await expect(page).toHaveURL(/.*dashboard/);
  });
});