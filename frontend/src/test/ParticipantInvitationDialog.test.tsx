import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { ParticipantInvitationDialog } from '../components/ParticipantInvitationDialog'

describe('ParticipantInvitationDialog', () => {
  const mockOnClose = vi.fn()
  const mockOnInvite = vi.fn()

  const defaultProps = {
    open: true,
    onClose: mockOnClose,
    havrutaName: 'Test Havruta',
    havrutaId: 'havruta-1',
    onInvite: mockOnInvite,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders dialog with correct title', () => {
    render(<ParticipantInvitationDialog {...defaultProps} />)
    
    expect(screen.getByText('Invite Participants to "Test Havruta"')).toBeInTheDocument()
  })

  it('renders initial email input field', () => {
    render(<ParticipantInvitationDialog {...defaultProps} />)
    
    expect(screen.getByLabelText('Email 1')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('participant@example.com')).toBeInTheDocument()
  })

  it('adds additional email fields when Add Another Email is clicked', () => {
    render(<ParticipantInvitationDialog {...defaultProps} />)
    
    // Initially should have one email field
    expect(screen.getByLabelText('Email 1')).toBeInTheDocument()
    expect(screen.queryByLabelText('Email 2')).not.toBeInTheDocument()
    
    // Click add another email
    fireEvent.click(screen.getByRole('button', { name: /add another email/i }))
    
    // Should now have two email fields
    expect(screen.getByLabelText('Email 1')).toBeInTheDocument()
    expect(screen.getByLabelText('Email 2')).toBeInTheDocument()
  })

  it('removes email fields when delete button is clicked', () => {
    render(<ParticipantInvitationDialog {...defaultProps} />)
    
    // Add a second email field
    fireEvent.click(screen.getByRole('button', { name: /add another email/i }))
    
    expect(screen.getByLabelText('Email 1')).toBeInTheDocument()
    expect(screen.getByLabelText('Email 2')).toBeInTheDocument()
    
    // Delete the second field
    const deleteButtons = screen.getAllByRole('button')
    const deleteButton = deleteButtons.find(button => 
      button.querySelector('[data-testid="DeleteIcon"]')
    )
    if (deleteButton) {
      fireEvent.click(deleteButton)
    }
    
    // Should only have one email field left
    expect(screen.getByLabelText('Email 1')).toBeInTheDocument()
    expect(screen.queryByLabelText('Email 2')).not.toBeInTheDocument()
  })

  it('validates email format', async () => {
    render(<ParticipantInvitationDialog {...defaultProps} />)
    
    const emailInput = screen.getByLabelText('Email 1')
    
    // Enter invalid email
    fireEvent.change(emailInput, { target: { value: 'invalid-email' } })
    
    // Try to send invitations
    fireEvent.click(screen.getByRole('button', { name: /send invitations/i }))
    
    // Should show validation error
    await waitFor(() => {
      expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument()
    })
    
    // Should not call onInvite
    expect(mockOnInvite).not.toHaveBeenCalled()
  })

  it('validates required email fields', async () => {
    render(<ParticipantInvitationDialog {...defaultProps} />)
    
    const emailInput = screen.getByLabelText('Email 1')
    
    // Enter some text to enable the button, then clear it
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.change(emailInput, { target: { value: '' } })
    
    // The send button should be disabled when no email is entered
    const sendButton = screen.getByRole('button', { name: /send invitations/i })
    expect(sendButton).toBeDisabled()
    
    // Should not call onInvite when button is disabled
    expect(mockOnInvite).not.toHaveBeenCalled()
  })

  it('detects duplicate email addresses', async () => {
    render(<ParticipantInvitationDialog {...defaultProps} />)
    
    // Add a second email field
    fireEvent.click(screen.getByRole('button', { name: /add another email/i }))
    
    const email1Input = screen.getByLabelText('Email 1')
    const email2Input = screen.getByLabelText('Email 2')
    
    // Enter the same email in both fields
    fireEvent.change(email1Input, { target: { value: 'test@example.com' } })
    fireEvent.change(email2Input, { target: { value: 'test@example.com' } })
    
    // Try to send invitations
    fireEvent.click(screen.getByRole('button', { name: /send invitations/i }))
    
    // Should show duplicate error
    await waitFor(() => {
      expect(screen.getByText('Duplicate email address')).toBeInTheDocument()
    })
    
    // Should not call onInvite
    expect(mockOnInvite).not.toHaveBeenCalled()
  })

  it('sends invitations with valid emails', async () => {
    const mockResult = {
      successful: ['test1@example.com'],
      failed: [],
      existingUsers: ['test2@example.com'],
      newUsers: ['test1@example.com']
    }
    
    mockOnInvite.mockResolvedValue(mockResult)
    
    render(<ParticipantInvitationDialog {...defaultProps} />)
    
    // Add a second email field
    fireEvent.click(screen.getByRole('button', { name: /add another email/i }))
    
    const email1Input = screen.getByLabelText('Email 1')
    const email2Input = screen.getByLabelText('Email 2')
    
    // Enter valid emails
    fireEvent.change(email1Input, { target: { value: 'test1@example.com' } })
    fireEvent.change(email2Input, { target: { value: 'test2@example.com' } })
    
    // Send invitations
    fireEvent.click(screen.getByRole('button', { name: /send invitations/i }))
    
    // Should call onInvite with correct parameters
    await waitFor(() => {
      expect(mockOnInvite).toHaveBeenCalledWith('havruta-1', ['test1@example.com', 'test2@example.com'])
    })
  })

  it('displays success results', async () => {
    const mockResult = {
      successful: ['test1@example.com'],
      failed: [],
      existingUsers: ['test2@example.com'],
      newUsers: ['test1@example.com']
    }
    
    mockOnInvite.mockResolvedValue(mockResult)
    
    render(<ParticipantInvitationDialog {...defaultProps} />)
    
    const emailInput = screen.getByLabelText('Email 1')
    fireEvent.change(emailInput, { target: { value: 'test1@example.com' } })
    
    // Send invitations
    fireEvent.click(screen.getByRole('button', { name: /send invitations/i }))
    
    // Should show success message
    await waitFor(() => {
      expect(screen.getByText(/successfully sent 1 invitation/i)).toBeInTheDocument()
      expect(screen.getByText(/added 1 existing user/i)).toBeInTheDocument()
      expect(screen.getByText(/sent invitations to 1 new user/i)).toBeInTheDocument()
    })
  })

  it('displays failure results', async () => {
    const mockResult = {
      successful: [],
      failed: [{ email: 'test@example.com', reason: 'Email service unavailable' }],
      existingUsers: [],
      newUsers: []
    }
    
    mockOnInvite.mockResolvedValue(mockResult)
    
    render(<ParticipantInvitationDialog {...defaultProps} />)
    
    const emailInput = screen.getByLabelText('Email 1')
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    
    // Send invitations
    fireEvent.click(screen.getByRole('button', { name: /send invitations/i }))
    
    // Should show failure message
    await waitFor(() => {
      expect(screen.getByText(/failed to send 1 invitation/i)).toBeInTheDocument()
      expect(screen.getByText('Email service unavailable')).toBeInTheDocument()
    })
  })

  it('allows sending more invitations after completion', async () => {
    const mockResult = {
      successful: ['test@example.com'],
      failed: [],
      existingUsers: [],
      newUsers: ['test@example.com']
    }
    
    mockOnInvite.mockResolvedValue(mockResult)
    
    render(<ParticipantInvitationDialog {...defaultProps} />)
    
    const emailInput = screen.getByLabelText('Email 1')
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    
    // Send invitations
    fireEvent.click(screen.getByRole('button', { name: /send invitations/i }))
    
    // Wait for results to show
    await waitFor(() => {
      expect(screen.getByText(/successfully sent 1 invitation/i)).toBeInTheDocument()
    })
    
    // Should show "Invite More" button
    expect(screen.getByRole('button', { name: /invite more/i })).toBeInTheDocument()
    
    // Click "Invite More"
    fireEvent.click(screen.getByRole('button', { name: /invite more/i }))
    
    // Should return to invitation form
    expect(screen.getByLabelText('Email 1')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /send invitations/i })).toBeInTheDocument()
  })

  it('closes dialog when cancel is clicked', () => {
    render(<ParticipantInvitationDialog {...defaultProps} />)
    
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    
    expect(mockOnClose).toHaveBeenCalled()
  })

  it('closes dialog when done is clicked after sending invitations', async () => {
    const mockResult = {
      successful: ['test@example.com'],
      failed: [],
      existingUsers: [],
      newUsers: ['test@example.com']
    }
    
    mockOnInvite.mockResolvedValue(mockResult)
    
    render(<ParticipantInvitationDialog {...defaultProps} />)
    
    const emailInput = screen.getByLabelText('Email 1')
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    
    // Send invitations
    fireEvent.click(screen.getByRole('button', { name: /send invitations/i }))
    
    // Wait for results to show
    await waitFor(() => {
      expect(screen.getByText(/successfully sent 1 invitation/i)).toBeInTheDocument()
    })
    
    // Click "Done"
    fireEvent.click(screen.getByRole('button', { name: /done/i }))
    
    expect(mockOnClose).toHaveBeenCalled()
  })

  it('disables send button when no emails are entered', () => {
    render(<ParticipantInvitationDialog {...defaultProps} />)
    
    const sendButton = screen.getByRole('button', { name: /send invitations/i })
    expect(sendButton).toBeDisabled()
  })

  it('enables send button when valid email is entered', () => {
    render(<ParticipantInvitationDialog {...defaultProps} />)
    
    const emailInput = screen.getByLabelText('Email 1')
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    
    const sendButton = screen.getByRole('button', { name: /send invitations/i })
    expect(sendButton).not.toBeDisabled()
  })
})