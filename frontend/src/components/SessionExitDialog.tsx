import React from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Alert,
  CircularProgress,
} from '@mui/material'
import { ExitToApp, Stop } from '@mui/icons-material'

interface SessionExitDialogProps {
  open: boolean
  onClose: () => void
  onLeaveSession: () => Promise<void>
  onEndSession: () => Promise<void>
  isOwner: boolean
  sessionId: string
  havrutaName?: string
  sessionType?: string
}

const SessionExitDialog: React.FC<SessionExitDialogProps> = ({
  open,
  onClose,
  onLeaveSession,
  onEndSession,
  isOwner,
  sessionId,
  havrutaName,
  sessionType,
}) => {
  const [isLoading, setIsLoading] = React.useState(false)
  const [action, setAction] = React.useState<'leave' | 'end' | null>(null)

  const handleLeaveSession = async () => {
    setIsLoading(true)
    setAction('leave')
    try {
      await onLeaveSession()
      // Don't close dialog here - let the parent component handle navigation
      // onClose() will be called when the component unmounts or navigation occurs
    } catch (error) {
      console.error('Error leaving session:', error)
      setIsLoading(false)
      setAction(null)
    }
  }

  const handleEndSession = async () => {
    setIsLoading(true)
    setAction('end')
    try {
      await onEndSession()
      // Don't close dialog here - let the parent component handle navigation
      // onClose() will be called when the component unmounts or navigation occurs
    } catch (error) {
      console.error('Error ending session:', error)
      setIsLoading(false)
      setAction(null)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        Exit Collaborative Session
      </DialogTitle>
      
      <DialogContent>
        <Box sx={{ mb: 2 }}>
          <Typography variant="body1" gutterBottom>
            You are currently in a collaborative study session{havrutaName && ` for "${havrutaName}"`}.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            What would you like to do?
          </Typography>
        </Box>

        {isOwner && (
          <Alert severity="info" sx={{ mb: 2 }}>
            As the session owner, you can leave (transferring ownership) or end the session for everyone.
          </Alert>
        )}

        {!isOwner && (
          <Alert severity="info" sx={{ mb: 2 }}>
            You can leave this session anytime and rejoin later if it's still active.
          </Alert>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Everyone can leave the session */}
          <Button
            variant="outlined"
            size="large"
            startIcon={isLoading && action === 'leave' ? <CircularProgress size={20} /> : <ExitToApp />}
            onClick={handleLeaveSession}
            disabled={isLoading}
            sx={{ justifyContent: 'flex-start', p: 2 }}
          >
            <Box sx={{ textAlign: 'left', flex: 1 }}>
              <Typography variant="subtitle1">
                Leave Session
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {isOwner 
                  ? 'Leave the session (ownership will transfer to another participant)'
                  : 'Exit the session and return to dashboard'
                }
              </Typography>
            </Box>
          </Button>

          {/* Only current owner can end session for everyone */}
          {isOwner && (
            <Button
              variant="contained"
              color="warning"
              size="large"
              startIcon={isLoading && action === 'end' ? <CircularProgress size={20} /> : <Stop />}
              onClick={handleEndSession}
              disabled={isLoading}
              sx={{ justifyContent: 'flex-start', p: 2 }}
            >
              <Box sx={{ textAlign: 'left', flex: 1 }}>
                <Typography variant="subtitle1">
                  End Session for Everyone
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  Close the session and send all participants back to dashboard
                </Typography>
              </Box>
            </Button>
          )}
        </Box>
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose} disabled={isLoading}>
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default SessionExitDialog