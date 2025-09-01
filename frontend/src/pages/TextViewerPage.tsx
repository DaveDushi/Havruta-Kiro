import React from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { Box, Typography, Paper, Button, Snackbar, Alert } from '@mui/material'
import { ArrowBack, ExitToApp } from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import { TextViewer } from '../components/TextViewer'
import { useAuth } from '../contexts/AuthContext'
import { sessionService } from '../services/sessionService'
import SessionExitDialog from '../components/SessionExitDialog'

const TextViewerPage: React.FC = () => {
  const { bookTitle } = useParams<{ bookTitle: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { state } = useAuth()
  const user = state.user
  
  const sessionId = searchParams.get('sessionId')
  const isCollaborative = searchParams.get('collaborative') === 'true'
  const initialRef = searchParams.get('ref') || undefined

  const [exitDialogOpen, setExitDialogOpen] = React.useState(false)
  const [sessionData, setSessionData] = React.useState<any>(null)
  const [currentSection, setCurrentSection] = React.useState<string>(initialRef || '')
  const [isExiting, setIsExiting] = React.useState(false)
  const [snackbar, setSnackbar] = React.useState<{
    open: boolean
    message: string
    severity: 'success' | 'error' | 'info'
  }>({ open: false, message: '', severity: 'info' })

  // Fetch session data if in collaborative mode
  React.useEffect(() => {
    if (isCollaborative && sessionId) {
      // Fetch both session details and current state (including ownership)
      Promise.all([
        sessionService.getSessionById(sessionId),
        sessionService.getSessionState(sessionId)
      ])
        .then(([session, state]) => {
          setSessionData({
            ...session,
            currentState: state
          })
        })
        .catch(error => {
          console.error('Error fetching session data:', error)
        })
    }
  }, [isCollaborative, sessionId])

  // Debug logging
  console.log('TextViewerPage rendered with:', {
    bookTitle,
    sessionId,
    isCollaborative,
    initialRef,
    user: user ? { id: user.id, name: user.name } : null
  })

  const handleBack = () => {
    if (isExiting) return // Prevent multiple clicks
    
    if (isCollaborative && sessionId) {
      // Always show dialog for collaborative sessions (Zoom-like behavior)
      setExitDialogOpen(true)
    } else {
      navigate('/dashboard')
    }
  }

  const handleLeaveSession = async () => {
    if (!sessionId || isExiting) return
    
    setIsExiting(true)
    try {
      await sessionService.leaveSession(sessionId)
      
      const message = 'Left session successfully'
      
      setSnackbar({
        open: true,
        message,
        severity: 'success'
      })
      // Small delay to show the success message
      setTimeout(() => navigate('/dashboard'), 1000)
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Failed to leave session: ' + (error instanceof Error ? error.message : 'Unknown error'),
        severity: 'error'
      })
      setIsExiting(false)
    }
  }

  const handleEndSession = async () => {
    if (!sessionId || isExiting) return
    
    setIsExiting(true)
    try {
      // Use current section or initial ref as ending section
      const endingSection = currentSection || initialRef || `${bookTitle} 1:1`
      const coverageRange = initialRef && currentSection && initialRef !== currentSection 
        ? `${initialRef} to ${currentSection}` 
        : undefined
      
      await sessionService.endSession(sessionId, endingSection, coverageRange)
      setSnackbar({
        open: true,
        message: 'Session ended successfully',
        severity: 'success'
      })
      // Small delay to show the success message
      setTimeout(() => navigate('/dashboard'), 1000)
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Failed to end session: ' + (error instanceof Error ? error.message : 'Unknown error'),
        severity: 'error'
      })
      setIsExiting(false)
    }
  }

  const handleSectionChange = (section: any) => {
    const sectionRef = typeof section === 'string' ? section : section.ref
    setCurrentSection(sectionRef)
    console.log('Section changed to:', sectionRef)
  }

  const handleCloseSnackbar = () => {
    setSnackbar(prev => ({ ...prev, open: false }))
  }

  // Check if user is current session owner (may have been transferred)
  const isSessionOwner = sessionData?.currentState?.isCurrentUserOwner || sessionData?.havruta?.ownerId === user?.id

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Paper 
        elevation={1} 
        sx={{ 
          p: 2, 
          display: 'flex', 
          alignItems: 'center', 
          gap: 2,
          borderRadius: 0,
          borderBottom: 1,
          borderColor: 'divider'
        }}
      >
        <Button
          startIcon={isCollaborative ? <ExitToApp /> : <ArrowBack />}
          onClick={handleBack}
          variant="outlined"
          size="small"
          color={isCollaborative ? "warning" : "primary"}
          disabled={isExiting}
        >
          {isExiting ? 'Exiting...' : isCollaborative ? 'End Session' : 'Back to Dashboard'}
        </Button>
        
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6">
            {bookTitle || 'Text Study'}
          </Typography>
          {isCollaborative && sessionId && (
            <Typography variant="caption" color="text.secondary">
              Collaborative Session: {sessionId}
            </Typography>
          )}
        </Box>
        
        {isCollaborative && (
          <Typography 
            variant="caption" 
            sx={{ 
              px: 2, 
              py: 0.5, 
              bgcolor: 'primary.light', 
              color: 'primary.contrastText',
              borderRadius: 1,
              fontWeight: 'medium'
            }}
          >
            COLLABORATIVE MODE
          </Typography>
        )}
      </Paper>

      {/* TextViewer */}
      <Box sx={{ flex: 1, overflow: 'hidden' }}>
        <TextViewer
          bookTitle={bookTitle || 'Genesis'}
          initialRef={initialRef}
          sessionId={sessionId || undefined}
          userId={user?.id}
          isCollaborative={isCollaborative}
          onNavigationChange={(ref) => {
            console.log('Navigation changed to:', ref)
          }}
          onSectionChange={handleSectionChange}
        />
      </Box>

      {/* Session Exit Dialog */}
      <SessionExitDialog
        open={exitDialogOpen}
        onClose={() => !isExiting && setExitDialogOpen(false)}
        onLeaveSession={handleLeaveSession}
        onEndSession={handleEndSession}
        isOwner={isSessionOwner}
        sessionId={sessionId || ''}
        havrutaName={sessionData?.havruta?.name}
        sessionType={sessionData?.type}
      />

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Alert 
          onClose={handleCloseSnackbar} 
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}

export default TextViewerPage