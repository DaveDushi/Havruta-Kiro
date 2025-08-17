import { Invitation } from '@prisma/client'
import { prisma } from '../utils/database'
import { emailService } from './emailService'
import { userService } from './userService'
import { z } from 'zod'
import crypto from 'crypto'

export interface InvitationResult {
  successful: string[]
  failed: { email: string; reason: string }[]
  existingUsers: string[]
  newUsers: string[]
}

export interface InvitationWithRelations extends Invitation {
  inviterUser: {
    id: string
    name: string
    email: string
    profilePicture?: string
  }
  havruta: {
    id: string
    name: string
    bookTitle: string
    creatorId: string
  }
}

const inviteParticipantsSchema = z.object({
  havrutaId: z.string().min(1, 'Havruta ID is required'),
  emails: z.array(z.string().email('Invalid email format')).min(1, 'At least one email is required'),
  inviterUserId: z.string().min(1, 'Inviter user ID is required')
})

const acceptInvitationSchema = z.object({
  token: z.string().min(1, 'Invitation token is required'),
  userId: z.string().min(1, 'User ID is required')
})

export type InviteParticipantsData = z.infer<typeof inviteParticipantsSchema>
export type AcceptInvitationData = z.infer<typeof acceptInvitationSchema>

export class InvitationService {
  /**
   * Generate a unique invitation token
   */
  private generateInvitationToken(): string {
    return crypto.randomBytes(32).toString('hex')
  }

  /**
   * Calculate invitation expiration date (7 days from now)
   */
  private getExpirationDate(): Date {
    const expirationDate = new Date()
    expirationDate.setDate(expirationDate.getDate() + 7)
    return expirationDate
  }

