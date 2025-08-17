import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('should display login page', async ({ page }) => {
    await page.goto('/');
    
    // Should redirect to login if not authenticated
    await expect(page).toHaveURL(/.*login/);
    
    // Should display OAuth login options
    await expect(page.locator('text=Sign in with Google')).toBeVisible();
    
    // Should have proper page title
    await expect(page).toHaveTitle(/Havruta/);
  });

  test('should handle OAuth redirect flow', async ({ page }) => {
    await page.goto('/login');
    
    // Mock OAuth success response
    await page.route('**/auth/google/callback*', async route => {
      await route.fulfill({
        status: 302,
        headers: {
          'Location': '/dashboard?token=mock-jwt-token'
        }
      });
    });
    
    // Click Google OAuth button
    await page.click('text=Sign in with Google');
    
    // Should redirect to dashboard after successful auth
    await expect(page).toHaveURL(/.*dashboard/);
  });

  test('should handle authentication errors', async ({ page }) => {
    await page.goto('/login');
    
    // Mock OAuth error response
    await page.route('**/auth/google/callback*', async route => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Authentication failed' })
      });
    });
    
    // Click Google OAuth button
    await page.click('text=Sign in with Google');
    
    // Should display error message
    await expect(page.locator('text=Authentication failed')).toBeVisible();
    
    // Should remain on login page
    await expect(page).toHaveURL(/.*login/);
  });

  test('should logout successfully', async ({ page }) => {
    // Mock authenticated state
    await page.goto('/dashboard');
    await page.evaluate(() => {
      localStorage.setItem('token', 'mock-jwt-token');
    });
    
    // Click logout button
    await page.click('[data-testid="logout-button"]');
    
    // Should redirect to login page
    await expect(page).toHaveURL(/.*login/);
    
    // Token should be removed
    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).toBeNull();
  });
});