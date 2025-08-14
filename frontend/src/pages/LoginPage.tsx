import React from 'react'
import {
  Box,
  Paper,
  Typography,
  Button,
  Stack,
  Alert,
  CircularProgress,
} from '@mui/material'
import { Google, Apple } from '@mui/icons-material'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate, useSearchParams } from 'react-router-dom'

const LoginPage: React.FC = () => {
  const { state: authState, login, clearError } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [urlError, setUrlError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (authState.isAuthenticated) {
      navigate('/dashboard')
    }
  }, [authState.isAuthenticated, navigate])

  React.useEffect(() => {
    const error = searchParams.get('error')
    if (error) {
      switch (error) {
        case 'oauth_failed':
          setUrlError('OAuth authentication failed. Please try again.')
          break
        case 'invalid_callback':
          setUrlError('Invalid authentication callback. Please try again.')
          break
        case 'auth_failed':
          setUrlError('Authentication failed. Please try again.')
          break
        default:
          setUrlError('An error occurred during authentication.')
      }
    }
  }, [searchParams])

  const handleLogin = async (provider: 'google' | 'apple') => {
    clearError()
    setUrlError(null)
    await login(provider)
  }

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        bgcolor: 'grey.100',
      }}
    >
      <Paper
        elevation={3}
        sx={{
          p: 4,
          maxWidth: 400,
          width: '100%',
          textAlign: 'center',
        }}
      >
        <Typography variant="h4" component="h1" gutterBottom>
          Welcome to Havruta
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          Collaborative Jewish Text Study
        </Typography>

        {(authState.error || urlError) && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {authState.error || urlError}
          </Alert>
        )}

        <Stack spacing={2}>
          <Button
            variant="contained"
            size="large"
            startIcon={authState.isLoading ? <CircularProgress size={20} /> : <Google />}
            onClick={() => handleLogin('google')}
            disabled={authState.isLoading}
            fullWidth
          >
            {authState.isLoading ? 'Signing in...' : 'Continue with Google'}
          </Button>

          <Button
            variant="outlined"
            size="large"
            startIcon={authState.isLoading ? <CircularProgress size={20} /> : <Apple />}
            onClick={() => handleLogin('apple')}
            disabled={authState.isLoading}
            fullWidth
          >
            {authState.isLoading ? 'Signing in...' : 'Continue with Apple'}
          </Button>
        </Stack>

        <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
          By signing in, you agree to our Terms of Service and Privacy Policy
        </Typography>
      </Paper>
    </Box>
  )
}

export default LoginPage