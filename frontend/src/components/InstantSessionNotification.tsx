import React from 'react'
import {
  Alert,
  AlertTitle,
  Button,
  Box,
  Typography,
  Snackbar,
  Card,
  CardContent,
  CardActions,
  Slide,
  useTheme,
  useMediaQuery,
} from '@mui/material'
import { PlayArrow, Close, Schedule } from '@mui/icons-material'
import { InstantSessionInvitation } from '../services/socketService'
import { sessionService } from '../services/sessionService'
import { useNavigate } from 'react-router-dom'

interface InstantSessionNotificationProps {
  invitation: InstantSessionInvitation | null
  onClose: () => void
  onJoin?: (sessionId: string) => void
}

const InstantSessionNotification: React.FC<InstantSessionNotificationProps> = ({
  invitation,
  onClose,
  onJoin,
}) => {
  const navigate = useNavigate()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const [isJoining, setIsJoining] = React.useState(false)

  const handleJoin = async () => {
    if (!invitation) return

    setIsJoining(true)
    try {
      // Use the one-click join functionality
      const result = await sessionService.joinInstantSession(invitation.sessionId)
      
      // Navigate to the session
      navigate(result.redirectUrl)
      
      // Call the optional onJoin callback
      if (onJoin) {
        onJoin(invitation.sessionId)
      }
      
      onClose()
    } catch (error) {
      console.error('Error joining instant session:', error)
      // Keep the notification open so user can try again
    } finally {
      setIsJoining(false)
    }
  }

  const handleDismiss = () => {
    onClose()
  }

  if (!invitation) return null

  return (
    <Snackbar
      open={true}
      anchorOrigin={{ 
        vertical: 'top', 
        horizontal: isMobile ? 'center' : 'right' 
      }}
      sx={{
        '& .MuiSnackbarContent-root': {
          padding: 0,
          backgroundColor: 'transparent',
          boxShadow: 'none',
        }
      }}
    >
      <Slide direction="down" in={true} mountOnEnter unmountOnExit>
        <Card
          elevation={8}
          sx={{
            minWidth: isMobile ? '90vw' : 400,
            maxWidth: isMobile ? '95vw' : 500,
            backgroundColor: theme.palette.primary.main,
            color: theme.palette.primary.contrastText,
            border: `2px solid ${theme.palette.primary.light}`,
          }}
        >
          <CardContent sx={{ pb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1 }}>
              <Schedule sx={{ mt: 0.5, color: theme.palette.primary.contrastText }} />
              <Box sx={{ flex: 1 }}>
                <Typography variant="h6" component="div" sx={{ fontWeight: 600 }}>
                  Instant Session Started!
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.9, mt: 0.5 }}>
                  {invitation.creatorName} started an instant session for "{invitation.havrutaName}"
                </Typography>
              </Box>
              <Button
                size="small"
                onClick={handleDismiss}
                sx={{ 
                  minWidth: 'auto',
                  color: theme.palette.primary.contrastText,
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  }
                }}
              >
                <Close fontSize="small" />
              </Button>
            </Box>
            
            <Typography variant="body2" sx={{ opacity: 0.8, fontSize: '0.875rem' }}>
              Join now to study together in real-time
            </Typography>
          </CardContent>
          
          <CardActions sx={{ pt: 0, pb: 2, px: 2 }}>
            <Button
              variant="contained"
              size="large"
              fullWidth
              startIcon={<PlayArrow />}
              onClick={handleJoin}
              disabled={isJoining}
              sx={{
                backgroundColor: theme.palette.background.paper,
                color: theme.palette.primary.main,
                fontWeight: 600,
                '&:hover': {
                  backgroundColor: theme.palette.grey[100],
                },
                '&:disabled': {
                  backgroundColor: theme.palette.grey[300],
                  color: theme.palette.grey[600],
                }
              }}
            >
              {isJoining ? 'Joining...' : 'Join Session'}
            </Button>
          </CardActions>
        </Card>
      </Slide>
    </Snackbar>
  )
}

export default InstantSessionNotification