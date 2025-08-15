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
} from '@mui/icons-material'
import { useAuth } from '../contexts/AuthContext'
import { useDashboardData } from '../hooks/useDashboardData'
import { Havruta } from '../types'
import { useNavigate } from 'react-router-dom'

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

  // Use the dashboard data hook
  const {
    havrutot,
    nextSession,
    statistics,
    isLoading,
    error,
    refetch,
    joinHavruta,
    scheduleSession,
    createHavruta,
  } = useDashboardData()

  // Filter and sort Havrutot
  const filteredAndSortedHavrutot = React.useMemo(() => {
    let filtered = havrutot.filter(havruta => {
      const matchesSearch = havruta.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           havruta.bookTitle.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesStatus = filterStatus === 'all' || 
                           (filterStatus === 'active' && havruta.isActive) ||
                           (filterStatus === 'inactive' && !havruta.isActive)
      return matchesSearch && matchesStatus
    })

    filtered.sort((a, b) => {
      let comparison = 0
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name)
          break
        case 'lastStudied':
          comparison = new Date(a.lastStudiedAt).getTime() - new Date(b.lastStudiedAt).getTime()
          break
        case 'sessions':
          comparison = a.totalSessions - b.totalSessions
          break
      }
      return sortOrder === 'asc' ? comparison : -comparison
    })

    return filtered
  }, [havrutot, searchTerm, filterStatus, sortBy, sortOrder])

  const handleCreateHavruta = async () => {
    try {
      await createHavruta()
      setSnackbar({
        open: true,
        message: 'Havruta creation dialog would open here',
        severity: 'info'
      })
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Failed to create Havruta',
        severity: 'error'
      })
    }
  }

  const handleJoinHavruta = async (havrutaId: string) => {
    try {
      const havruta = havrutot.find(h => h.id === havrutaId)
      if (havruta) {
        // For now, skip backend session join and go directly to TextViewer
        // TODO: Implement proper session management later
        
        // Navigate to TextViewer with collaborative mode enabled
        const params = new URLSearchParams({
          sessionId: `session-${havrutaId}`,
          collaborative: 'true',
          ref: havruta.currentSection
        })
        const url = `/study/${encodeURIComponent(havruta.bookTitle)}?${params.toString()}`
        console.log('Navigating to:', url)
        navigate(url)
        
        setSnackbar({
          open: true,
          message: 'Successfully joined Havruta session!',
          severity: 'success'
        })
      }
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Failed to join Havruta session',
        severity: 'error'
      })
    }
  }

  const handleScheduleSession = async (havrutaId: string) => {
    try {
      await scheduleSession(havrutaId)
      setSnackbar({
        open: true,
        message: 'Session scheduled successfully!',
        severity: 'success'
      })
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Failed to schedule session',
        severity: 'error'
      })
    }
  }

  const handleInviteParticipant = (havrutaId: string) => {
    console.log(`Invite participant to havruta ${havrutaId}`)
    // TODO: Implement invite participant functionality
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
                    Continue from {nextSession.currentSection}
                  </Typography>
                </Box>
                <Button
                  variant="contained"
                  size="large"
                  startIcon={<PlayArrow />}
                  onClick={() => handleJoinHavruta(nextSession.id)}
                  sx={{ minWidth: isMobile ? '100%' : 'auto' }}
                >
                  Join Session
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* All Havrutot */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <MenuBook color="primary" />
          My Havrutot ({filteredAndSortedHavrutot.length})
        </Typography>
      </Box>

      {/* Search and Filter Controls */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={4}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search Havrutot..."
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
                <MenuItem value="name">Name</MenuItem>
                <MenuItem value="lastStudied">Last Studied</MenuItem>
                <MenuItem value="sessions">Sessions</MenuItem>
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
      
      {filteredAndSortedHavrutot.length > 0 ? (
        <Grid container spacing={3}>
          {filteredAndSortedHavrutot.map((havruta) => (
            <Grid item xs={12} sm={6} lg={4} key={havruta.id}>
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
                      {havruta.name}
                    </Typography>
                    <Chip
                      label={havruta.isActive ? 'Active' : 'Inactive'}
                      color={havruta.isActive ? 'success' : 'default'}
                      size="small"
                    />
                  </Box>
                  
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <MenuBook fontSize="small" color="action" />
                    <Typography color="text.secondary">
                      {havruta.bookTitle}
                    </Typography>
                  </Box>
                  
                  <Typography variant="body2" sx={{ mb: 2 }}>
                    Current: {havruta.currentSection}
                  </Typography>
                  
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Group fontSize="small" color="action" />
                    <Typography variant="body2" color="text.secondary">
                      {havruta.participants.length} participants • {havruta.totalSessions} sessions
                    </Typography>
                  </Box>
                  
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    Last studied: {new Date(havruta.lastStudiedAt).toLocaleDateString()}
                  </Typography>
                </CardContent>
                
                <CardContent sx={{ pt: 0 }}>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<PlayArrow />}
                      onClick={() => handleJoinHavruta(havruta.id)}
                      sx={{ flex: 1, minWidth: 'fit-content' }}
                    >
                      Join Collaborative
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<MenuBook />}
                      onClick={() => {
                        // Navigate to TextViewer in solo mode
                        const params = new URLSearchParams({
                          ref: havruta.currentSection
                        })
                        navigate(`/study/${havruta.bookTitle}?${params.toString()}`)
                      }}
                      sx={{ flex: 1, minWidth: 'fit-content' }}
                    >
                      Study Solo
                    </Button>
                    <IconButton
                      size="small"
                      onClick={() => handleInviteParticipant(havruta.id)}
                      title="Invite participant"
                    >
                      <PersonAdd />
                    </IconButton>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      ) : (
        <Paper sx={{ textAlign: 'center', py: 8, px: 4 }}>
          <MenuBook sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            {havrutot.length === 0 ? 'No Havrutot yet' : 'No Havrutot match your filters'}
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 3, maxWidth: 400, mx: 'auto' }}>
            {havrutot.length === 0 
              ? 'Create your first Havruta to start studying Jewish texts with partners in real-time collaborative sessions'
              : 'Try adjusting your search or filter criteria to find your Havrutot'
            }
          </Typography>
          {havrutot.length === 0 ? (
            <Button
              variant="contained"
              size="large"
              startIcon={<Add />}
              onClick={handleCreateHavruta}
            >
              Create Your First Havruta
            </Button>
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