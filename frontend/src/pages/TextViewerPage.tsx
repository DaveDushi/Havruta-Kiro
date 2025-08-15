import React from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { Box, Typography, Paper, Button } from '@mui/material'
import { ArrowBack } from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import { TextViewer } from '../components/TextViewer'
import { useAuth } from '../contexts/AuthContext'

const TextViewerPage: React.FC = () => {
  const { bookTitle } = useParams<{ bookTitle: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { state } = useAuth()
  const user = state.user
  
  const sessionId = searchParams.get('sessionId')
  const isCollaborative = searchParams.get('collaborative') === 'true'
  const initialRef = searchParams.get('ref') || undefined

  // Debug logging
  console.log('TextViewerPage rendered with:', {
    bookTitle,
    sessionId,
    isCollaborative,
    initialRef,
    user: user ? { id: user.id, name: user.name } : null
  })

  const handleBack = () => {
    navigate('/dashboard')
  }

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
          startIcon={<ArrowBack />}
          onClick={handleBack}
          variant="outlined"
          size="small"
        >
          Back to Dashboard
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
          onSectionChange={(section) => {
            console.log('Section changed to:', section)
          }}
        />
      </Box>
    </Box>
  )
}

export default TextViewerPage