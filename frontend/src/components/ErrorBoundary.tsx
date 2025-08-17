import React, { Component, ErrorInfo, ReactNode } from 'react'
import { 
  Box, 
  Typography, 
  Button, 
  Alert, 
  AlertTitle, 
  Container,
  Paper,
  Stack
} from '@mui/material'
import { RefreshOutlined, BugReportOutlined, HomeOutlined } from '@mui/icons-material'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  errorId: string
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: ''
    }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo
    })

    // Log error to monitoring service
    this.logErrorToService(error, errorInfo)

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }
  }

  private logErrorToService = async (error: Error, errorInfo: ErrorInfo) => {
    try {
      const errorReport = {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        errorId: this.state.errorId,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        userId: localStorage.getItem('userId') || 'anonymous'
      }

      // In development, just log to console
      if (process.env.NODE_ENV === 'development') {
        console.error('Error Boundary caught an error:', errorReport)
        return
      }

      // In production, send to error reporting service
      const response = await fetch('/api/errors/report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(errorReport)
      })

      if (!response.ok) {
        console.error('Failed to report error to service')
      }
    } catch (reportingError) {
      console.error('Error while reporting error:', reportingError)
    }
  }

  private handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: ''
    })
  }

  private handleGoHome = () => {
    window.location.href = '/dashboard'
  }

  private handleReportBug = () => {
    const subject = encodeURIComponent(`Bug Report - Error ID: ${this.state.errorId}`)
    const body = encodeURIComponent(`
Error ID: ${this.state.errorId}
Error Message: ${this.state.error?.message}
URL: ${window.location.href}
Timestamp: ${new Date().toISOString()}

Please describe what you were doing when this error occurred:


Technical Details:
${this.state.error?.stack}
    `)
    
    window.open(`mailto:support@havruta.app?subject=${subject}&body=${body}`)
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Default error UI
      return (
        <Container maxWidth="md" sx={{ mt: 4 }}>
          <Paper elevation={3} sx={{ p: 4 }}>
            <Stack spacing={3} alignItems="center">
              <BugReportOutlined sx={{ fontSize: 64, color: 'error.main' }} />
              
              <Typography variant="h4" component="h1" textAlign="center" color="error">
                Oops! Something went wrong
              </Typography>
              
              <Alert severity="error" sx={{ width: '100%' }}>
                <AlertTitle>Error Details</AlertTitle>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>Error ID:</strong> {this.state.errorId}
                </Typography>
                <Typography variant="body2">
                  {this.state.error?.message || 'An unexpected error occurred'}
                </Typography>
              </Alert>

              <Typography variant="body1" textAlign="center" color="text.secondary">
                We apologize for the inconvenience. This error has been automatically reported to our team.
              </Typography>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <Button
                  variant="contained"
                  startIcon={<RefreshOutlined />}
                  onClick={this.handleRetry}
                  size="large"
                >
                  Try Again
                </Button>
                
                <Button
                  variant="outlined"
                  startIcon={<HomeOutlined />}
                  onClick={this.handleGoHome}
                  size="large"
                >
                  Go to Dashboard
                </Button>
                
                <Button
                  variant="text"
                  startIcon={<BugReportOutlined />}
                  onClick={this.handleReportBug}
                  size="large"
                >
                  Report Bug
                </Button>
              </Stack>

              {process.env.NODE_ENV === 'development' && this.state.error && (
                <Box sx={{ mt: 3, width: '100%' }}>
                  <Typography variant="h6" color="error" gutterBottom>
                    Development Error Details:
                  </Typography>
                  <Paper 
                    variant="outlined" 
                    sx={{ 
                      p: 2, 
                      backgroundColor: 'grey.50',
                      maxHeight: 300,
                      overflow: 'auto'
                    }}
                  >
                    <Typography 
                      variant="body2" 
                      component="pre" 
                      sx={{ 
                        fontFamily: 'monospace',
                        fontSize: '0.75rem',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word'
                      }}
                    >
                      {this.state.error.stack}
                    </Typography>
                  </Paper>
                </Box>
              )}
            </Stack>
          </Paper>
        </Container>
      )
    }

    return this.props.children
  }
}

// Higher-order component for wrapping components with error boundary
export const withErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode,
  onError?: (error: Error, errorInfo: ErrorInfo) => void
) => {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary fallback={fallback} onError={onError}>
      <Component {...props} />
    </ErrorBoundary>
  )
  
  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`
  
  return WrappedComponent
}