  /**
   * Invite participants to a Havruta by email
   */
  async inviteParticipants(data: InviteParticipantsData): Promise<InvitationResult> {
    try {
      // Validate input data
      const validatedData = inviteParticipantsSchema.parse(data)
      const { havrutaId, emails, inviterUserId } = validatedData

      // Verify havruta exists and inviter has permission
      const havruta = await prisma.havruta.findUnique({
        where: { id: havrutaId },
        include: {
          creator: {
            select: {
              id: true,
              name: true,
              email: true,
              profilePicture: true
            }
          },
          participants: {
            include: {
              user: {
                select: { email: true }
              }
            }
          }
        }
      })

      if (!havruta) {
        throw new Error('Havruta not found')
      }

      // Check if inviter is a participant (creator or member)
      const isParticipant = havruta.creatorId === inviterUserId || 
        havruta.participants.some(p => p.user.email === inviterUserId)
      
      if (!isParticipant) {
        // Get inviter user to check by user ID
        const inviterUser = await prisma.user.findUnique({
          where: { id: inviterUserId }
        })
        
        if (!inviterUser) {
          throw new Error('Inviter not found')
        }

        const isParticipantByUserId = havruta.creatorId === inviterUserId || 
          havruta.participants.some(p => p.userId === inviterUserId)

        if (!isParticipantByUserId) {
          throw new Error('Only participants can invite others to this Havruta')
        }
      }

      // Get current participant emails to avoid duplicate invitations
      const currentParticipantEmails = new Set([
        havruta.creator.email,
        ...havruta.participants.map(p => p.user.email)
      ])

      // Remove duplicates and current participants from email list
      const uniqueEmails = [...new Set(emails.map(email => email.trim().toLowerCase()))]
        .filter(email => !currentParticipantEmails.has(email))

      if (uniqueEmails.length === 0) {
        return {
          successful: [],
          failed: [],
          existingUsers: [],
          newUsers: []
        }
      }

      const result: InvitationResult = {
        successful: [],
        failed: [],
        existingUsers: [],
        newUsers: []
      }

      // Process each email
      for (const email of uniqueEmails) {
        try {
          // Check if user already exists
          const existingUser = await prisma.user.findUnique({
            where: { email }
          })

          // Check for existing pending invitation
          const existingInvitation = await prisma.invitation.findFirst({
            where: {
              inviteeEmail: email,
              havrutaId,
              status: 'pending',
              expiresAt: { gt: new Date() }
            }
          })

          if (existingInvitation) {
            result.failed.push({
              email,
              reason: 'Invitation already sent and pending'
            })
            continue
          }

          // Generate invitation token and expiration
          const invitationToken = this.generateInvitationToken()
          const expiresAt = this.getExpirationDate()

          // Create invitation record
          const invitation = await prisma.invitation.create({
            data: {
              inviteeEmail: email,
              inviterUserId,
              havrutaId,
              invitationToken,
              expiresAt,
              status: 'pending'
            }
          })

          // If user exists, add them directly to the Havruta
          if (existingUser) {
            try {
              // Check if user is already a participant
              const isAlreadyParticipant = await prisma.havrutaParticipant.findUnique({
                where: {
                  userId_havrutaId: {
                    userId: existingUser.id,
                    havrutaId
                  }
                }
              })

              if (!isAlreadyParticipant) {
                await prisma.havrutaParticipant.create({
                  data: {
                    userId: existingUser.id,
                    havrutaId
                  }
                })

                // Mark invitation as accepted
                await prisma.invitation.update({
                  where: { id: invitation.id },
                  data: {
                    status: 'accepted',
                    acceptedAt: new Date()
                  }
                })

                result.existingUsers.push(email)
                result.successful.push(email)
              } else {
                result.failed.push({
                  email,
                  reason: 'User is already a participant'
                })
              }
            } catch (error) {
              console.error(`Error adding existing user ${email} to Havruta:`, error)
              result.failed.push({
                email,
                reason: 'Failed to add user to Havruta'
              })
            }
          } else {
            // Send invitation email for new users
            try {
              const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000'
              const joinLink = `${frontendUrl}/invite/${invitationToken}`

              await emailService.sendHavrutaInvitation(email, {
                havrutaId,
                havrutaName: havruta.name,
                bookTitle: havruta.bookTitle,
                inviterName: havruta.creator.name,
                joinLink,
                invitationToken
              }, true) // isNewUser = true

              result.newUsers.push(email)
              result.successful.push(email)
            } catch (emailError) {
              console.error(`Error sending invitation email to ${email}:`, emailError)
              
              // Delete the invitation record if email failed
              await prisma.invitation.delete({
                where: { id: invitation.id }
              }).catch(console.error)

              result.failed.push({
                email,
                reason: 'Failed to send invitation email'
              })
            }
          }
        } catch (error) {
          console.error(`Error processing invitation for ${email}:`, error)
          result.failed.push({
            email,
            reason: 'Failed to process invitation'
          })
        }
      }

      return result
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Validation error: ${error.errors.map(e => e.message).join(', ')}`)
      }
      console.error('Error inviting participants:', error)
      throw error instanceof Error ? error : new Error('Failed to invite participants')
    }
  }

  /**
   * Accept an invitation using the invitation token
   */
  async acceptInvitation(data: AcceptInvitationData): Promise<void> {
    try {
      // Validate input data
      const validatedData = acceptInvitationSchema.parse(data)
      const { token, userId } = validatedData

      // Find the invitation
      const invitation = await prisma.invitation.findUnique({
        where: { invitationToken: token },
        include: {
          havruta: true,
          inviterUser: true
        }
      })

      if (!invitation) {
        throw new Error('Invitation not found')
      }

      if (invitation.status !== 'pending') {
        throw new Error('Invitation is no longer valid')
      }

      if (invitation.expiresAt < new Date()) {
        // Mark as expired
        await prisma.invitation.update({
          where: { id: invitation.id },
          data: { status: 'expired' }
        })
        throw new Error('Invitation has expired')
      }

      // Verify user exists
      const user = await prisma.user.findUnique({
        where: { id: userId }
      })

      if (!user) {
        throw new Error('User not found')
      }

      // Verify the invitation email matches the user's email
      if (user.email.toLowerCase() !== invitation.inviteeEmail.toLowerCase()) {
        throw new Error('Invitation email does not match user email')
      }

      // Check if user is already a participant
      const existingParticipant = await prisma.havrutaParticipant.findUnique({
        where: {
          userId_havrutaId: {
            userId,
            havrutaId: invitation.havrutaId
          }
        }
      })

      if (existingParticipant) {
        // Mark invitation as accepted even if already a participant
        await prisma.invitation.update({
          where: { id: invitation.id },
          data: {
            status: 'accepted',
            acceptedAt: new Date()
          }
        })
        return
      }

      // Add user to Havruta and mark invitation as accepted
      await prisma.$transaction(async (tx) => {
        // Add user as participant
        await tx.havrutaParticipant.create({
          data: {
            userId,
            havrutaId: invitation.havrutaId
          }
        })

        // Mark invitation as accepted
        await tx.invitation.update({
          where: { id: invitation.id },
          data: {
            status: 'accepted',
            acceptedAt: new Date()
          }
        })
      })
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Validation error: ${error.errors.map(e => e.message).join(', ')}`)
      }
      console.error('Error accepting invitation:', error)
      throw error instanceof Error ? error : new Error('Failed to accept invitation')
    }
  }

  /**
   * Decline an invitation
   */
  async declineInvitation(token: string): Promise<void> {
    try {
      const invitation = await prisma.invitation.findUnique({
        where: { invitationToken: token }
      })

      if (!invitation) {
        throw new Error('Invitation not found')
      }

      if (invitation.status !== 'pending') {
        throw new Error('Invitation is no longer valid')
      }

      await prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: 'declined' }
      })
    } catch (error) {
      console.error('Error declining invitation:', error)
      throw error instanceof Error ? error : new Error('Failed to decline invitation')
    }
  }

  /**
   * Get invitation by token
   */
  async getInvitationByToken(token: string): Promise<InvitationWithRelations | null> {
    try {
      const invitation = await prisma.invitation.findUnique({
        where: { invitationToken: token },
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

      return invitation
    } catch (error) {
      console.error('Error fetching invitation by token:', error)
      throw new Error('Failed to fetch invitation')
    }
  }

  /**
   * Get invitations for a Havruta
   */
  async getHavrutaInvitations(havrutaId: string): Promise<InvitationWithRelations[]> {
    try {
      const invitations = await prisma.invitation.findMany({
        where: { havrutaId },
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
        },
        orderBy: { createdAt: 'desc' }
      })

      return invitations
    } catch (error) {
      console.error('Error fetching Havruta invitations:', error)
      throw new Error('Failed to fetch invitations')
    }
  }

  /**
   * Clean up expired invitations (call this periodically)
   */
  async cleanupExpiredInvitations(): Promise<number> {
    try {
      const result = await prisma.invitation.updateMany({
        where: {
          status: 'pending',
          expiresAt: { lt: new Date() }
        },
        data: { status: 'expired' }
      })

      console.log(`Marked ${result.count} invitations as expired`)
      return result.count
    } catch (error) {
      console.error('Error cleaning up expired invitations:', error)
      throw new Error('Failed to cleanup expired invitations')
    }
  }

  /**
   * Cancel pending invitations for a Havruta
   */
  async cancelHavrutaInvitations(havrutaId: string): Promise<void> {
    try {
      await prisma.invitation.updateMany({
        where: {
          havrutaId,
          status: 'pending'
        },
        data: { status: 'expired' }
      })
    } catch (error) {
      console.error('Error canceling Havruta invitations:', error)
      throw new Error('Failed to cancel invitations')
    }
  }
}

export const invitationService = new InvitationService()
export default invitationService