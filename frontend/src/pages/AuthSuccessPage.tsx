import React, { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Box, CircularProgress, Typography, Alert } from '@mui/material'
import { useAuth } from '../contexts/AuthContext'
import authService from '../services/authService'

const AuthSuccessPage: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { state: authState } = useAuth()
  const [error, setError] = React.useState<string | null>(null)

  useEffect(() => {
    const processTokens = async () => {
      const token = searchParams.get('token')
      const refreshToken = searchParams.get('refreshToken')

      if (!token || !refreshToken) {
        setError('Missing authentication tokens')
        setTimeout(() => navigate('/login?error=auth_failed'), 2000)
        return
      }

      try {
        // Store tokens
        authService.setTokens(token, refreshToken)
        
        // Get user profile
        const user = await authService.getCurrentUser()
        if (user) {
          // Force a page reload to trigger the AuthContext to pick up the new authentication state
          window.location.href = '/dashboard'
        } else {
          setError('Failed to get user profile')
          setTimeout(() => navigate('/login?error=auth_failed'), 2000)
        }
      } catch (error) {
        console.error('Token processing failed:', error)
        setError('Authentication failed')
        setTimeout(() => navigate('/login?error=auth_failed'), 2000)
      }
    }

    processTokens()
  }, [searchParams, navigate])

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        bgcolor: 'grey.100',
      }}
    >
      {error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : (
        <>
          <CircularProgress size={60} sx={{ mb: 2 }} />
          <Typography variant="h6" color="text.secondary">
            Completing authentication...
          </Typography>
        </>
      )}
    </Box>
  )
}

export default AuthSuccessPage