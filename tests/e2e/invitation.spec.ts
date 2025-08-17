import { test, expect } from '@playwright/test';

test.describe('Participant Invitation System', () => {
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
    
    // Mock Havruta data
    await page.route('**/api/havrutot/1', async route => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          id: '1',
          name: 'Genesis Study',
          bookTitle: 'Genesis',
          participants: ['Test User'],
          currentSection: 'Genesis 1:1',
          isActive: false
        })
      });
    });
    
    await page.goto('/dashboard');
  });

  test('should open invitation dialog', async ({ page }) => {
    // Click invite participants button
    await page.click('[data-testid="invite-participants-1"]');
    
    // Should display invitation dialog
    await expect(page.locator('[data-testid="invitation-dialog"]')).toBeVisible();
    
    // Should have dialog title
    await expect(page.locator('text=Invite Participants')).toBeVisible();
    
    // Should have email input field
    await expect(page.locator('input[type="email"]')).toBeVisible();
    
    // Should have send button (initially disabled)
    const sendButton = page.locator('[data-testid="send-invitation-button"]');
    await expect(sendButton).toBeVisible();
    await expect(sendButton).toBeDisabled();
  });

  test('should validate email addresses', async ({ page }) => {
    await page.click('[data-testid="invite-participants-1"]');
    
    const emailInput = page.locator('input[type="email"]');
    const sendButton = page.locator('[data-testid="send-invitation-button"]');
    
    // Test invalid email
    await emailInput.fill('invalid-email');
    await expect(page.locator('text=Please enter a valid email address')).toBeVisible();
    await expect(sendButton).toBeDisabled();
    
    // Test valid email
    await emailInput.fill('friend@example.com');
    await expect(page.locator('text=Please enter a valid email address')).not.toBeVisible();
    await expect(sendButton).toBeEnabled();
    
    // Test multiple emails
    await emailInput.fill('friend1@example.com, friend2@example.com');
    await expect(sendButton).toBeEnabled();
    
    // Test mixed valid/invalid emails
    await emailInput.fill('friend@example.com, invalid-email');
    await expect(page.locator('text=Please check all email addresses')).toBeVisible();
    await expect(sendButton).toBeDisabled();
  });

  test('should send invitations successfully', async ({ page }) => {
    // Mock successful invitation API
    await page.route('**/api/havrutot/1/invite', async route => {
      const request = route.request();
      const body = await request.postDataJSON();
      
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          successful: body.emails,
          failed: [],
          existingUsers: ['friend1@example.com'],
          newUsers: ['friend2@example.com']
        })
      });
    });
    
    await page.click('[data-testid="invite-participants-1"]');
    
    // Fill in email addresses
    await page.fill('input[type="email"]', 'friend1@example.com, friend2@example.com');
    
    // Send invitations
    await page.click('[data-testid="send-invitation-button"]');
    
    // Should show success message
    await expect(page.locator('text=Invitations sent successfully!')).toBeVisible();
    
    // Should show details about existing vs new users
    await expect(page.locator('text=friend1@example.com was added directly')).toBeVisible();
    await expect(page.locator('text=friend2@example.com will receive an invitation email')).toBeVisible();
    
    // Dialog should close after success
    await expect(page.locator('[data-testid="invitation-dialog"]')).not.toBeVisible();
  });

  test('should handle invitation failures', async ({ page }) => {
    // Mock failed invitation API
    await page.route('**/api/havrutot/1/invite', async route => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          successful: ['friend1@example.com'],
          failed: [
            { email: 'friend2@example.com', reason: 'Email service unavailable' }
          ],
          existingUsers: ['friend1@example.com'],
          newUsers: []
        })
      });
    });
    
    await page.click('[data-testid="invite-participants-1"]');
    
    // Fill in email addresses
    await page.fill('input[type="email"]', 'friend1@example.com, friend2@example.com');
    
    // Send invitations
    await page.click('[data-testid="send-invitation-button"]');
    
    // Should show partial success message
    await expect(page.locator('text=Some invitations could not be sent')).toBeVisible();
    
    // Should show successful invitations
    await expect(page.locator('text=friend1@example.com was added successfully')).toBeVisible();
    
    // Should show failed invitations with reasons
    await expect(page.locator('text=friend2@example.com: Email service unavailable')).toBeVisible();
    
    // Should provide retry option for failed invitations
    await expect(page.locator('[data-testid="retry-failed-button"]')).toBeVisible();
  });

  test('should retry failed invitations', async ({ page }) => {
    // Mock initial failure then success
    let attemptCount = 0;
    await page.route('**/api/havrutot/1/invite', async route => {
      attemptCount++;
      
      if (attemptCount === 1) {
        // First attempt fails
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            successful: [],
            failed: [
              { email: 'friend@example.com', reason: 'Temporary server error' }
            ],
            existingUsers: [],
            newUsers: []
          })
        });
      } else {
        // Retry succeeds
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            successful: ['friend@example.com'],
            failed: [],
            existingUsers: [],
            newUsers: ['friend@example.com']
          })
        });
      }
    });
    
    await page.click('[data-testid="invite-participants-1"]');
    await page.fill('input[type="email"]', 'friend@example.com');
    await page.click('[data-testid="send-invitation-button"]');
    
    // Should show failure initially
    await expect(page.locator('text=friend@example.com: Temporary server error')).toBeVisible();
    
    // Retry failed invitations
    await page.click('[data-testid="retry-failed-button"]');
    
    // Should show success after retry
    await expect(page.locator('text=Invitations sent successfully!')).toBeVisible();
  });

  test('should handle network errors', async ({ page }) => {
    // Mock network error
    await page.route('**/api/havrutot/1/invite', async route => {
      await route.abort('failed');
    });
    
    await page.click('[data-testid="invite-participants-1"]');
    await page.fill('input[type="email"]', 'friend@example.com');
    await page.click('[data-testid="send-invitation-button"]');
    
    // Should show network error message
    await expect(page.locator('text=Network error. Please check your connection and try again.')).toBeVisible();
    
    // Should provide retry option
    await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();
  });

  test('should close dialog without sending', async ({ page }) => {
    await page.click('[data-testid="invite-participants-1"]');
    
    // Fill in some data
    await page.fill('input[type="email"]', 'friend@example.com');
    
    // Close dialog using X button
    await page.click('[data-testid="close-dialog-button"]');
    
    // Dialog should close
    await expect(page.locator('[data-testid="invitation-dialog"]')).not.toBeVisible();
    
    // Should not send any invitations
    // (No API calls should be made)
  });

  test('should handle invitation acceptance flow', async ({ page }) => {
    // Test invitation link acceptance
    const invitationToken = 'mock-invitation-token';
    
    // Mock invitation validation API
    await page.route(`**/api/invitations/${invitationToken}`, async route => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'invitation-123',
          havrutaId: '1',
          havrutaName: 'Genesis Study',
          inviterName: 'Test User',
          bookTitle: 'Genesis',
          status: 'pending'
        })
      });
    });
    
    // Mock invitation acceptance API
    await page.route(`**/api/invitations/${invitationToken}/accept`, async route => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          havrutaId: '1'
        })
      });
    });
    
    // Visit invitation link
    await page.goto(`/invite/${invitationToken}`);
    
    // Should display invitation details
    await expect(page.locator('text=You\'ve been invited to join')).toBeVisible();
    await expect(page.locator('text=Genesis Study')).toBeVisible();
    await expect(page.locator('text=by Test User')).toBeVisible();
    
    // Should have accept and decline buttons
    await expect(page.locator('[data-testid="accept-invitation"]')).toBeVisible();
    await expect(page.locator('[data-testid="decline-invitation"]')).toBeVisible();
    
    // Accept invitation
    await page.click('[data-testid="accept-invitation"]');
    
    // Should redirect to Havruta dashboard
    await expect(page).toHaveURL(/.*dashboard/);
    
    // Should show success message
    await expect(page.locator('text=Successfully joined Genesis Study!')).toBeVisible();
  });

  test('should handle expired invitations', async ({ page }) => {
    const invitationToken = 'expired-token';
    
    // Mock expired invitation API
    await page.route(`**/api/invitations/${invitationToken}`, async route => {
      await route.fulfill({
        status: 410,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Invitation has expired'
        })
      });
    });
    
    // Visit expired invitation link
    await page.goto(`/invite/${invitationToken}`);
    
    // Should display expiration message
    await expect(page.locator('text=This invitation has expired')).toBeVisible();
    
    // Should provide link to request new invitation
    await expect(page.locator('text=Request a new invitation')).toBeVisible();
  });
});