import { test, expect } from '@playwright/test';

test.describe('Dashboard Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication
    await page.goto('/dashboard');
    await page.evaluate(() => {
      localStorage.setItem('token', 'mock-jwt-token');
      localStorage.setItem('user', JSON.stringify({
        id: '1',
        name: 'Test User',
        email: 'test@example.com'
      }));
    });
    
    // Mock API responses
    await page.route('**/api/havrutot', async route => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: '1',
            name: 'Genesis Study',
            bookTitle: 'Genesis',
            participants: ['Test User', 'Study Partner'],
            currentSection: 'Genesis 1:1',
            isActive: true,
            lastStudiedAt: new Date().toISOString()
          },
          {
            id: '2',
            name: 'Talmud Study',
            bookTitle: 'Berakhot',
            participants: ['Test User'],
            currentSection: 'Berakhot 2a',
            isActive: false,
            lastStudiedAt: new Date(Date.now() - 86400000).toISOString()
          }
        ])
      });
    });
    
    await page.reload();
  });

  test('should display user dashboard with Havrutot', async ({ page }) => {
    // Should display welcome message
    await expect(page.locator('text=Welcome, Test User')).toBeVisible();
    
    // Should display Havruta cards
    await expect(page.locator('[data-testid="havruta-card"]')).toHaveCount(2);
    
    // Should display book titles
    await expect(page.locator('text=Genesis')).toBeVisible();
    await expect(page.locator('text=Berakhot')).toBeVisible();
    
    // Should display current sections
    await expect(page.locator('text=Genesis 1:1')).toBeVisible();
    await expect(page.locator('text=Berakhot 2a')).toBeVisible();
  });

  test('should display Next Up section for active sessions', async ({ page }) => {
    // Should have Next Up section
    await expect(page.locator('text=Next Up')).toBeVisible();
    
    // Should display active Havruta in Next Up
    const nextUpSection = page.locator('[data-testid="next-up-section"]');
    await expect(nextUpSection.locator('text=Genesis Study')).toBeVisible();
  });

  test('should allow joining collaborative session', async ({ page }) => {
    // Mock session join API
    await page.route('**/api/havrutot/1/join', async route => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ success: true, sessionId: 'session-123' })
      });
    });
    
    // Click join collaborative button
    await page.click('[data-testid="join-collaborative-1"]');
    
    // Should navigate to session page
    await expect(page).toHaveURL(/.*session\/session-123/);
  });

  test('should allow inviting participants', async ({ page }) => {
    // Click invite participants button
    await page.click('[data-testid="invite-participants-1"]');
    
    // Should open invitation dialog
    await expect(page.locator('[data-testid="invitation-dialog"]')).toBeVisible();
    
    // Should have email input field
    await expect(page.locator('input[type="email"]')).toBeVisible();
    
    // Should have send invitation button
    await expect(page.locator('text=Send Invitation')).toBeVisible();
  });

  test('should create new Havruta', async ({ page }) => {
    // Mock Sefaria API for book selection
    await page.route('**/api/sefaria/index', async route => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify([
          { title: 'Genesis', heTitle: 'בראשית', categories: ['Tanakh', 'Torah'] },
          { title: 'Exodus', heTitle: 'שמות', categories: ['Tanakh', 'Torah'] }
        ])
      });
    });
    
    // Mock Havruta creation API
    await page.route('**/api/havrutot', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            id: '3',
            name: 'New Study Group',
            bookTitle: 'Exodus',
            participants: ['Test User'],
            currentSection: 'Exodus 1:1',
            isActive: false
          })
        });
      }
    });
    
    // Click create new Havruta button
    await page.click('[data-testid="create-havruta-button"]');
    
    // Should open creation dialog
    await expect(page.locator('[data-testid="create-havruta-dialog"]')).toBeVisible();
    
    // Fill in Havruta details
    await page.fill('input[name="name"]', 'New Study Group');
    await page.selectOption('select[name="book"]', 'Exodus');
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Should close dialog and refresh list
    await expect(page.locator('[data-testid="create-havruta-dialog"]')).not.toBeVisible();
  });

  test('should filter and sort Havrutot', async ({ page }) => {
    // Should have filter options
    await expect(page.locator('[data-testid="filter-active"]')).toBeVisible();
    await expect(page.locator('[data-testid="filter-all"]')).toBeVisible();
    
    // Filter by active sessions
    await page.click('[data-testid="filter-active"]');
    
    // Should show only active Havrutot
    await expect(page.locator('[data-testid="havruta-card"]')).toHaveCount(1);
    await expect(page.locator('text=Genesis Study')).toBeVisible();
    
    // Should have sort options
    await page.selectOption('[data-testid="sort-select"]', 'lastStudied');
    
    // Cards should be reordered
    const firstCard = page.locator('[data-testid="havruta-card"]').first();
    await expect(firstCard.locator('text=Genesis Study')).toBeVisible();
  });
});