import React from 'react'
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  Chip,
  Paper,
  useTheme,
  useMediaQuery,
  Skeleton,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  InputAdornment,
  IconButton,
  Alert,
  Snackbar,
} from '@mui/material'
import { 
  Add, 
  PlayArrow, 
  Schedule, 
  Group, 
  MenuBook, 
  Search, 
  FilterList,
  Sort,
  PersonAdd,
  Bolt,
} from '@mui/icons-material'
import { useAuth } from '../contexts/AuthContext'
import { useDashboardData } from '../hooks/useDashboardData'
import { havrutaService } from '../services/havrutaService'
import { sessionService } from '../services/sessionService'
import { CreateHavrutaDialog } from '../components/CreateHavrutaDialog'
import { ParticipantInvitationDialog } from '../components/ParticipantInvitationDialog'
import SessionSchedulingDialog from '../components/SessionSchedulingDialog'
import InstantSessionNotification from '../components/InstantSessionNotification'
import { Havruta } from '../types'
import { useNavigate } from 'react-router-dom'
import { testLogin, isTestMode } from '../utils/testAuth'
import { runWebRTCTests } from '../utils/webrtcTest'
import { socketService, InstantSessionInvitation } from '../services/socketService'

const DashboardPage: React.FC = () => {
  const { state: authState } = useAuth()
  const navigate = useNavigate()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [searchTerm, setSearchTerm] = React.useState('')
  const [filterStatus, setFilterStatus] = React.useState<'all' | 'active' | 'inactive'>('all')
  const [sortBy, setSortBy] = React.useState<'name' | 'lastStudied' | 'sessions'>('lastStudied')
  const [sortOrder, setSortOrder] = React.useState<'asc' | 'desc'>('desc')
  const [snackbar, setSnackbar] = React.useState<{
    open: boolean
    message: string
    severity: 'success' | 'error' | 'info'
  }>({ open: false, message: '', severity: 'info' })
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false)
  const [invitationDialogOpen, setInvitationDialogOpen] = React.useState(false)
  const [schedulingDialogOpen, setSchedulingDialogOpen] = React.useState(false)
  const [selectedHavrutaForInvitation, setSelectedHavrutaForInvitation] = React.useState<Havruta | null>(null)
  const [selectedHavrutaForScheduling, setSelectedHavrutaForScheduling] = React.useState<Havruta | null>(null)
  const [instantSessionInvitation, setInstantSessionInvitation] = React.useState<InstantSessionInvitation | null>(null)

  // Use the dashboard data hook
  const {
    havrutot,
    activeSessions,
    upcomingSessions,
    nextSession,
    statistics,
    isLoading,
    error,
    refetch,
    joinHavruta,
    scheduleSession,
    createHavruta,
  } = useDashboardData()

  // Set up WebSocket connection and instant session notifications
  React.useEffect(() => {
    if (authState.user && authState.isAuthenticated) {
      // Connect to WebSocket for real-time notifications
      socketService.connect(authState.user).catch(error => {
        console.error('Failed to connect to WebSocket:', error)
      })

      // Listen for instant session invitations
      const handleInstantSessionInvitation = (invitation: InstantSessionInvitation) => {
        console.log('Received instant session invitation:', invitation)
        setInstantSessionInvitation(invitation)
      }

      socketService.on('instant-session-invitation', handleInstantSessionInvitation)

      return () => {
        socketService.off('instant-session-invitation', handleInstantSessionInvitation)
      }
    }
  }, [authState.user, authState.isAuthenticated])

  // Filter and sort upcoming sessions
  const filteredAndSortedSessions = React.useMemo(() => {
    let filtered = upcomingSessions.filter(session => {
      const matchesSearch = session.havrutaName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           session.bookTitle.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesStatus = filterStatus === 'all' || 
                           (filterStatus === 'active') || // All upcoming sessions are "active"
                           (filterStatus === 'inactive' && false) // No inactive upcoming sessions
      return matchesSearch && matchesStatus
    })

    filtered.sort((a, b) => {
      let comparison = 0
      switch (sortBy) {
        case 'name':
          comparison = a.havrutaName.localeCompare(b.havrutaName)
          break
        case 'lastStudied':
        case 'sessions':
          comparison = a.startTime.getTime() - b.startTime.getTime()
          break
      }
      return sortOrder === 'asc' ? comparison : -comparison
    })

    return filtered
  }, [upcomingSessions, searchTerm, filterStatus, sortBy, sortOrder])

  const handleCreateHavruta = () => {
    setCreateDialogOpen(true)
  }

  const handleCreateHavrutaSuccess = () => {
    setSnackbar({
      open: true,
      message: 'Havruta created successfully!',
      severity: 'success'
    })
  }

  const handleTestLogin = async () => {
    try {
      const result = await testLogin()
      setSnackbar({
        open: true,
        message: `Test login successful! Logged in as ${result.user.name}`,
        severity: 'success'
      })
      // Refresh the page to update auth state
      window.location.reload()
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Test login failed. Make sure backend is running and test user exists.',
        severity: 'error'
      })
    }
  }

  const handleTestWebRTC = async () => {
    try {
      const results = await runWebRTCTests()
      const message = `WebRTC Test Results:
Support: ${results.support.success ? '✓' : '✗'} ${results.support.message}
Media: ${results.mediaAccess.success ? '✓' : '✗'} ${results.mediaAccess.message}
STUN: ${results.stunConnectivity.success ? '✓' : '✗'} ${results.stunConnectivity.message}`
      
      setSnackbar({
        open: true,
        message,
        severity: results.overall.success ? 'success' : 'warning'
      })
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'WebRTC test failed: ' + (error instanceof Error ? error.message : 'Unknown error'),
        severity: 'error'
      })
    }
  }

  const handleJoinHavruta = async (havrutaId: string) => {
    try {
      const havruta = havrutot.find(h => h.id === havrutaId)
      if (havruta) {
        // Optional: Create/join a session for progress tracking
        try {
          const activeSession = await sessionService.getActiveSessionForHavruta(havrutaId)
          if (activeSession) {
            await sessionService.joinSession(activeSession.id)
          } else {
            const newSession = await sessionService.initializeSession({ havrutaId })
            await sessionService.joinSession(newSession.id)
          }
        } catch (sessionError) {
          // Session management is optional - continue without it
          console.warn('Session management failed, continuing without session tracking:', sessionError)
        }
        
        // Navigate to TextViewer with collaborative mode enabled
        // Use havrutaId for WebSocket connection (this is what the backend expects)
        const params = new URLSearchParams({
          sessionId: havrutaId, // This is actually the havruta ID for WebSocket connection
          collaborative: 'true',
          ref: havruta.lastPlace
        })
        const url = `/study/${encodeURIComponent(havruta.bookTitle)}?${params.toString()}`
        console.log('🚀 Joining collaborative session:', {
          havrutaId,
          havrutaName: havruta.name,
          bookTitle: havruta.bookTitle,
          lastPlace: havruta.lastPlace,
          url,
          user: authState.user ? { id: authState.user.id, name: authState.user.name } : null
        })
        navigate(url)
        
        setSnackbar({
          open: true,
          message: 'Successfully joined collaborative study session!',
          severity: 'success'
        })
      }
    } catch (error) {
      console.error('Error joining Havruta:', error)
      setSnackbar({
        open: true,
        message: 'Failed to join collaborative session: ' + (error instanceof Error ? error.message : 'Unknown error'),
        severity: 'error'
      })
    }
  }

  const handleScheduleSession = (havrutaId: string) => {
    const havruta = havrutot.find(h => h.id === havrutaId)
    if (havruta) {
      setSelectedHavrutaForScheduling(havruta)
      setSchedulingDialogOpen(true)
    }
  }

  const handleSchedulingSuccess = (message: string) => {
    setSnackbar({
      open: true,
      message,
      severity: 'success'
    })
    refetch() // Refresh dashboard data
  }

  const handleInviteParticipant = (havrutaId: string) => {
    const havruta = havrutot.find(h => h.id === havrutaId)
    if (havruta) {
      setSelectedHavrutaForInvitation(havruta)
      setInvitationDialogOpen(true)
    }
  }

  const handleSendInvitations = async (havrutaId: string, emails: string[]) => {
    try {
      const result = await havrutaService.inviteParticipants(havrutaId, emails)
      return result
    } catch (error) {
      console.error('Error sending invitations:', error)
      throw error
    }
  }

  // Helper function to check if a Havruta has an active session
  const getActiveSessionForHavruta = (havrutaId: string) => {
    return activeSessions.find(session => session.havrutaId === havrutaId)
  }

  const handleStartInstantSession = async (havrutaId: string) => {
    try {
      const session = await sessionService.createInstantSession(havrutaId)
      
      // Refresh dashboard data to update button states
      await refetch()
      
      setSnackbar({
        open: true,
        message: 'Instant session started! Participants have been notified.',
        severity: 'success'
      })

      // Navigate to the session immediately
      const havruta = havrutot.find(h => h.id === havrutaId)
      if (havruta) {
        const params = new URLSearchParams({
          sessionId: session.id,
          collaborative: 'true',
          ref: havruta.lastPlace
        })
        const url = `/study/${encodeURIComponent(havruta.bookTitle)}?${params.toString()}`
        navigate(url)
      }
    } catch (error) {
      console.error('Error starting instant session:', error)
      setSnackbar({
        open: true,
        message: 'Failed to start instant session: ' + (error instanceof Error ? error.message : 'Unknown error'),
        severity: 'error'
      })
    }
  }

  const handleJoinActiveSession = async (havrutaId: string) => {
    try {
      const activeSession = getActiveSessionForHavruta(havrutaId)
      if (!activeSession) {
        throw new Error('No active session found')
      }

      // Join the existing session
      await sessionService.joinSession(activeSession.id)
      
      // Refresh dashboard data to update button states
      await refetch()
      
      setSnackbar({
        open: true,
        message: 'Joining active session...',
        severity: 'info'
      })

      // Navigate to the session
      const havruta = havrutot.find(h => h.id === havrutaId)
      if (havruta) {
        const params = new URLSearchParams({
          sessionId: activeSession.id,
          collaborative: 'true',
          ref: havruta.lastPlace
        })
        const url = `/study/${encodeURIComponent(havruta.bookTitle)}?${params.toString()}`
        navigate(url)
      }
    } catch (error) {
      console.error('Error joining active session:', error)
      setSnackbar({
        open: true,
        message: 'Failed to join session: ' + (error instanceof Error ? error.message : 'Unknown error'),
        severity: 'error'
      })
    }
  }

  const handleInstantSessionJoin = (sessionId: string) => {
    setSnackbar({
      open: true,
      message: 'Joining instant session...',
      severity: 'info'
    })
  }

  const handleCloseInstantSessionNotification = () => {
    setInstantSessionInvitation(null)
  }

  const toggleSortOrder = () => {
    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')
  }

  const handleCloseSnackbar = () => {
    setSnackbar(prev => ({ ...prev, open: false }))
  }

  if (isLoading) {
    return (
      <Box>
        <Skeleton variant="text" width="40%" height={60} sx={{ mb: 3 }} />
        <Skeleton variant="rectangular" height={120} sx={{ mb: 4 }} />
        <Grid container spacing={3}>
          {[1, 2, 3].map((i) => (
            <Grid item xs={12} md={6} lg={4} key={i}>
              <Skeleton variant="rectangular" height={200} />
            </Grid>
          ))}
        </Grid>
      </Box>
    )
  }

  return (
    <Box>
      {/* Header Section */}
      <Box 
        sx={{ 
          display: 'flex', 
          flexDirection: isMobile ? 'column' : 'row',
          justifyContent: 'space-between', 
          alignItems: isMobile ? 'stretch' : 'center', 
          mb: 4,
          gap: isMobile ? 2 : 0
        }}
      >
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            Welcome back, {authState.user?.name?.split(' ')[0]}!
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Continue your learning journey with your study partners
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexDirection: isMobile ? 'column' : 'row' }}>
          {isTestMode() && (
            <>
              <Button
                variant="outlined"
                size={isMobile ? 'large' : 'medium'}
                onClick={handleTestLogin}
                sx={{ minWidth: isMobile ? '100%' : 'auto' }}
              >
                Test Login
              </Button>
              <Button
                variant="outlined"
                size={isMobile ? 'large' : 'medium'}
                onClick={handleTestWebRTC}
                sx={{ minWidth: isMobile ? '100%' : 'auto' }}
              >
                Test WebRTC
              </Button>
              <Button
                variant="outlined"
                size={isMobile ? 'large' : 'medium'}
                onClick={async () => {
                  try {
                    const { socketService } = await import('../services/socketService')
                    if (authState.user) {
                      await socketService.connect(authState.user)
                      setSnackbar({
                        open: true,
                        message: 'Socket connected successfully!',
                        severity: 'success'
                      })
                    }
                  } catch (error) {
                    setSnackbar({
                      open: true,
                      message: 'Socket connection failed: ' + (error instanceof Error ? error.message : 'Unknown error'),
                      severity: 'error'
                    })
                  }
                }}
                sx={{ minWidth: isMobile ? '100%' : 'auto' }}
              >
                Test Socket
              </Button>
            </>
          )}
          <Button
            variant="outlined"
            size={isMobile ? 'large' : 'medium'}
            startIcon={<MenuBook />}
            onClick={() => navigate('/study/Genesis?ref=Genesis%201:1')}
            sx={{ minWidth: isMobile ? '100%' : 'auto' }}
          >
            Test TextViewer
          </Button>
          <Button
            variant="contained"
            size={isMobile ? 'large' : 'medium'}
            startIcon={<Add />}
            onClick={handleCreateHavruta}
            sx={{ minWidth: isMobile ? '100%' : 'auto' }}
          >
            New Havruta
          </Button>
        </Box>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => refetch()}>
          {error}
        </Alert>
      )}

      {/* Quick Stats */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h4" color="primary" gutterBottom>
              {statistics.totalHavrutot}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Total Havrutot
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h4" color="primary" gutterBottom>
              {statistics.totalSessions}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Total Sessions
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h4" color="primary" gutterBottom>
              {statistics.activeHavrutot}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Active Havrutot
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h4" color="primary" gutterBottom>
              {statistics.totalStudyPartners}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Study Partners
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Next Up Section */}
      {nextSession && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Schedule color="primary" />
            Next Up
          </Typography>
          <Card elevation={3}>
            <CardContent>
              <Box 
                sx={{ 
                  display: 'flex', 
                  flexDirection: isMobile ? 'column' : 'row',
                  justifyContent: 'space-between', 
                  alignItems: isMobile ? 'stretch' : 'center',
                  gap: isMobile ? 2 : 0
                }}
              >
                <Box sx={{ flex: 1 }}>
                  <Typography variant="h6" gutterBottom>
                    {nextSession.name}
                  </Typography>
                  <Typography color="text.secondary" gutterBottom>
                    Scheduled for {nextSession.scheduledTime.toLocaleString()}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Continue from {nextSession.lastPlace}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1, flexDirection: isMobile ? 'column' : 'row' }}>
                  <Button
                    variant="contained"
                    size="large"
                    startIcon={<PlayArrow />}
                    onClick={() => handleJoinHavruta(nextSession.id)}
                    sx={{ minWidth: isMobile ? '100%' : 'auto' }}
                  >
                    Join Session
                  </Button>
                  {(() => {
                    const activeSession = getActiveSessionForHavruta(nextSession.id)
                    return (
                      <Button
                        variant="outlined"
                        size="large"
                        startIcon={activeSession ? <PlayArrow /> : <Bolt />}
                        onClick={() => activeSession ? handleJoinActiveSession(nextSession.id) : handleStartInstantSession(nextSession.id)}
                        sx={{ 
                          minWidth: isMobile ? '100%' : 'auto',
                          borderColor: activeSession ? theme.palette.success.main : theme.palette.warning.main,
                          color: activeSession ? theme.palette.success.main : theme.palette.warning.main,
                          '&:hover': {
                            borderColor: activeSession ? theme.palette.success.dark : theme.palette.warning.dark,
                            backgroundColor: activeSession ? theme.palette.success.light : theme.palette.warning.light,
                          }
                        }}
                      >
                        {activeSession ? 'Join Now' : 'Start Now'}
                      </Button>
                    )
                  })()}
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Upcoming Sessions */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Schedule color="primary" />
          Upcoming Sessions ({filteredAndSortedSessions.length})
        </Typography>
      </Box>

      {/* Search and Filter Controls */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={4}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search Sessions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Status</InputLabel>
              <Select
                value={filterStatus}
                label="Status"
                onChange={(e) => setFilterStatus(e.target.value as 'all' | 'active' | 'inactive')}
                startAdornment={<FilterList sx={{ mr: 1 }} />}
              >
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="inactive">Inactive</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Sort by</InputLabel>
              <Select
                value={sortBy}
                label="Sort by"
                onChange={(e) => setSortBy(e.target.value as 'name' | 'lastStudied' | 'sessions')}
                startAdornment={<Sort sx={{ mr: 1 }} />}
              >
                <MenuItem value="name">Havruta Name</MenuItem>
                <MenuItem value="lastStudied">Start Time</MenuItem>
                <MenuItem value="sessions">Start Time</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <Button
              fullWidth
              variant="outlined"
              size="small"
              onClick={toggleSortOrder}
              startIcon={<Sort />}
            >
              {sortOrder === 'asc' ? 'A-Z' : 'Z-A'}
            </Button>
          </Grid>
        </Grid>
      </Paper>
      
      {filteredAndSortedSessions.length > 0 ? (
        <Grid container spacing={3}>
          {filteredAndSortedSessions.map((session) => (
            <Grid item xs={12} sm={6} lg={4} key={session.id}>
              <Card 
                elevation={2}
                sx={{ 
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: theme.shadows[8],
                  }
                }}
              >
                <CardContent sx={{ flexGrow: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Typography variant="h6" component="h3" sx={{ fontWeight: 600 }}>
                      {session.havrutaName}
                    </Typography>
                    <Chip
                      label={session.isRecurring ? 'Recurring' : 'One-time'}
                      color={session.isRecurring ? 'primary' : 'default'}
                      size="small"
                    />
                  </Box>
                  
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <MenuBook fontSize="small" color="action" />
                    <Typography color="text.secondary">
                      {session.bookTitle}
                    </Typography>
                  </Box>
                  
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Schedule fontSize="small" color="action" />
                    <Typography variant="body2" color="text.secondary">
                      {session.startTime.toLocaleString()}
                    </Typography>
                  </Box>
                  
                  <Typography variant="body2" sx={{ mb: 2 }}>
                    Continue from: {session.lastPlace}
                  </Typography>
                  
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Group fontSize="small" color="action" />
                    <Typography variant="body2" color="text.secondary">
                      {session.participants.length} participants
                    </Typography>
                  </Box>
                </CardContent>
                
                <CardContent sx={{ pt: 0 }}>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<PlayArrow />}
                      onClick={() => handleJoinHavruta(session.havrutaId)}
                      sx={{ flex: 1, minWidth: 'fit-content' }}
                    >
                      Join Session
                    </Button>
                    {(() => {
                      const activeSession = getActiveSessionForHavruta(session.havrutaId)
                      return (
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={activeSession ? <PlayArrow /> : <Bolt />}
                          onClick={() => activeSession ? handleJoinActiveSession(session.havrutaId) : handleStartInstantSession(session.havrutaId)}
                          sx={{ 
                            flex: 1, 
                            minWidth: 'fit-content',
                            borderColor: activeSession ? theme.palette.success.main : theme.palette.warning.main,
                            color: activeSession ? theme.palette.success.main : theme.palette.warning.main,
                            '&:hover': {
                              borderColor: activeSession ? theme.palette.success.dark : theme.palette.warning.dark,
                              backgroundColor: activeSession ? theme.palette.success.light : theme.palette.warning.light,
                            }
                          }}
                        >
                          {activeSession ? 'Join Now' : 'Start Now'}
                        </Button>
                      )
                    })()}
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<Schedule />}
                      onClick={() => handleScheduleSession(session.havrutaId)}
                      sx={{ flex: 1, minWidth: 'fit-content' }}
                    >
                      Reschedule
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      ) : (
        <Paper sx={{ textAlign: 'center', py: 8, px: 4 }}>
          <Schedule sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            {upcomingSessions.length === 0 ? 'No upcoming sessions' : 'No sessions match your filters'}
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 3, maxWidth: 400, mx: 'auto' }}>
            {upcomingSessions.length === 0 
              ? 'Schedule your first session to start studying with your Havruta partners'
              : 'Try adjusting your search or filter criteria to find your sessions'
            }
          </Typography>
          {upcomingSessions.length === 0 ? (
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                size="large"
                startIcon={<Add />}
                onClick={handleCreateHavruta}
              >
                Create Havruta
              </Button>
              {havrutot.length > 0 && (
                <Button
                  variant="outlined"
                  size="large"
                  startIcon={<Schedule />}
                  onClick={() => {
                    const firstHavruta = havrutot[0]
                    if (firstHavruta) {
                      handleScheduleSession(firstHavruta.id)
                    }
                  }}
                >
                  Schedule Session
                </Button>
              )}
            </Box>
          ) : (
            <Button
              variant="outlined"
              size="large"
              onClick={() => {
                setSearchTerm('')
                setFilterStatus('all')
              }}
            >
              Clear Filters
            </Button>
          )}
        </Paper>
      )}

      {/* My Havrutot Section */}
      <Box sx={{ mt: 6, mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
          <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <MenuBook color="primary" />
            My Havrutot ({havrutot.length})
          </Typography>
          <Button
            variant="outlined"
            startIcon={<Add />}
            onClick={handleCreateHavruta}
          >
            New Havruta
          </Button>
        </Box>

        {havrutot.length > 0 ? (
          <Grid container spacing={2}>
            {havrutot.map((havruta) => (
              <Grid item xs={12} sm={6} md={4} key={havruta.id}>
                <Card variant="outlined" sx={{ height: '100%' }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      {havruta.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      {havruta.bookTitle}
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 2 }}>
                      {havruta.participants.length} participants
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      {(() => {
                        const activeSession = getActiveSessionForHavruta(havruta.id)
                        return (
                          <Button
                            variant="contained"
                            size="small"
                            startIcon={activeSession ? <PlayArrow /> : <Bolt />}
                            onClick={() => activeSession ? handleJoinActiveSession(havruta.id) : handleStartInstantSession(havruta.id)}
                            sx={{ 
                              backgroundColor: activeSession ? theme.palette.success.main : theme.palette.warning.main,
                              color: activeSession ? theme.palette.success.contrastText : theme.palette.warning.contrastText,
                              '&:hover': {
                                backgroundColor: activeSession ? theme.palette.success.dark : theme.palette.warning.dark,
                              }
                            }}
                          >
                            {activeSession ? 'Join Now' : 'Start Now'}
                          </Button>
                        )
                      })()}
                      <Button
                        size="small"
                        startIcon={<Schedule />}
                        onClick={() => handleScheduleSession(havruta.id)}
                      >
                        Schedule
                      </Button>
                      <Button
                        size="small"
                        startIcon={<PersonAdd />}
                        onClick={() => handleInviteParticipant(havruta.id)}
                      >
                        Invite
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        ) : (
          <Paper sx={{ textAlign: 'center', py: 4, px: 4 }}>
            <MenuBook sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No Havrutot yet
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 3 }}>
              Create your first Havruta to start studying with partners
            </Typography>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={handleCreateHavruta}
            >
              Create Your First Havruta
            </Button>
          </Paper>
        )}
      </Box>

      {/* Create Havruta Dialog */}
      <CreateHavrutaDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onSuccess={handleCreateHavrutaSuccess}
        onCreateHavruta={createHavruta}
      />

      {/* Participant Invitation Dialog */}
      <ParticipantInvitationDialog
        open={invitationDialogOpen}
        onClose={() => {
          setInvitationDialogOpen(false)
          setSelectedHavrutaForInvitation(null)
          // Refresh dashboard data when dialog closes to show updated participant count
          refetch().catch(console.error)
        }}
        havrutaName={selectedHavrutaForInvitation?.name || ''}
        havrutaId={selectedHavrutaForInvitation?.id || ''}
        onInvite={handleSendInvitations}
      />

      {/* Session Scheduling Dialog */}
      <SessionSchedulingDialog
        open={schedulingDialogOpen}
        onClose={() => {
          setSchedulingDialogOpen(false)
          setSelectedHavrutaForScheduling(null)
        }}
        havruta={selectedHavrutaForScheduling}
        onSuccess={handleSchedulingSuccess}
      />

      {/* Instant Session Notification */}
      <InstantSessionNotification
        invitation={instantSessionInvitation}
        onClose={handleCloseInstantSessionNotification}
        onJoin={handleInstantSessionJoin}
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

export default DashboardPage