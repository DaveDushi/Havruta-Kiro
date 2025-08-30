import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Box,
  Paper,
  Typography,
  CircularProgress,
  Alert,
  Divider,
  useTheme,
  useMediaQuery,
  Snackbar,
  IconButton,
  Tooltip,
  Button
} from '@mui/material'
import { 
  Videocam, 
  VideocamOff, 
  Mic, 
  MicOff, 
  CallEnd,
  VolumeUp,
  ExpandMore,
  ExpandLess
} from '@mui/icons-material'
import { SefariaText, TextSection, TextNavigation, SearchHighlight, NavigationEvent } from '../../types'
import { sefariaService } from '../../services/sefariaService'
import { socketService } from '../../services/socketService'
import { useCollaborativeNavigation } from '../../contexts/CollaborativeNavigationContext'
import { webrtcService, VideoCallState, WebRTCCallbacks } from '../../services/webrtcService'
import { authService } from '../../services/authService'
import TextNavigationControls from './TextNavigationControls'
import TextSearchBar from './TextSearchBar'
import TextContent from './TextContent'
import ParticipantIndicators from './ParticipantIndicators'
import NavigationConflictDialog from './NavigationConflictDialog'

interface TextViewerProps {
  bookTitle: string
  initialRef?: string
  sessionId?: string
  userId?: string
  onNavigationChange?: (ref: string) => void
  onSectionChange?: (section: TextSection) => void
  searchQuery?: string
  highlights?: SearchHighlight[]
  isReadOnly?: boolean
  isCollaborative?: boolean
  className?: string
}

