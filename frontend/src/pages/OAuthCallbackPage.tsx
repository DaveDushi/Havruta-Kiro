import React, { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Box, CircularProgress, Typography, Alert } from '@mui/material'
import { useAuth } from '../contexts/AuthContext'

const OAuthCallbackPage: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { handleOAuthCallback, state: authState } = useAuth()

  useEffect(() => {
    const processCallback = async () => {
      const code = searchParams.get('code')
      const provider = searchParams.get('state') as 'google' | 'apple'
      const error = searchParams.get('error')

      if (error) {
        console.error('OAuth error:', error)
        navigate('/login?error=oauth_failed')
        return
      }

      if (!code || !provider) {
        console.error('Missing OAuth parameters')
        navigate('/login?error=invalid_callback')
        return
      }

      try {
        await handleOAuthCallback(code, provider)
        navigate('/dashboard')
      } catch (error) {
        console.error('OAuth callback failed:', error)
        navigate('/login?error=auth_failed')
      }
    }

    processCallback()
  }, [searchParams, handleOAuthCallback, navigate])

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
      {authState.error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          Authentication failed: {authState.error}
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

export default OAuthCallbackPage