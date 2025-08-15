import React, { useEffect, useState, useRef } from 'react'
import { 
  Box, 
  Paper, 
  IconButton, 
  Typography, 
  Tooltip,
  Alert,
  Collapse
} from '@mui/material'
import { 
  Videocam, 
  VideocamOff, 
  Mic, 
  MicOff, 
  CallEnd,
  ExpandMore,
  ExpandLess,
  SignalWifi4Bar,
  SignalWifi3Bar,
  SignalWifi2Bar,
  SignalWifi1Bar,
  SignalWifiOff,
  VolumeUp
} from '@mui/icons-material'
import { webrtcService, VideoCallState, WebRTCCallbacks, ConnectionQuality } from '../../services/webrtcService'

interface VideoCallProps {
  sessionId: string
  userId: string
  onCallEnd?: () => void
  minimized?: boolean
  onToggleMinimize?: () => void
  audioOnlyMode?: boolean
}

const VideoCall: React.FC<VideoCallProps> = ({ 
  sessionId, 
  userId, 
  onCallEnd,
  minimized = false,
  onToggleMinimize,
  audioOnlyMode = false
}) => {
  const [callState, setCallState] = useState<VideoCallState>(webrtcService.getState())
  const [error, setError] = useState<string | null>(null)
  const [isInitializing, setIsInitializing] = useState(true)
  
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map())

  useEffect(() => {
    const callbacks: WebRTCCallbacks = {
      onStateChange: (state) => {
        setCallState(state)
        updateVideoStreams(state)
      },
      onError: (errorMessage) => {
        setError(errorMessage)
        setIsInitializing(false)
      },
      onParticipantJoined: (participantId) => {
        console.log('Participant joined:', participantId)
      },
      onParticipantLeft: (participantId) => {
        console.log('Participant left:', participantId)
        // Clean up video ref
        remoteVideoRefs.current.delete(participantId)
      },
      onConnectionQualityChanged: (participantId, quality) => {
        console.log('Connection quality changed:', participantId, quality)
      }
    }

    webrtcService.setCallbacks(callbacks)

    // Initialize the call
    const initializeCall = async () => {
      try {
        await webrtcService.initializeCall(sessionId, userId, audioOnlyMode)
        setIsInitializing(false)
      } catch (error) {
        setIsInitializing(false)
        console.error('Failed to initialize call:', error)
      }
    }

    initializeCall()

    // Cleanup on unmount
    return () => {
      webrtcService.leaveCall()
    }
  }, [sessionId, userId])

  const updateVideoStreams = (state: VideoCallState) => {
    // Update local video
    if (localVideoRef.current && state.localStream) {
      localVideoRef.current.srcObject = state.localStream
    }

    // Update remote videos
    state.remoteStreams.forEach((stream, participantId) => {
      const videoElement = remoteVideoRefs.current.get(participantId)
      if (videoElement) {
        videoElement.srcObject = stream
      }
    })
  }

  const handleToggleVideo = () => {
    webrtcService.toggleVideo()
  }

  const handleToggleAudio = () => {
    webrtcService.toggleAudio()
  }

  const handleEndCall = () => {
    webrtcService.leaveCall()
    onCallEnd?.()
  }

  const handleSwitchToAudioOnly = async () => {
    try {
      await webrtcService.switchToAudioOnly()
    } catch (error) {
      console.error('Failed to switch to audio-only:', error)
    }
  }

  const getQualityIcon = (quality: ConnectionQuality['quality']) => {
    switch (quality) {
      case 'excellent':
        return <SignalWifi4Bar sx={{ color: 'success.main', fontSize: 16 }} />
      case 'good':
        return <SignalWifi3Bar sx={{ color: 'warning.main', fontSize: 16 }} />
      case 'poor':
        return <SignalWifi2Bar sx={{ color: 'error.main', fontSize: 16 }} />
      case 'disconnected':
        return <SignalWifiOff sx={{ color: 'error.main', fontSize: 16 }} />
      default:
        return <SignalWifi1Bar sx={{ color: 'grey.500', fontSize: 16 }} />
    }
  }

  const createRemoteVideoRef = (participantId: string) => (ref: HTMLVideoElement | null) => {
    if (ref) {
      remoteVideoRefs.current.set(participantId, ref)
      const stream = callState.remoteStreams.get(participantId)
      if (stream) {
        ref.srcObject = stream
      }
    } else {
      remoteVideoRefs.current.delete(participantId)
    }
  }

  if (isInitializing) {
    return (
      <Paper 
        elevation={3} 
        sx={{ 
          p: 2, 
          position: 'fixed', 
          top: 16, 
          right: 16, 
          zIndex: 1000,
          minWidth: 200
        }}
      >
        <Typography variant="body2">Initializing video call...</Typography>
      </Paper>
    )
  }

  return (
    <Paper 
      elevation={3} 
      sx={{ 
        position: 'fixed', 
        top: 16, 
        right: 16, 
        zIndex: 1000,
        width: minimized ? 200 : 400,
        maxHeight: minimized ? 60 : 600,
        overflow: 'hidden',
        transition: 'all 0.3s ease'
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
          Video Call ({callState.remoteStreams.size + 1} participants)
        </Typography>
        {onToggleMinimize && (
          <IconButton 
            size="small" 
            onClick={onToggleMinimize}
            sx={{ color: 'inherit' }}
          >
            {minimized ? <ExpandMore /> : <ExpandLess />}
          </IconButton>
        )}
      </Box>

      <Collapse in={!minimized}>
        <Box sx={{ p: 2 }}>
          {/* Error Alert */}
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {/* Video Grid */}
          <Box sx={{ mb: 2 }}>
            {/* Local Video */}
            <Box sx={{ position: 'relative', mb: 1 }}>
              {callState.isAudioOnlyMode ? (
                <Box
                  sx={{
                    width: '100%',
                    height: '120px',
                    bgcolor: 'grey.800',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'column'
                  }}
                >
                  <VolumeUp sx={{ color: 'white', fontSize: 32, mb: 1 }} />
                  <Typography variant="caption" sx={{ color: 'white' }}>
                    Audio Only
                  </Typography>
                </Box>
              ) : (
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  style={{
                    width: '100%',
                    height: '120px',
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
              
              {!callState.isVideoEnabled && !callState.isAudioOnlyMode && (
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
                  <VideocamOff sx={{ color: 'white', fontSize: 32 }} />
                </Box>
              )}

              {/* Connection status indicator */}
              {callState.reconnecting && (
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
            {Array.from(callState.remoteStreams.keys()).map((participantId) => {
              const quality = callState.connectionQuality?.get(participantId)
              return (
                <Box key={participantId} sx={{ position: 'relative', mb: 1 }}>
                  <video
                    ref={createRemoteVideoRef(participantId)}
                    autoPlay
                    playsInline
                    style={{
                      width: '100%',
                      height: '120px',
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
                      {getQualityIcon(quality.quality)}
                    </Box>
                  )}
                </Box>
              )
            })}
          </Box>

          {/* Controls */}
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Tooltip title={
              callState.isAudioOnlyMode 
                ? 'Video not available in audio-only mode' 
                : callState.isVideoEnabled 
                  ? 'Turn off camera' 
                  : 'Turn on camera'
            }>
              <span>
                <IconButton
                  onClick={handleToggleVideo}
                  color={callState.isVideoEnabled ? 'primary' : 'error'}
                  size="small"
                  disabled={callState.isAudioOnlyMode}
                >
                  {callState.isVideoEnabled ? <Videocam /> : <VideocamOff />}
                </IconButton>
              </span>
            </Tooltip>

            <Tooltip title={callState.isAudioEnabled ? 'Mute microphone' : 'Unmute microphone'}>
              <IconButton
                onClick={handleToggleAudio}
                color={callState.isAudioEnabled ? 'primary' : 'error'}
                size="small"
              >
                {callState.isAudioEnabled ? <Mic /> : <MicOff />}
              </IconButton>
            </Tooltip>

            {!callState.isAudioOnlyMode && (
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
      </Collapse>
    </Paper>
  )
}

export default VideoCall