const TextViewer: React.FC<TextViewerProps> = ({
  bookTitle,
  initialRef,
  sessionId,
  userId,
  onNavigationChange,
  onSectionChange,
  searchQuery: externalSearchQuery,
  highlights: externalHighlights,
  isReadOnly = false,
  isCollaborative = false,
  className
}) => {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const collaborative = useCollaborativeNavigation()
  
  const [currentText, setCurrentText] = useState<SefariaText | null>(null)
  const [currentSection, setCurrentSection] = useState<TextSection | null>(null)
  const [navigation, setNavigation] = useState<TextNavigation | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchHighlight[]>([])
  const [currentRef, setCurrentRef] = useState(initialRef || '')
  const [navigationNotification, setNavigationNotification] = useState<string | null>(null)
  const [isNavigatingFromSync, setIsNavigatingFromSync] = useState(false)
  
  // Video call state
  const [videoCallState, setVideoCallState] = useState<VideoCallState>(webrtcService.getState())
  const [videoCallError, setVideoCallError] = useState<string | null>(null)
  const [isVideoCallInitializing, setIsVideoCallInitializing] = useState(false)
  const [isVideoCallMinimized, setIsVideoCallMinimized] = useState(false)
  const [showVideoCall, setShowVideoCall] = useState(false)
  // Removed isAuthReady - using userId prop directly

  // Memoized highlights combining external and search highlights
  const allHighlights = useMemo(() => {
    const highlights: SearchHighlight[] = []
    
    if (externalHighlights) {
      highlights.push(...externalHighlights)
    }
    
    if (searchResults) {
      highlights.push(...searchResults)
    }
    
    return highlights
  }, [externalHighlights, searchResults])

  // Load text content
  const loadText = useCallback(async (ref: string) => {
    if (!ref) return

    setLoading(true)
    setError(null)

    try {
      const text = await sefariaService.getText(ref)
      console.log('Loaded text data:', text)
      console.log('Text array:', text.text)
      console.log('Hebrew array:', text.he)
      setCurrentText(text)
      
      // Create text section from the loaded text
      const section: TextSection = {
        ref: text.ref,
        heRef: text.heRef,
        text: text.text,
        he: text.he,
        sectionIndex: 0, // This would be calculated based on the text structure
        chapterIndex: sefariaService.parseRef(text.ref).chapter,
        verseIndex: sefariaService.parseRef(text.ref).verse
      }
      
      setCurrentSection(section)
      onSectionChange?.(section)
      
      // Update navigation state using API response data
      updateNavigationFromText(text)
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load text'
      setError(errorMessage)
      console.error('Error loading text:', err)
    } finally {
      setLoading(false)
    }
  }, [onSectionChange])

  // Update navigation state from API response
  const updateNavigationFromText = useCallback((text: SefariaText) => {
    try {
      const nav: TextNavigation = {
        currentRef: text.ref,
        availableSections: [], // Could be populated from text structure if needed
        hasNext: !!text.next,
        hasPrevious: !!text.prev,
        nextRef: text.next || undefined,
        previousRef: text.prev || undefined
      }
      
      setNavigation(nav)
    } catch (err) {
      console.error('Error updating navigation:', err)
    }
  }, [])

  // Handle navigation
  const handleNavigation = useCallback((newRef: string, fromSync = false) => {
    setCurrentRef(newRef)
    onNavigationChange?.(newRef)
    loadText(newRef)
    
    // Broadcast navigation to other participants if collaborative and not from sync
    if (isCollaborative && !fromSync && !isNavigatingFromSync) {
      collaborative.broadcastNavigation(newRef)
    }
  }, [loadText, onNavigationChange, isCollaborative, isNavigatingFromSync])

  // Handle search
  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query)
    
    if (!query.trim() || !currentText) {
      setSearchResults([])
      return
    }

    try {
      // Search within current text content
      const highlights: SearchHighlight[] = []
      const searchTerm = query.toLowerCase()
      
      // Search in English text
      currentText.text.forEach((textLine, lineIndex) => {
        const lowerText = textLine.toLowerCase()
        let startIndex = 0
        
        while (true) {
          const foundIndex = lowerText.indexOf(searchTerm, startIndex)
          if (foundIndex === -1) break
          
          highlights.push({
            text: query,
            startIndex: foundIndex,
            endIndex: foundIndex + query.length,
            ref: `${currentText.ref}:${lineIndex + 1}`
          })
          
          startIndex = foundIndex + 1
        }
      })
      
      // Search in Hebrew text
      currentText.he.forEach((textLine, lineIndex) => {
        const foundIndex = textLine.indexOf(query)
        if (foundIndex !== -1) {
          highlights.push({
            text: query,
            startIndex: foundIndex,
            endIndex: foundIndex + query.length,
            ref: `${currentText.ref}:${lineIndex + 1}`
          })
        }
      })
      
      setSearchResults(highlights)
    } catch (err) {
      console.error('Search error:', err)
    }
  }, [currentText])

  // Handle section jumping
  const handleJumpToSection = useCallback((sectionRef: string) => {
    handleNavigation(sectionRef)
  }, [handleNavigation])

  // Handle collaborative navigation events
  const handleCollaborativeNavigation = useCallback((event: NavigationEvent) => {
    // Don't sync to our own navigation events
    if (event.userId !== userId) {
      setNavigationNotification(`${event.userName} navigated to ${event.newRef}`)
      setIsNavigatingFromSync(true)
      handleNavigation(event.newRef, true)
      setIsNavigatingFromSync(false)
    }
  }, [handleNavigation, userId])

  // Handle conflict resolution
  const handleConflictResolution = useCallback((chosenRef: string) => {
    collaborative.resolveConflict(chosenRef)
    setIsNavigatingFromSync(true)
    handleNavigation(chosenRef, true)
    setIsNavigatingFromSync(false)
  }, [collaborative, handleNavigation])

  // Handle participant navigation (when clicking on participant indicator)
  const handleParticipantNavigation = useCallback((ref: string) => {
    setIsNavigatingFromSync(true)
    handleNavigation(ref, true)
    setIsNavigatingFromSync(false)
  }, [handleNavigation])

  // Video call handlers
  const initializeVideoCall = useCallback(async () => {
    if (!isCollaborative || !sessionId || !userId) {
      console.log('❌ Video call not initialized - missing requirements:', { 
        isCollaborative, 
        sessionId, 
        userId
      })
      return
    }

    // Wait for socket connection
    if (!socketService.isConnected()) {
      console.log('⏳ Waiting for socket connection before initializing video call...')
      setTimeout(() => initializeVideoCall(), 1000)
      return
    }

    console.log('🎥 Initializing video call for session:', sessionId, 'user:', userId)
    setIsVideoCallInitializing(true)
    setVideoCallError(null)

    try {
      const callbacks: WebRTCCallbacks = {
        onStateChange: (state) => {
          console.log('Video call state changed:', state)
          setVideoCallState(state)
        },
        onError: (error) => {
          console.error('Video call error:', error)
          setVideoCallError(error)
          setIsVideoCallInitializing(false)
        },
        onParticipantJoined: (participantId) => {
          console.log('Video call participant joined:', participantId)
        },
        onParticipantLeft: (participantId) => {
          console.log('Video call participant left:', participantId)
        },
        onConnectionQualityChanged: (participantId, quality) => {
          console.log('Connection quality changed:', participantId, quality)
        }
      }

      webrtcService.setCallbacks(callbacks)
      await webrtcService.initializeCall(sessionId, userId)
      setShowVideoCall(true)
      setIsVideoCallInitializing(false)
      console.log('Video call initialized successfully')
    } catch (error) {
      console.error('Failed to initialize video call:', error)
      setVideoCallError(error instanceof Error ? error.message : 'Failed to initialize video call')
      setIsVideoCallInitializing(false)
    }
  }, [isCollaborative, sessionId, userId])

  const handleToggleVideo = useCallback(() => {
    webrtcService.toggleVideo()
  }, [])

  const handleToggleAudio = useCallback(() => {
    webrtcService.toggleAudio()
  }, [])

  const handleSwitchToAudioOnly = useCallback(async () => {
    try {
      await webrtcService.switchToAudioOnly()
    } catch (error) {
      console.error('Failed to switch to audio-only:', error)
    }
  }, [])

  const handleEndCall = useCallback(() => {
    webrtcService.leaveCall()
    setShowVideoCall(false)
  }, [])

  // Suppress unused variable warning
  void handleParticipantNavigation

  // Removed auth ready checking - using userId prop directly

  // Initialize with initial ref
  useEffect(() => {
    if (initialRef) {
      setCurrentRef(initialRef)
      loadText(initialRef)
    } else if (bookTitle) {
      // Load first section of the book
      const firstRef = `${bookTitle} 1`
      setCurrentRef(firstRef)
      loadText(firstRef)
    }
  }, [initialRef, bookTitle, loadText])

  // Handle external search query changes
  useEffect(() => {
    if (externalSearchQuery !== undefined) {
      handleSearch(externalSearchQuery)
    }
  }, [externalSearchQuery, handleSearch])

  // Connect to collaborative session
  useEffect(() => {
    if (isCollaborative && sessionId && userId) {
      console.log('🚀 Connecting to collaborative session:', { sessionId, userId })
      
      const connectToSession = async () => {
        try {
          await collaborative.connectToSession(sessionId)
          console.log('✅ Successfully connected to collaborative session')
        } catch (error) {
          console.error('❌ Failed to connect to collaborative session:', error)
        }
      }
      
      connectToSession()
      
      return () => {
        console.log('🔌 Disconnecting from collaborative session')
        collaborative.disconnectFromSession()
        webrtcService.leaveCall()
      }
    } else {
      console.log('⏳ Waiting for collaborative session requirements:', { 
        isCollaborative, 
        sessionId, 
        userId,
        hasAll: !!(isCollaborative && sessionId && userId)
      })
    }
  }, [isCollaborative, sessionId, userId])

  // Set up collaborative navigation listener
  useEffect(() => {
    if (isCollaborative) {
      collaborative.onNavigationUpdate(handleCollaborativeNavigation)
      
      return () => {
        collaborative.offNavigationUpdate(handleCollaborativeNavigation)
      }
    }
  }, [isCollaborative, handleCollaborativeNavigation])

  if (loading && !currentText) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
        <CircularProgress />
      </Box>
    )
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {error}
      </Alert>
    )
  }

  // Video call panel component
  const VideoCallPanel = () => {
    if (!isCollaborative) return null
    
    // Show "Join Call" button for collaborative sessions when video call is not active
    if (!showVideoCall && !isVideoCallInitializing && isCollaborative) {
      return (
        <Paper 
          elevation={2} 
          sx={{ 
            position: 'absolute',
            top: 16,
            right: 16,
            p: 2,
            zIndex: 10,
            bgcolor: 'background.paper'
          }}
        >
          <Button
            variant="contained"
            color="primary"
            onClick={initializeVideoCall}
            startIcon={<Videocam />}
            disabled={isVideoCallInitializing}
          >
            Join Call
          </Button>
        </Paper>
      )
    }
    
    // Show panel if video call is active OR initializing
    if (!showVideoCall && !isVideoCallInitializing) return null

    return (
      <Paper 
        elevation={2} 
        sx={{ 
          position: 'absolute',
          top: 16,
          right: 16,
          width: isVideoCallMinimized ? 200 : 320,
          maxHeight: isVideoCallMinimized ? 60 : 400,
          overflow: 'hidden',
          transition: 'all 0.3s ease',
          zIndex: 10,
          bgcolor: 'background.paper'
        }}
      >
        {/* Header */}
        <Box 
          sx={{ 
            p: 1, 
            bgcolor: 'primary.main', 
            color: 'primary.contrastText',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <Typography variant="subtitle2">
            Video Call ({videoCallState.remoteStreams.size + 1})
          </Typography>
          <IconButton 
            size="small" 
            onClick={() => setIsVideoCallMinimized(!isVideoCallMinimized)}
            sx={{ color: 'inherit' }}
          >
            {isVideoCallMinimized ? <ExpandMore /> : <ExpandLess />}
          </IconButton>
        </Box>

        {!isVideoCallMinimized && (
          <Box sx={{ p: 2 }}>
            {/* Error Alert */}
            {videoCallError && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setVideoCallError(null)}>
                {videoCallError}
              </Alert>
            )}

            {/* Initializing state */}
            {isVideoCallInitializing && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <CircularProgress size={16} />
                <Typography variant="body2">Initializing video call...</Typography>
              </Box>
            )}

            {/* Video Grid */}
            <Box sx={{ mb: 2 }}>
              {/* Local Video */}
              <Box sx={{ position: 'relative', mb: 1 }}>
                {videoCallState.isAudioOnlyMode ? (
                  <Box
                    sx={{
                      width: '100%',
                      height: '80px',
                      bgcolor: 'grey.800',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexDirection: 'column'
                    }}
                  >
                    <VolumeUp sx={{ color: 'white', fontSize: 24, mb: 0.5 }} />
                    <Typography variant="caption" sx={{ color: 'white' }}>
                      Audio Only
                    </Typography>
                  </Box>
                ) : (
                  <video
                    ref={(ref) => {
                      if (ref && videoCallState.localStream) {
                        ref.srcObject = videoCallState.localStream
                      }
                    }}
                    autoPlay
                    muted
                    playsInline
                    style={{
                      width: '100%',
                      height: '80px',
                      objectFit: 'cover',
                      borderRadius: '8px',
                      backgroundColor: '#000'
                    }}
                  />
                )}
                
                <Typography
                  variant="caption"
                  sx={{
                    position: 'absolute',
                    bottom: 4,
                    left: 4,
                    color: 'white',
                    bgcolor: 'rgba(0,0,0,0.6)',
                    px: 1,
                    borderRadius: 1
                  }}
                >
                  You
                </Typography>
                
                {!videoCallState.isVideoEnabled && !videoCallState.isAudioOnlyMode && (
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      bgcolor: 'rgba(0,0,0,0.8)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '8px'
                    }}
                  >
                    <VideocamOff sx={{ color: 'white', fontSize: 24 }} />
                  </Box>
                )}

                {/* Connection status indicator */}
                {videoCallState.reconnecting && (
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 4,
                      right: 4,
                      bgcolor: 'warning.main',
                      color: 'white',
                      px: 1,
                      py: 0.5,
                      borderRadius: 1,
                      fontSize: '0.75rem'
                    }}
                  >
                    Reconnecting...
                  </Box>
                )}
              </Box>

              {/* Remote Videos */}
              {Array.from(videoCallState.remoteStreams.keys()).map((participantId) => {
                const quality = videoCallState.connectionQuality?.get(participantId)
                return (
                  <Box key={participantId} sx={{ position: 'relative', mb: 1 }}>
                    <video
                      ref={(ref) => {
                        if (ref) {
                          const stream = videoCallState.remoteStreams.get(participantId)
                          if (stream) {
                            ref.srcObject = stream
                          }
                        }
                      }}
                      autoPlay
                      playsInline
                      style={{
                        width: '100%',
                        height: '80px',
                        objectFit: 'cover',
                        borderRadius: '8px',
                        backgroundColor: '#000'
                      }}
                    />
                    <Typography
                      variant="caption"
                      sx={{
                        position: 'absolute',
                        bottom: 4,
                        left: 4,
                        color: 'white',
                        bgcolor: 'rgba(0,0,0,0.6)',
                        px: 1,
                        borderRadius: 1
                      }}
                    >
                      Participant {participantId.slice(-4)}
                    </Typography>
                    
                    {/* Connection quality indicator */}
                    {quality && (
                      <Box
                        sx={{
                          position: 'absolute',
                          top: 4,
                          right: 4,
                          bgcolor: 'rgba(0,0,0,0.6)',
                          borderRadius: 1,
                          p: 0.5,
                          display: 'flex',
                          alignItems: 'center'
                        }}
                      >
                        {/* Quality icon would go here */}
                      </Box>
                    )}
                  </Box>
                )
              })}
            </Box>

            {/* Controls */}
            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Tooltip title={
                videoCallState.isAudioOnlyMode 
                  ? 'Video not available in audio-only mode' 
                  : videoCallState.isVideoEnabled 
                    ? 'Turn off camera' 
                    : 'Turn on camera'
              }>
                <span>
                  <IconButton
                    onClick={handleToggleVideo}
                    color={videoCallState.isVideoEnabled ? 'primary' : 'error'}
                    size="small"
                    disabled={videoCallState.isAudioOnlyMode}
                  >
                    {videoCallState.isVideoEnabled ? <Videocam /> : <VideocamOff />}
                  </IconButton>
                </span>
              </Tooltip>

              <Tooltip title={videoCallState.isAudioEnabled ? 'Mute microphone' : 'Unmute microphone'}>
                <IconButton
                  onClick={handleToggleAudio}
                  color={videoCallState.isAudioEnabled ? 'primary' : 'error'}
                  size="small"
                >
                  {videoCallState.isAudioEnabled ? <Mic /> : <MicOff />}
                </IconButton>
              </Tooltip>

              {!videoCallState.isAudioOnlyMode && (
                <Tooltip title="Switch to audio-only mode">
                  <IconButton
                    onClick={handleSwitchToAudioOnly}
                    color="default"
                    size="small"
                  >
                    <VolumeUp />
                  </IconButton>
                </Tooltip>
              )}

              <Tooltip title="End call">
                <IconButton
                  onClick={handleEndCall}
                  color="error"
                  size="small"
                >
                  <CallEnd />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        )}
      </Paper>
    )
  }

  return (
    <Paper 
      elevation={1} 
      className={className}
      sx={{ 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      {/* Header with book title and search */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h6" gutterBottom>
          {bookTitle}
        </Typography>
        
        {!isReadOnly && (
          <TextSearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            onSearch={handleSearch}
            resultsCount={searchResults.length}
            disabled={loading}
          />
        )}
      </Box>

      {/* Navigation controls */}
      {navigation && !isReadOnly && (
        <>
          <TextNavigationControls
            navigation={navigation}
            onNavigate={handleNavigation}
            onJumpToSection={handleJumpToSection}
            disabled={loading}
          />
          <Divider />
        </>
      )}

      {/* Text content */}
      <Box sx={{ flex: 1, overflow: 'auto', position: 'relative' }}>
        {currentText && currentSection ? (
          <TextContent
            text={currentText}
            section={currentSection}
            highlights={allHighlights}
            searchQuery={searchQuery}
            loading={loading}
            isMobile={isMobile}
          />
        ) : (
          <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
            <Typography variant="body2" color="text.secondary">
              No text loaded
            </Typography>
          </Box>
        )}

        {/* Participant indicators for collaborative sessions */}
        {isCollaborative && collaborative.state.isConnected && (
          <ParticipantIndicators
            participants={collaborative.state.participants}
            currentRef={currentRef}
            currentUserId={collaborative.state.sessionId || undefined}
          />
        )}

        {/* Video Call Panel */}
        <VideoCallPanel />

        {/* Debug Panel - Remove this in production */}
        {isCollaborative && (
          <Paper 
            elevation={1} 
            sx={{ 
              position: 'absolute',
              bottom: 16,
              left: 16,
              p: 2,
              bgcolor: 'rgba(0,0,0,0.8)',
              color: 'white',
              fontSize: '0.75rem',
              maxWidth: 300,
              zIndex: 5
            }}
          >
            <Typography variant="caption" sx={{ color: 'white', display: 'block' }}>
              Debug Info:
            </Typography>
            <Typography variant="caption" sx={{ color: 'white', display: 'block' }}>
              Collaborative: {isCollaborative ? 'Yes' : 'No'}
            </Typography>
            <Typography variant="caption" sx={{ color: 'white', display: 'block' }}>
              Session ID: {sessionId || 'None'}
            </Typography>
            <Typography variant="caption" sx={{ color: 'white', display: 'block' }}>
              User ID: {userId || 'None'}
            </Typography>
            <Typography variant="caption" sx={{ color: 'white', display: 'block' }}>
              Auth Token: {authService.getToken() ? 'Yes' : 'No'}
            </Typography>
            <Typography variant="caption" sx={{ color: 'white', display: 'block' }}>
              Auth Status: {authService.isAuthenticated() ? 'Yes' : 'No'}
            </Typography>
            <Typography variant="caption" sx={{ color: 'white', display: 'block' }}>
              User ID Available: {userId ? 'Yes' : 'No'}
            </Typography>
            <Typography variant="caption" sx={{ color: 'white', display: 'block' }}>
              Socket Connected: {socketService.isConnected() ? 'Yes' : 'No'}
            </Typography>
            <Typography variant="caption" sx={{ color: 'white', display: 'block' }}>
              Collaborative Connected: {collaborative.state.isConnected ? 'Yes' : 'No'}
            </Typography>
            <Typography variant="caption" sx={{ color: 'white', display: 'block' }}>
              Video Call Initializing: {isVideoCallInitializing ? 'Yes' : 'No'}
            </Typography>
            <Typography variant="caption" sx={{ color: 'white', display: 'block' }}>
              Video Call Visible: {showVideoCall ? 'Yes' : 'No'}
            </Typography>
            <Typography variant="caption" sx={{ color: 'white', display: 'block' }}>
              Video Call Error: {videoCallError || 'None'}
            </Typography>
            <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <button 
                onClick={() => initializeVideoCall()} 
                style={{ 
                  fontSize: '10px', 
                  padding: '2px 4px',
                  backgroundColor: '#1976d2',
                  color: 'white',
                  border: 'none',
                  borderRadius: '2px',
                  cursor: 'pointer'
                }}
              >
                Test Video Call
              </button>
              <button 
                onClick={async () => {
                  const user = await authService.getCurrentUser()
                  console.log('Current user:', user)
                  console.log('Auth token:', authService.getToken())
                  console.log('Is authenticated:', authService.isAuthenticated())
                }} 
                style={{ 
                  fontSize: '10px', 
                  padding: '2px 4px',
                  backgroundColor: '#dc004e',
                  color: 'white',
                  border: 'none',
                  borderRadius: '2px',
                  cursor: 'pointer'
                }}
              >
                Check Auth
              </button>
              <button 
                onClick={async () => {
                  try {
                    const user = await authService.getCurrentUser()
                    if (user) {
                      console.log('Attempting socket connection with user:', user.name)
                      await socketService.connect(user)
                      console.log('Socket connection successful')
                    } else {
                      console.log('No user available for socket connection')
                    }
                  } catch (error) {
                    console.error('Socket connection failed:', error)
                  }
                }} 
                style={{ 
                  fontSize: '10px', 
                  padding: '2px 4px',
                  backgroundColor: '#4caf50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '2px',
                  cursor: 'pointer'
                }}
              >
                Test Socket
              </button>
            </Box>
          </Paper>
        )}
      </Box>

      {/* Navigation conflict dialog */}
      {isCollaborative && (
        <NavigationConflictDialog
          open={!!collaborative.state.currentConflict}
          conflict={collaborative.state.currentConflict}
          onResolve={handleConflictResolution}
          onCancel={() => {}}
        />
      )}

      {/* Navigation notification snackbar */}
      <Snackbar
        open={!!navigationNotification}
        autoHideDuration={3000}
        onClose={() => setNavigationNotification(null)}
        message={navigationNotification}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Paper>
  )
}

export default TextViewer