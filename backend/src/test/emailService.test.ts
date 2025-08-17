import { describe, it, expect, beforeEach, vi } from 'vitest'
import { EmailService } from '../services/emailService'

// Mock nodemailer
vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn(() => ({
      sendMail: vi.fn(),
      verify: vi.fn()
    }))
  }
}))

describe('EmailService', () => {
  let emailService: EmailService

  beforeEach(() => {
    // Mock environment variables
    vi.stubEnv('EMAIL_HOST', 'smtp.example.com')
    vi.stubEnv('EMAIL_PORT', '587')
    vi.stubEnv('EMAIL_USER', 'test@example.com')
    vi.stubEnv('EMAIL_PASS', 'password')
    vi.stubEnv('EMAIL_FROM', 'noreply@havruta.app')
    vi.stubEnv('FRONTEND_URL', 'http://localhost:3000')

    emailService = new EmailService()
  })

  describe('validateEmailFormat', () => {
    it('should validate correct email formats', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'user+tag@example.org',
        'firstname.lastname@company.com'
      ]

      validEmails.forEach(email => {
        expect(emailService.validateEmailFormat(email)).toBe(true)
      })
    })

    it('should reject invalid email formats', () => {
      const invalidEmails = [
        'invalid-email',
        '@example.com',
        'test@',
        'test.example.com',
        'test@.com',
        'test@com',
        '',
        ' ',
        'test@example.',
        'test..test@example.com'
      ]

      invalidEmails.forEach(email => {
        expect(emailService.validateEmailFormat(email)).toBe(false)
      })
    })

    it('should handle emails with whitespace', () => {
      expect(emailService.validateEmailFormat('  test@example.com  ')).toBe(true)
      expect(emailService.validateEmailFormat('test @example.com')).toBe(false)
      expect(emailService.validateEmailFormat('test@ example.com')).toBe(false)
    })
  })

  describe('isAvailable', () => {
    it('should return true when email service is configured', () => {
      expect(emailService.isAvailable()).toBe(true)
    })

    it('should return false when email configuration is missing', () => {
      vi.stubEnv('EMAIL_HOST', '')
      const unconfiguredService = new EmailService()
      expect(unconfiguredService.isAvailable()).toBe(false)
    })
  })

  describe('sendHavrutaInvitation', () => {
    it('should throw error for invalid email format', async () => {
      const invitation = {
        havrutaId: 'havruta-1',
        havrutaName: 'Test Havruta',
        bookTitle: 'Genesis',
        inviterName: 'John Doe',
        joinLink: 'http://localhost:3000/invite/token123',
        invitationToken: 'token123'
      }

      await expect(
        emailService.sendHavrutaInvitation('invalid-email', invitation)
      ).rejects.toThrow('Invalid email format')
    })

    it('should throw error when email service is not configured', async () => {
      vi.stubEnv('EMAIL_HOST', '')
      const unconfiguredService = new EmailService()
      
      const invitation = {
        havrutaId: 'havruta-1',
        havrutaName: 'Test Havruta',
        bookTitle: 'Genesis',
        inviterName: 'John Doe',
        joinLink: 'http://localhost:3000/invite/token123',
        invitationToken: 'token123'
      }

      await expect(
        unconfiguredService.sendHavrutaInvitation('test@example.com', invitation)
      ).rejects.toThrow('Email service is not configured')
    })
  })

  describe('generateInvitationEmailHTML', () => {
    it('should generate different content for new vs existing users', () => {
      const invitation = {
        havrutaId: 'havruta-1',
        havrutaName: 'Test Havruta',
        bookTitle: 'Genesis',
        inviterName: 'John Doe',
        joinLink: 'http://localhost:3000/invite/token123',
        invitationToken: 'token123'
      }

      // Access private method through any type for testing
      const service = emailService as any
      
      const newUserHTML = service.generateInvitationEmailHTML(invitation, true)
      const existingUserHTML = service.generateInvitationEmailHTML(invitation, false)

      expect(newUserHTML).toContain('create an account first')
      expect(newUserHTML).toContain('Join Havruta & Accept Invitation')
      
      expect(existingUserHTML).toContain('You already have a Havruta account')
      expect(existingUserHTML).toContain('Accept Invitation')
      
      // Both should contain common elements
      expect(newUserHTML).toContain('Test Havruta')
      expect(newUserHTML).toContain('Genesis')
      expect(newUserHTML).toContain('John Doe')
      
      expect(existingUserHTML).toContain('Test Havruta')
      expect(existingUserHTML).toContain('Genesis')
      expect(existingUserHTML).toContain('John Doe')
    })
  })

  describe('generateInvitationEmailText', () => {
    it('should generate different text content for new vs existing users', () => {
      const invitation = {
        havrutaId: 'havruta-1',
        havrutaName: 'Test Havruta',
        bookTitle: 'Genesis',
        inviterName: 'John Doe',
        joinLink: 'http://localhost:3000/invite/token123',
        invitationToken: 'token123'
      }

      // Access private method through any type for testing
      const service = emailService as any
      
      const newUserText = service.generateInvitationEmailText(invitation, true)
      const existingUserText = service.generateInvitationEmailText(invitation, false)

      expect(newUserText).toContain('create an account first')
      expect(existingUserText).toContain('You already have a Havruta account')
      
      // Both should contain common elements
      expect(newUserText).toContain('Test Havruta')
      expect(newUserText).toContain('Genesis')
      expect(newUserText).toContain('John Doe')
      
      expect(existingUserText).toContain('Test Havruta')
      expect(existingUserText).toContain('Genesis')
      expect(existingUserText).toContain('John Doe')
    })
  })
})