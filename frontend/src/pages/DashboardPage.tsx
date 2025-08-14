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

const DashboardPage: React.FC = () => {
  const { state: authState } = useAuth()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [isLoading, setIsLoading] = React.useState(false)
  const [searchTerm, setSearchTerm] = React.useState('')
  const [filterStatus, setFilterStatus] = React.useState<'all' | 'active' | 'inactive'>('all')
  const [sortBy, setSortBy] = React.useState<'name' | 'lastStudied' | 'sessions'>('lastStudied')
  const [sortOrder, setSortOrder] = React.useState<'asc' | 'desc'>('desc')

  // Mock data for development
  const mockHavrutot = [
    {
      id: '1',
      name: 'Genesis Study Group',
      bookTitle: 'Genesis',
      bookId: 'genesis',
      creatorId: authState.user?.id || '',
      participants: ['user1', 'user2'],
      currentSection: 'Genesis 1:1',
      isActive: true,
      createdAt: new Date(),
      lastStudiedAt: new Date(),
      totalSessions: 5,
    },
    {
      id: '2',
      name: 'Talmud Bavli',
      bookTitle: 'Berakhot',
      bookId: 'berakhot',
      creatorId: authState.user?.id || '',
      participants: ['user1', 'user3'],
      currentSection: 'Berakhot 2a',
      isActive: false,
      createdAt: new Date(),
      lastStudiedAt: new Date(Date.now() - 86400000), // Yesterday
      totalSessions: 12,
    },
    {
      id: '3',
      name: 'Mishnah Study Circle',
      bookTitle: 'Pirkei Avot',
      bookId: 'pirkei-avot',
      creatorId: 'user2',
      participants: ['user1', 'user2', 'user4'],
      currentSection: 'Avot 1:1',
      isActive: true,
      createdAt: new Date(Date.now() - 7 * 86400000), // 1 week ago
      lastStudiedAt: new Date(Date.now() - 2 * 86400000), // 2 days ago
      totalSessions: 8,
    },
  ]

  const mockNextSession = {
    id: '1',
    name: 'Genesis Study Group',
    scheduledTime: new Date(Date.now() + 3600000), // 1 hour from now
    currentSection: 'Genesis 1:1',
  }

  // Filter and sort Havrutot
  const filteredAndSortedHavrutot = React.useMemo(() => {
    let filtered = mockHavrutot.filter(havruta => {
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
          comparison = a.lastStudiedAt.getTime() - b.lastStudiedAt.getTime()
          break
        case 'sessions':
          comparison = a.totalSessions - b.totalSessions
          break
      }
      return sortOrder === 'asc' ? comparison : -comparison
    })

    return filtered
  }, [mockHavrutot, searchTerm, filterStatus, sortBy, sortOrder])

  const handleCreateHavruta = () => {
    console.log('Create new Havruta')
    // TODO: Implement create havruta functionality
  }

  const handleJoinHavruta = (havrutaId: string) => {
    console.log(`Join havruta ${havrutaId}`)
    // TODO: Implement join havruta functionality
  }

  const handleScheduleSession = (havrutaId: string) => {
    console.log(`Schedule havruta ${havrutaId}`)
    // TODO: Implement schedule session functionality
  }

  const handleInviteParticipant = (havrutaId: string) => {
    console.log(`Invite participant to havruta ${havrutaId}`)
    // TODO: Implement invite participant functionality
  }

  const toggleSortOrder = () => {
    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')
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

      {/* Quick Stats */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h4" color="primary" gutterBottom>
              {mockHavrutot.length}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Total Havrutot
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h4" color="primary" gutterBottom>
              {mockHavrutot.reduce((sum, h) => sum + h.totalSessions, 0)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Total Sessions
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h4" color="primary" gutterBottom>
              {mockHavrutot.filter(h => h.isActive).length}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Active Sessions
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h4" color="primary" gutterBottom>
              {new Set(mockHavrutot.flatMap(h => h.participants)).size}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Study Partners
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Next Up Section */}
      {mockNextSession && (
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
                    {mockNextSession.name}
                  </Typography>
                  <Typography color="text.secondary" gutterBottom>
                    Scheduled for {mockNextSession.scheduledTime.toLocaleString()}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Continue from {mockNextSession.currentSection}
                  </Typography>
                </Box>
                <Button
                  variant="contained"
                  size="large"
                  startIcon={<PlayArrow />}
                  onClick={() => handleJoinHavruta(mockNextSession.id)}
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
                    Last studied: {havruta.lastStudiedAt.toLocaleDateString()}
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
                      Join
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<Schedule />}
                      onClick={() => handleScheduleSession(havruta.id)}
                      sx={{ flex: 1, minWidth: 'fit-content' }}
                    >
                      Schedule
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
            {mockHavrutot.length === 0 ? 'No Havrutot yet' : 'No Havrutot match your filters'}
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 3, maxWidth: 400, mx: 'auto' }}>
            {mockHavrutot.length === 0 
              ? 'Create your first Havruta to start studying Jewish texts with partners in real-time collaborative sessions'
              : 'Try adjusting your search or filter criteria to find your Havrutot'
            }
          </Typography>
          {mockHavrutot.length === 0 ? (
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
    </Box>
  )
}

export default DashboardPage