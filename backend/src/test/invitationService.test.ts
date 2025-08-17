import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { InvitationService } from '../services/invitationService'
import { prisma } from '../utils/database'
import { emailService } from '../services/emailService'

// Mock the database and email service
vi.mock('../utils/database', () => ({
  prisma: {
    invitation: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn()
    },
    havruta: {
      findUnique: vi.fn()
    },
    user: {
      findUnique: vi.fn()
    },
    havrutaParticipant: {
      findUnique: vi.fn(),
      create: vi.fn()
    },
    $transaction: vi.fn()
  }
}))

vi.mock('../services/emailService', () => ({
  emailService: {
    sendHavrutaInvitation: vi.fn(),
    validateEmailFormat: vi.fn()
  }
}))

describe('InvitationService', () => {
  let invitationService: InvitationService

  beforeEach(() => {
    invitationService = new InvitationService()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('inviteParticipants', () => {
    const mockHavruta = {
      id: 'havruta-1',
      name: 'Test Havruta',
      bookTitle: 'Genesis',
      creatorId: 'user-1',
      creator: {
        id: 'user-1',
        name: 'John Doe',
        email: 'john@example.com',
        profilePicture: null
      },
      participants: []
    }

    beforeEach(() => {
      vi.mocked(prisma.havruta.findUnique).mockResolvedValue(mockHavruta)
      vi.mocked(emailService.validateEmailFormat).mockReturnValue(true)
    })

    it('should validate input data', async () => {
      await expect(
        invitationService.inviteParticipants({
          havrutaId: '',
          emails: [],
          inviterUserId: 'user-1'
        })
      ).rejects.toThrow('Validation error')

      await expect(
        invitationService.inviteParticipants({
          havrutaId: 'havruta-1',
          emails: ['invalid-email'],
          inviterUserId: 'user-1'
        })
      ).rejects.toThrow('Validation error')
    })

    it('should throw error if havruta not found', async () => {
      vi.mocked(prisma.havruta.findUnique).mockResolvedValue(null)

      await expect(
        invitationService.inviteParticipants({
          havrutaId: 'nonexistent',
          emails: ['test@example.com'],
          inviterUserId: 'user-1'
        })
      ).rejects.toThrow('Havruta not found')
    })

    it('should throw error if inviter is not a participant', async () => {
      const mockUser = { id: 'user-2', email: 'jane@example.com' }
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser)

      await expect(
        invitationService.inviteParticipants({
          havrutaId: 'havruta-1',
          emails: ['test@example.com'],
          inviterUserId: 'user-2'
        })
      ).rejects.toThrow('Only participants can invite others')
    })

    it('should handle existing users by adding them directly', async () => {
      const existingUser = {
        id: 'user-2',
        email: 'existing@example.com'
      }

      vi.mocked(prisma.user.findUnique).mockResolvedValue(existingUser)
      vi.mocked(prisma.invitation.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.havrutaParticipant.findUnique).mockResolvedValue(null)
      vi.mocked(prisma.invitation.create).mockResolvedValue({
        id: 'invitation-1',
        invitationToken: 'token123'
      } as any)
      vi.mocked(prisma.havrutaParticipant.create).mockResolvedValue({} as any)
      vi.mocked(prisma.invitation.update).mockResolvedValue({} as any)

      const result = await invitationService.inviteParticipants({
        havrutaId: 'havruta-1',
        emails: ['existing@example.com'],
        inviterUserId: 'user-1'
      })

      expect(result.existingUsers).toContain('existing@example.com')
      expect(result.successful).toContain('existing@example.com')
      expect(result.newUsers).toHaveLength(0)
      expect(prisma.havrutaParticipant.create).toHaveBeenCalled()
    })

    it('should send invitation emails for new users', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null) // New user
      vi.mocked(prisma.invitation.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.invitation.create).mockResolvedValue({
        id: 'invitation-1',
        invitationToken: 'token123'
      } as any)
      vi.mocked(emailService.sendHavrutaInvitation).mockResolvedValue()

      const result = await invitationService.inviteParticipants({
        havrutaId: 'havruta-1',
        emails: ['newuser@example.com'],
        inviterUserId: 'user-1'
      })

      expect(result.newUsers).toContain('newuser@example.com')
      expect(result.successful).toContain('newuser@example.com')
      expect(result.existingUsers).toHaveLength(0)
      expect(emailService.sendHavrutaInvitation).toHaveBeenCalledWith(
        'newuser@example.com',
        expect.objectContaining({
          havrutaId: 'havruta-1',
          havrutaName: 'Test Havruta',
          bookTitle: 'Genesis',
          inviterName: 'John Doe'
        }),
        true
      )
    })

    it('should handle email sending failures', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
      vi.mocked(prisma.invitation.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.invitation.create).mockResolvedValue({
        id: 'invitation-1',
        invitationToken: 'token123'
      } as any)
      vi.mocked(emailService.sendHavrutaInvitation).mockRejectedValue(
        new Error('Email service unavailable')
      )
      vi.mocked(prisma.invitation.delete).mockResolvedValue({} as any)

      const result = await invitationService.inviteParticipants({
        havrutaId: 'havruta-1',
        emails: ['newuser@example.com'],
        inviterUserId: 'user-1'
      })

      expect(result.failed).toHaveLength(1)
      expect(result.failed[0]).toEqual({
        email: 'newuser@example.com',
        reason: 'Failed to send invitation email'
      })
      expect(prisma.invitation.delete).toHaveBeenCalled()
    })

    it('should skip duplicate invitations', async () => {
      const existingInvitation = {
        id: 'invitation-1',
        status: 'pending',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // Future date
      }

      vi.mocked(prisma.invitation.findFirst).mockResolvedValue(existingInvitation as any)

      const result = await invitationService.inviteParticipants({
        havrutaId: 'havruta-1',
        emails: ['duplicate@example.com'],
        inviterUserId: 'user-1'
      })

      expect(result.failed).toHaveLength(1)
      expect(result.failed[0]).toEqual({
        email: 'duplicate@example.com',
        reason: 'Invitation already sent and pending'
      })
    })

    it('should filter out current participants', async () => {
      const havrutaWithParticipants = {
        ...mockHavruta,
        participants: [{
          user: { email: 'participant@example.com' }
        }]
      }

      vi.mocked(prisma.havruta.findUnique).mockResolvedValue(havrutaWithParticipants as any)

      const result = await invitationService.inviteParticipants({
        havrutaId: 'havruta-1',
        emails: ['john@example.com', 'participant@example.com'], // Creator and existing participant
        inviterUserId: 'user-1'
      })

      expect(result.successful).toHaveLength(0)
      expect(result.failed).toHaveLength(0)
      expect(result.existingUsers).toHaveLength(0)
      expect(result.newUsers).toHaveLength(0)
    })
  })

  describe('acceptInvitation', () => {
    const mockInvitation = {
      id: 'invitation-1',
      inviteeEmail: 'test@example.com',
      status: 'pending',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Future date
      havrutaId: 'havruta-1',
      havruta: { id: 'havruta-1' },
      inviterUser: { id: 'user-1' }
    }

    const mockUser = {
      id: 'user-2',
      email: 'test@example.com'
    }

    beforeEach(() => {
      vi.mocked(prisma.invitation.findUnique).mockResolvedValue(mockInvitation as any)
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)
      vi.mocked(prisma.havrutaParticipant.findUnique).mockResolvedValue(null)
    })

    it('should validate input data', async () => {
      await expect(
        invitationService.acceptInvitation({
          token: '',
          userId: 'user-2'
        })
      ).rejects.toThrow('Validation error')

      await expect(
        invitationService.acceptInvitation({
          token: 'token123',
          userId: ''
        })
      ).rejects.toThrow('Validation error')
    })

    it('should throw error if invitation not found', async () => {
      vi.mocked(prisma.invitation.findUnique).mockResolvedValue(null)

      await expect(
        invitationService.acceptInvitation({
          token: 'nonexistent',
          userId: 'user-2'
        })
      ).rejects.toThrow('Invitation not found')
    })

    it('should throw error if invitation is not pending', async () => {
      const acceptedInvitation = { ...mockInvitation, status: 'accepted' }
      vi.mocked(prisma.invitation.findUnique).mockResolvedValue(acceptedInvitation as any)

      await expect(
        invitationService.acceptInvitation({
          token: 'token123',
          userId: 'user-2'
        })
      ).rejects.toThrow('Invitation is no longer valid')
    })

    it('should throw error if invitation is expired', async () => {
      const expiredInvitation = {
        ...mockInvitation,
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000) // Past date
      }
      vi.mocked(prisma.invitation.findUnique).mockResolvedValue(expiredInvitation as any)
      vi.mocked(prisma.invitation.update).mockResolvedValue({} as any)

      await expect(
        invitationService.acceptInvitation({
          token: 'token123',
          userId: 'user-2'
        })
      ).rejects.toThrow('Invitation has expired')

      expect(prisma.invitation.update).toHaveBeenCalledWith({
        where: { id: 'invitation-1' },
        data: { status: 'expired' }
      })
    })

    it('should throw error if user not found', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

      await expect(
        invitationService.acceptInvitation({
          token: 'token123',
          userId: 'nonexistent'
        })
      ).rejects.toThrow('User not found')
    })

    it('should throw error if email does not match', async () => {
      const differentUser = { ...mockUser, email: 'different@example.com' }
      vi.mocked(prisma.user.findUnique).mockResolvedValue(differentUser as any)

      await expect(
        invitationService.acceptInvitation({
          token: 'token123',
          userId: 'user-2'
        })
      ).rejects.toThrow('Invitation email does not match user email')
    })

    it('should successfully accept invitation and add user to havruta', async () => {
      const mockTransaction = vi.fn().mockImplementation(async (callback) => {
        return await callback({
          havrutaParticipant: {
            create: vi.fn().mockResolvedValue({})
          },
          invitation: {
            update: vi.fn().mockResolvedValue({})
          }
        })
      })
      vi.mocked(prisma.$transaction).mockImplementation(mockTransaction)

      await invitationService.acceptInvitation({
        token: 'token123',
        userId: 'user-2'
      })

      expect(mockTransaction).toHaveBeenCalled()
    })

    it('should handle case where user is already a participant', async () => {
      const existingParticipant = { userId: 'user-2', havrutaId: 'havruta-1' }
      vi.mocked(prisma.havrutaParticipant.findUnique).mockResolvedValue(existingParticipant as any)
      vi.mocked(prisma.invitation.update).mockResolvedValue({} as any)

      await invitationService.acceptInvitation({
        token: 'token123',
        userId: 'user-2'
      })

      expect(prisma.invitation.update).toHaveBeenCalledWith({
        where: { id: 'invitation-1' },
        data: {
          status: 'accepted',
          acceptedAt: expect.any(Date)
        }
      })
    })
  })

  describe('declineInvitation', () => {
    it('should successfully decline a pending invitation', async () => {
      const mockInvitation = {
        id: 'invitation-1',
        status: 'pending'
      }

      vi.mocked(prisma.invitation.findUnique).mockResolvedValue(mockInvitation as any)
      vi.mocked(prisma.invitation.update).mockResolvedValue({} as any)

      await invitationService.declineInvitation('token123')

      expect(prisma.invitation.update).toHaveBeenCalledWith({
        where: { id: 'invitation-1' },
        data: { status: 'declined' }
      })
    })

    it('should throw error if invitation not found', async () => {
      vi.mocked(prisma.invitation.findUnique).mockResolvedValue(null)

      await expect(
        invitationService.declineInvitation('nonexistent')
      ).rejects.toThrow('Invitation not found')
    })

    it('should throw error if invitation is not pending', async () => {
      const acceptedInvitation = { id: 'invitation-1', status: 'accepted' }
      vi.mocked(prisma.invitation.findUnique).mockResolvedValue(acceptedInvitation as any)

      await expect(
        invitationService.declineInvitation('token123')
      ).rejects.toThrow('Invitation is no longer valid')
    })
  })

  describe('getInvitationByToken', () => {
    it('should return invitation with relations', async () => {
      const mockInvitation = {
        id: 'invitation-1',
        inviteeEmail: 'test@example.com',
        status: 'pending',
        inviterUser: {
          id: 'user-1',
          name: 'John Doe',
          email: 'john@example.com',
          profilePicture: null
        },
        havruta: {
          id: 'havruta-1',
          name: 'Test Havruta',
          bookTitle: 'Genesis',
          creatorId: 'user-1'
        }
      }

      vi.mocked(prisma.invitation.findUnique).mockResolvedValue(mockInvitation as any)

      const result = await invitationService.getInvitationByToken('token123')

      expect(result).toEqual(mockInvitation)
      expect(prisma.invitation.findUnique).toHaveBeenCalledWith({
        where: { invitationToken: 'token123' },
        include: {
          inviterUser: {
            select: {
              id: true,
              name: true,
              email: true,
              profilePicture: true
            }
          },
          havruta: {
            select: {
              id: true,
              name: true,
              bookTitle: true,
              creatorId: true
            }
          }
        }
      })
    })

    it('should return null if invitation not found', async () => {
      vi.mocked(prisma.invitation.findUnique).mockResolvedValue(null)

      const result = await invitationService.getInvitationByToken('nonexistent')

      expect(result).toBeNull()
    })
  })

  describe('cleanupExpiredInvitations', () => {
    it('should mark expired invitations as expired', async () => {
      vi.mocked(prisma.invitation.updateMany).mockResolvedValue({ count: 5 })

      const result = await invitationService.cleanupExpiredInvitations()

      expect(result).toBe(5)
      expect(prisma.invitation.updateMany).toHaveBeenCalledWith({
        where: {
          status: 'pending',
          expiresAt: { lt: expect.any(Date) }
        },
        data: { status: 'expired' }
      })
    })
  })
})