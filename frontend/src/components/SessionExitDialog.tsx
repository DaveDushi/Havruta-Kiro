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
      onClose()
    } catch (error) {
      console.error('Error leaving session:', error)
    } finally {
      setIsLoading(false)
      setAction(null)
    }
  }

  const handleEndSession = async () => {
    setIsLoading(true)
    setAction('end')
    try {
      await onEndSession()
      onClose()
    } catch (error) {
      console.error('Error ending session:', error)
    } finally {
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

        {sessionType === 'instant' && isOwner && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            This is an instant session. As the creator, leaving will end the session for all participants.
          </Alert>
        )}

        {sessionType !== 'instant' && isOwner && (
          <Alert severity="info" sx={{ mb: 2 }}>
            As the session owner, you can end the session for all participants or just leave yourself.
          </Alert>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* For instant sessions, owner can only end the session */}
          {sessionType === 'instant' && isOwner ? (
            <Button
              variant="contained"
              color="warning"
              size="large"
              startIcon={isLoading && action === 'leave' ? <CircularProgress size={20} /> : <Stop />}
              onClick={handleLeaveSession}
              disabled={isLoading}
              sx={{ justifyContent: 'flex-start', p: 2 }}
            >
              <Box sx={{ textAlign: 'left', flex: 1 }}>
                <Typography variant="subtitle1">
                  End Instant Session
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  End the session and remove all participants
                </Typography>
              </Box>
            </Button>
          ) : (
            <>
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
                    Exit the session but keep it running for other participants
                  </Typography>
                </Box>
              </Button>

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
                      End Session for All
                    </Typography>
                    <Typography variant="body2" sx={{ opacity: 0.9 }}>
                      End the session and remove all participants
                    </Typography>
                  </Box>
                </Button>
              )}
            </>
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