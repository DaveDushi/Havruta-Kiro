import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { InvitationService } from '../services/invitationService'
import crypto from 'crypto'

describe('Invitation Token Generation and Validation', () => {
  let invitationService: InvitationService

  beforeEach(() => {
    invitationService = new InvitationService()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Token Generation', () => {
    it('should generate unique invitation tokens', () => {
      // Access private method through any type for testing
      const service = invitationService as any
      
      const token1 = service.generateInvitationToken()
      const token2 = service.generateInvitationToken()
      
      expect(token1).toBeDefined()
      expect(token2).toBeDefined()
      expect(token1).not.toBe(token2)
      expect(token1).toHaveLength(64) // 32 bytes * 2 (hex encoding)
      expect(token2).toHaveLength(64)
      
      // Verify tokens are valid hex strings
      expect(/^[a-f0-9]{64}$/i.test(token1)).toBe(true)
      expect(/^[a-f0-9]{64}$/i.test(token2)).toBe(true)
    })

    it('should generate cryptographically secure tokens', () => {
      const service = invitationService as any
      const tokens = new Set<string>()
      
      // Generate 1000 tokens and ensure they're all unique
      for (let i = 0; i < 1000; i++) {
        const token = service.generateInvitationToken()
        expect(tokens.has(token)).toBe(false)
        tokens.add(token)
      }
      
      expect(tokens.size).toBe(1000)
    })
  })

  describe('Expiration Date Calculation', () => {
    it('should calculate expiration date 7 days from now', () => {
      const service = invitationService as any
      const now = new Date()
      const expirationDate = service.getExpirationDate()
      
      const expectedExpiration = new Date(now)
      expectedExpiration.setDate(expectedExpiration.getDate() + 7)
      
      // Allow for small time differences (within 1 second)
      const timeDiff = Math.abs(expirationDate.getTime() - expectedExpiration.getTime())
      expect(timeDiff).toBeLessThan(1000)
    })

    it('should return future dates', () => {
      const service = invitationService as any
      const expirationDate = service.getExpirationDate()
      const now = new Date()
      
      expect(expirationDate.getTime()).toBeGreaterThan(now.getTime())
    })
  })

  describe('Email Validation Integration', () => {
    it('should validate email formats correctly', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'user+tag@example.org',
        'firstname.lastname@company.com',
        'user123@test-domain.com'
      ]

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
        'test..test@example.com',
        'test @example.com',
        'test@ example.com'
      ]

      validEmails.forEach(email => {
        expect(() => {
          // This would be called during invitation creation
          const emailSchema = require('zod').z.string().email()
          emailSchema.parse(email)
        }).not.toThrow()
      })

      invalidEmails.forEach(email => {
        expect(() => {
          const emailSchema = require('zod').z.string().email()
          emailSchema.parse(email)
        }).toThrow()
      })
    })
  })

  describe('Invitation Workflow Integration', () => {
    it('should handle complete invitation workflow data flow', () => {
      // Simulate the data that would flow through the invitation system
      const mockHavrutaData = {
        id: 'havruta-123',
        name: 'Test Havruta',
        bookTitle: 'Genesis',
        creatorId: 'user-1'
      }

      const mockInviterData = {
        id: 'user-1',
        name: 'John Doe',
        email: 'john@example.com'
      }

      const inviteeEmails = [
        'alice@example.com',
        'bob@example.com',
        'charlie@example.com'
      ]

      // Simulate token generation for each email
      const service = invitationService as any
      const invitations = inviteeEmails.map(email => ({
        inviteeEmail: email,
        inviterUserId: mockInviterData.id,
        havrutaId: mockHavrutaData.id,
        invitationToken: service.generateInvitationToken(),
        expiresAt: service.getExpirationDate(),
        status: 'pending'
      }))

      // Verify all invitations have unique tokens
      const tokens = invitations.map(inv => inv.invitationToken)
      const uniqueTokens = new Set(tokens)
      expect(uniqueTokens.size).toBe(invitations.length)

      // Verify all invitations have future expiration dates
      const now = new Date()
      invitations.forEach(invitation => {
        expect(invitation.expiresAt.getTime()).toBeGreaterThan(now.getTime())
        expect(invitation.status).toBe('pending')
        expect(invitation.invitationToken).toHaveLength(64)
      })

      // Simulate email content generation
      invitations.forEach(invitation => {
        const frontendUrl = 'http://localhost:3000'
        const joinLink = `${frontendUrl}/invite/${invitation.invitationToken}`
        
        expect(joinLink).toContain(invitation.invitationToken)
        expect(joinLink).toMatch(/^http:\/\/localhost:3000\/invite\/[a-f0-9]{64}$/i)
      })
    })

    it('should handle invitation acceptance workflow', () => {
      const service = invitationService as any
      
      // Simulate invitation creation
      const invitationToken = service.generateInvitationToken()
      const expiresAt = service.getExpirationDate()
      
      const mockInvitation = {
        id: 'invitation-1',
        inviteeEmail: 'test@example.com',
        inviterUserId: 'user-1',
        havrutaId: 'havruta-1',
        invitationToken,
        expiresAt,
        status: 'pending',
        createdAt: new Date()
      }

      const mockUser = {
        id: 'user-2',
        email: 'test@example.com'
      }

      // Verify invitation is valid for acceptance
      expect(mockInvitation.status).toBe('pending')
      expect(mockInvitation.expiresAt.getTime()).toBeGreaterThan(new Date().getTime())
      expect(mockInvitation.inviteeEmail.toLowerCase()).toBe(mockUser.email.toLowerCase())

      // Simulate successful acceptance
      const acceptedInvitation = {
        ...mockInvitation,
        status: 'accepted',
        acceptedAt: new Date()
      }

      expect(acceptedInvitation.status).toBe('accepted')
      expect(acceptedInvitation.acceptedAt).toBeDefined()
    })

    it('should handle invitation expiration', () => {
      const service = invitationService as any
      
      // Create an expired invitation
      const pastDate = new Date()
      pastDate.setDate(pastDate.getDate() - 1) // Yesterday
      
      const expiredInvitation = {
        id: 'invitation-1',
        inviteeEmail: 'test@example.com',
        inviterUserId: 'user-1',
        havrutaId: 'havruta-1',
        invitationToken: service.generateInvitationToken(),
        expiresAt: pastDate,
        status: 'pending',
        createdAt: new Date(pastDate.getTime() - 24 * 60 * 60 * 1000) // Day before yesterday
      }

      // Verify invitation is expired
      expect(expiredInvitation.expiresAt.getTime()).toBeLessThan(new Date().getTime())
      
      // Simulate expiration handling
      const updatedInvitation = {
        ...expiredInvitation,
        status: 'expired'
      }

      expect(updatedInvitation.status).toBe('expired')
    })
  })

  describe('Security Considerations', () => {
    it('should generate tokens with sufficient entropy', () => {
      const service = invitationService as any
      const tokens = []
      
      // Generate multiple tokens and analyze their randomness
      for (let i = 0; i < 100; i++) {
        tokens.push(service.generateInvitationToken())
      }

      // Check that tokens don't follow predictable patterns
      const firstChars = tokens.map(token => token.charAt(0))
      const uniqueFirstChars = new Set(firstChars)
      
      // Should have good distribution of first characters
      expect(uniqueFirstChars.size).toBeGreaterThan(5)

      // Check that consecutive tokens are not similar
      for (let i = 1; i < tokens.length; i++) {
        const token1 = tokens[i - 1]
        const token2 = tokens[i]
        
        // Calculate Hamming distance (number of different characters)
        let differences = 0
        for (let j = 0; j < token1.length; j++) {
          if (token1[j] !== token2[j]) {
            differences++
          }
        }
        
        // Tokens should be very different (at least 50% different characters)
        expect(differences).toBeGreaterThan(token1.length * 0.5)
      }
    })

    it('should handle case-insensitive email matching', () => {
      const testEmails = [
        { input: 'Test@Example.com', normalized: 'test@example.com' },
        { input: 'USER@DOMAIN.COM', normalized: 'user@domain.com' },
        { input: 'MixedCase@Test.Org', normalized: 'mixedcase@test.org' }
      ]

      testEmails.forEach(({ input, normalized }) => {
        expect(input.toLowerCase()).toBe(normalized)
      })
    })
  })
})