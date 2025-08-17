export interface Invitation {
  id: string
  inviteeEmail: string
  status: 'pending' | 'accepted' | 'declined' | 'expired'
  invitationToken: string
  createdAt: Date
  expiresAt: Date
  acceptedAt?: Date
  inviterUserId: string
  havrutaId: string
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

export interface CreateInvitationData {
  inviteeEmail: string
  inviterUserId: string
  havrutaId: string
  expiresAt?: Date
}

export interface InvitationResult {
  successful: string[]
  failed: { email: string; reason: string }[]
  existingUsers: string[]
  newUsers: string[]
}