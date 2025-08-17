import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Chip,
  Alert,
  CircularProgress,
  IconButton,
  InputAdornment,
} from '@mui/material'
import { Add, Delete, Email } from '@mui/icons-material'

interface ParticipantInvitationDialogProps {
  open: boolean
  onClose: () => void
  havrutaName: string
  havrutaId: string
  onInvite: (havrutaId: string, emails: string[]) => Promise<{
    successful: string[]
    failed: { email: string; reason: string }[]
    existingUsers: string[]
    newUsers: string[]
  }>
}

export const ParticipantInvitationDialog: React.FC<ParticipantInvitationDialogProps> = ({
  open,
  onClose,
  havrutaName,
  havrutaId,
  onInvite,
}) => {
  const [emails, setEmails] = useState<string[]>([''])
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<{
    successful: string[]
    failed: { email: string; reason: string }[]
    existingUsers: string[]
    newUsers: string[]
  } | null>(null)
  const [errors, setErrors] = useState<{ [index: number]: string }>({})

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email.trim())
  }

  const handleEmailChange = (index: number, value: string) => {
    const newEmails = [...emails]
    newEmails[index] = value
    setEmails(newEmails)

    // Clear error for this field
    if (errors[index]) {
      const newErrors = { ...errors }
      delete newErrors[index]
      setErrors(newErrors)
    }

    // Clear result when user starts typing
    if (result) {
      setResult(null)
    }
  }

  const addEmailField = () => {
    setEmails([...emails, ''])
  }

  const removeEmailField = (index: number) => {
    if (emails.length > 1) {
      const newEmails = emails.filter((_, i) => i !== index)
      setEmails(newEmails)
      
      // Remove error for this field
      const newErrors = { ...errors }
      delete newErrors[index]
      // Adjust error indices
      Object.keys(newErrors).forEach(key => {
        const keyNum = parseInt(key)
        if (keyNum > index) {
          newErrors[keyNum - 1] = newErrors[keyNum]
          delete newErrors[keyNum]
        }
      })
      setErrors(newErrors)
    }
  }

  const validateAllEmails = (): boolean => {
    const newErrors: { [index: number]: string } = {}
    let hasErrors = false

    emails.forEach((email, index) => {
      const trimmedEmail = email.trim()
      if (!trimmedEmail) {
        newErrors[index] = 'Email is required'
        hasErrors = true
      } else if (!validateEmail(trimmedEmail)) {
        newErrors[index] = 'Please enter a valid email address'
        hasErrors = true
      }
    })

    // Check for duplicates
    const emailSet = new Set<string>()
    emails.forEach((email, index) => {
      const trimmedEmail = email.trim().toLowerCase()
      if (trimmedEmail && emailSet.has(trimmedEmail)) {
        newErrors[index] = 'Duplicate email address'
        hasErrors = true
      } else if (trimmedEmail) {
        emailSet.add(trimmedEmail)
      }
    })

    setErrors(newErrors)
    return !hasErrors
  }

  const handleInvite = async () => {
    if (!validateAllEmails()) {
      return
    }

    setIsLoading(true)
    try {
      const validEmails = emails
        .map(email => email.trim())
        .filter(email => email && validateEmail(email))

      const invitationResult = await onInvite(havrutaId, validEmails)
      setResult(invitationResult)
    } catch (error) {
      console.error('Error sending invitations:', error)
      setResult({
        successful: [],
        failed: emails.map(email => ({
          email: email.trim(),
          reason: 'Failed to send invitation'
        })),
        existingUsers: [],
        newUsers: []
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    setEmails([''])
    setErrors({})
    setResult(null)
    onClose()
  }

  const handleSendMore = () => {
    setEmails([''])
    setErrors({})
    setResult(null)
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Email color="primary" />
          Invite Participants to "{havrutaName}"
        </Box>
      </DialogTitle>
      
      <DialogContent>
        {!result ? (
          <Box sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Enter email addresses to invite new participants to this Havruta. 
              They will receive an email with instructions to join your study group.
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {emails.map((email, index) => (
                <Box key={index} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                  <TextField
                    fullWidth
                    label={`Email ${index + 1}`}
                    value={email}
                    onChange={(e) => handleEmailChange(index, e.target.value)}
                    error={!!errors[index]}
                    helperText={errors[index]}
                    placeholder="participant@example.com"
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Email fontSize="small" />
                        </InputAdornment>
                      ),
                    }}
                  />
                  {emails.length > 1 && (
                    <IconButton
                      onClick={() => removeEmailField(index)}
                      color="error"
                      sx={{ mt: 1 }}
                    >
                      <Delete />
                    </IconButton>
                  )}
                </Box>
              ))}
            </Box>

            <Button
              startIcon={<Add />}
              onClick={addEmailField}
              sx={{ mt: 2 }}
              variant="outlined"
              size="small"
            >
              Add Another Email
            </Button>
          </Box>
        ) : (
          <Box sx={{ mt: 1 }}>
            {result.successful.length > 0 && (
              <Alert severity="success" sx={{ mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Successfully sent {result.successful.length} invitation(s)
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
                  {result.successful.map((email) => (
                    <Chip key={email} label={email} size="small" color="success" />
                  ))}
                </Box>
              </Alert>
            )}

            {result.existingUsers.length > 0 && (
              <Alert severity="info" sx={{ mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Added {result.existingUsers.length} existing user(s) to Havruta
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
                  {result.existingUsers.map((email) => (
                    <Chip key={email} label={email} size="small" color="info" />
                  ))}
                </Box>
              </Alert>
            )}

            {result.newUsers.length > 0 && (
              <Alert severity="info" sx={{ mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Sent invitations to {result.newUsers.length} new user(s)
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  They will receive an email with registration instructions.
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
                  {result.newUsers.map((email) => (
                    <Chip key={email} label={email} size="small" />
                  ))}
                </Box>
              </Alert>
            )}

            {result.failed.length > 0 && (
              <Alert severity="error" sx={{ mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Failed to send {result.failed.length} invitation(s)
                </Typography>
                <Box sx={{ mt: 1 }}>
                  {result.failed.map((failure) => (
                    <Box key={failure.email} sx={{ mb: 1 }}>
                      <Chip 
                        label={failure.email} 
                        size="small" 
                        color="error" 
                        sx={{ mr: 1 }} 
                      />
                      <Typography variant="caption" color="error">
                        {failure.reason}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Alert>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        {!result ? (
          <>
            <Button onClick={handleClose}>Cancel</Button>
            <Button
              onClick={handleInvite}
              variant="contained"
              disabled={isLoading || emails.every(email => !email.trim())}
              startIcon={isLoading ? <CircularProgress size={16} /> : <Email />}
            >
              {isLoading ? 'Sending...' : 'Send Invitations'}
            </Button>
          </>
        ) : (
          <>
            <Button onClick={handleSendMore} variant="outlined">
              Invite More
            </Button>
            <Button onClick={handleClose} variant="contained">
              Done
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  )
}