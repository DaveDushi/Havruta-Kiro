import { socketService } from './socketService'

export interface VideoCallState {
  isConnected: boolean
  isVideoEnabled: boolean
  isAudioEnabled: boolean
  isAudioOnlyMode: boolean
  participants: string[]
  localStream: MediaStream | null
  remoteStreams: Map<string, MediaStream>
  connectionQuality: Map<string, ConnectionQuality>
  reconnecting: boolean
}

export interface ConnectionQuality {
  participantId: string
  quality: 'excellent' | 'good' | 'poor' | 'disconnected'
  latency?: number
  packetLoss?: number
  lastUpdated: Date
}

export interface WebRTCCallbacks {
  onStateChange: (state: VideoCallState) => void
  onError: (error: string) => void
  onParticipantJoined: (participantId: string) => void
  onParticipantLeft: (participantId: string) => void
  onConnectionQualityChanged: (participantId: string, quality: ConnectionQuality) => void
}

class WebRTCService {
  private peerConnections: Map<string, RTCPeerConnection> = new Map()
  private localStream: MediaStream | null = null
  private callbacks: WebRTCCallbacks | null = null
  private sessionId: string | null = null
  private userId: string | null = null
  private state: VideoCallState = {
    isConnected: false,
    isVideoEnabled: true,
    isAudioEnabled: true,
    isAudioOnlyMode: false,
    participants: [],
    localStream: null,
    remoteStreams: new Map(),
    connectionQuality: new Map(),
    reconnecting: false
  }

  private reconnectAttempts: Map<string, number> = new Map()
  private maxReconnectAttempts = 3
  private qualityCheckInterval: NodeJS.Timeout | null = null

  private readonly iceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]

  setCallbacks(callbacks: WebRTCCallbacks) {
    this.callbacks = callbacks
  }

  async initializeCall(sessionId: string, userId: string, audioOnly: boolean = false): Promise<void> {
    try {
      this.sessionId = sessionId
      this.userId = userId
      this.state.isAudioOnlyMode = audioOnly

      // Get user media - try video first, fallback to audio-only
      try {
        this.localStream = await navigator.mediaDevices.getUserMedia({
          video: !audioOnly,
          audio: true
        })
      } catch (videoError) {
        console.warn('Video access failed, falling back to audio-only:', videoError)
        this.localStream = await navigator.mediaDevices.getUserMedia({
          video: false,
          audio: true
        })
        this.state.isAudioOnlyMode = true
        this.state.isVideoEnabled = false
      }

      this.state.localStream = this.localStream
      this.state.isConnected = true
      this.notifyStateChange()

      // Set up socket listeners for WebRTC signaling
      this.setupSocketListeners()

      // Start connection quality monitoring
      this.startQualityMonitoring()

      // Join the video call room
      socketService.emit('join-video-call', { sessionId, userId })

    } catch (error) {
      console.error('Failed to initialize video call:', error)
      this.callbacks?.onError('Failed to access camera/microphone')
      throw error
    }
  }

  private setupSocketListeners() {
    // Handle new participant joining
    socketService.on('participant-joined-call', async (data: { participantId: string }) => {
      if (data.participantId !== this.userId) {
        await this.createPeerConnection(data.participantId, true)
        this.callbacks?.onParticipantJoined(data.participantId)
      }
    })

    // Handle participant leaving
    socketService.on('participant-left-call', (data: { participantId: string }) => {
      this.removePeerConnection(data.participantId)
      this.callbacks?.onParticipantLeft(data.participantId)
    })

    // Handle WebRTC signaling
    socketService.on('webrtc-offer', async (data: { from: string, offer: RTCSessionDescriptionInit }) => {
      await this.handleOffer(data.from, data.offer)
    })

    socketService.on('webrtc-answer', async (data: { from: string, answer: RTCSessionDescriptionInit }) => {
      await this.handleAnswer(data.from, data.answer)
    })

    socketService.on('webrtc-ice-candidate', async (data: { from: string, candidate: RTCIceCandidateInit }) => {
      await this.handleIceCandidate(data.from, data.candidate)
    })

    // Handle existing participants
    socketService.on('existing-call-participants', async (data: { participants: string[] }) => {
      for (const participantId of data.participants) {
        if (participantId !== this.userId) {
          await this.createPeerConnection(participantId, false)
        }
      }
    })
  }

  private async createPeerConnection(participantId: string, isInitiator: boolean): Promise<void> {
    const peerConnection = new RTCPeerConnection({ iceServers: this.iceServers })
    this.peerConnections.set(participantId, peerConnection)

    // Add local stream tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, this.localStream!)
      })
    }

    // Handle remote stream
    peerConnection.ontrack = (event) => {
      const [remoteStream] = event.streams
      this.state.remoteStreams.set(participantId, remoteStream)
      this.notifyStateChange()
    }

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socketService.emit('webrtc-ice-candidate', {
          to: participantId,
          candidate: event.candidate.toJSON()
        })
      }
    }

    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
      console.log(`Connection state with ${participantId}:`, peerConnection.connectionState)
      
      if (peerConnection.connectionState === 'failed') {
        this.handleConnectionFailure(participantId)
      } else if (peerConnection.connectionState === 'connected') {
        this.reconnectAttempts.delete(participantId)
        this.updateConnectionQuality(participantId, 'good')
      } else if (peerConnection.connectionState === 'disconnected') {
        this.updateConnectionQuality(participantId, 'disconnected')
      }
    }

    // If we're the initiator, create and send offer
    if (isInitiator) {
      const offer = await peerConnection.createOffer()
      await peerConnection.setLocalDescription(offer)
      
      socketService.emit('webrtc-offer', {
        to: participantId,
        offer: offer
      })
    }
  }

  private async handleOffer(from: string, offer: RTCSessionDescriptionInit): Promise<void> {
    let peerConnection = this.peerConnections.get(from)
    
    if (!peerConnection) {
      await this.createPeerConnection(from, false)
      peerConnection = this.peerConnections.get(from)!
    }

    await peerConnection.setRemoteDescription(offer)
    const answer = await peerConnection.createAnswer()
    await peerConnection.setLocalDescription(answer)

    socketService.emit('webrtc-answer', {
      to: from,
      answer: answer
    })
  }

  private async handleAnswer(from: string, answer: RTCSessionDescriptionInit): Promise<void> {
    const peerConnection = this.peerConnections.get(from)
    if (peerConnection) {
      await peerConnection.setRemoteDescription(answer)
    }
  }

  private async handleIceCandidate(from: string, candidate: RTCIceCandidateInit): Promise<void> {
    const peerConnection = this.peerConnections.get(from)
    if (peerConnection) {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
    }
  }

  private removePeerConnection(participantId: string): void {
    const peerConnection = this.peerConnections.get(participantId)
    if (peerConnection) {
      peerConnection.close()
      this.peerConnections.delete(participantId)
    }
    
    this.state.remoteStreams.delete(participantId)
    this.state.participants = this.state.participants.filter(id => id !== participantId)
    this.notifyStateChange()
  }

  toggleVideo(): void {
    if (this.state.isAudioOnlyMode) {
      this.callbacks?.onError('Video is not available in audio-only mode')
      return
    }

    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled
        this.state.isVideoEnabled = videoTrack.enabled
        this.notifyStateChange()
      }
    }
  }

  toggleAudio(): void {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled
        this.state.isAudioEnabled = audioTrack.enabled
        this.notifyStateChange()
      }
    }
  }

  async switchToAudioOnly(): Promise<void> {
    if (this.state.isAudioOnlyMode) return

    try {
      // Stop video tracks
      if (this.localStream) {
        this.localStream.getVideoTracks().forEach(track => track.stop())
      }

      // Get new audio-only stream
      const audioStream = await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: true
      })

      // Replace tracks in all peer connections
      for (const [participantId, peerConnection] of this.peerConnections) {
        const sender = peerConnection.getSenders().find(s => 
          s.track && s.track.kind === 'video'
        )
        if (sender) {
          await peerConnection.removeTrack(sender)
        }
      }

      this.localStream = audioStream
      this.state.localStream = audioStream
      this.state.isAudioOnlyMode = true
      this.state.isVideoEnabled = false
      this.notifyStateChange()

    } catch (error) {
      console.error('Failed to switch to audio-only:', error)
      this.callbacks?.onError('Failed to switch to audio-only mode')
    }
  }

  private startQualityMonitoring(): void {
    this.qualityCheckInterval = setInterval(() => {
      this.checkConnectionQuality()
    }, 5000) // Check every 5 seconds
  }

  private async checkConnectionQuality(): Promise<void> {
    for (const [participantId, peerConnection] of this.peerConnections) {
      try {
        const stats = await peerConnection.getStats()
        let quality: ConnectionQuality['quality'] = 'excellent'
        let latency = 0
        let packetLoss = 0

        stats.forEach((report) => {
          if (report.type === 'inbound-rtp' && report.kind === 'video') {
            packetLoss = report.packetsLost || 0
            if (packetLoss > 5) quality = 'poor'
            else if (packetLoss > 2) quality = 'good'
          }
          
          if (report.type === 'candidate-pair' && report.state === 'succeeded') {
            latency = report.currentRoundTripTime * 1000 || 0
            if (latency > 300) quality = 'poor'
            else if (latency > 150) quality = 'good'
          }
        })

        this.updateConnectionQuality(participantId, quality, latency, packetLoss)
      } catch (error) {
        console.error('Failed to get connection stats:', error)
        this.updateConnectionQuality(participantId, 'disconnected')
      }
    }
  }

  private updateConnectionQuality(
    participantId: string, 
    quality: ConnectionQuality['quality'],
    latency?: number,
    packetLoss?: number
  ): void {
    const connectionQuality: ConnectionQuality = {
      participantId,
      quality,
      latency,
      packetLoss,
      lastUpdated: new Date()
    }

    this.state.connectionQuality.set(participantId, connectionQuality)
    this.callbacks?.onConnectionQualityChanged?.(participantId, connectionQuality)
    this.notifyStateChange()
  }

  private async handleConnectionFailure(participantId: string): Promise<void> {
    const attempts = this.reconnectAttempts.get(participantId) || 0
    
    if (attempts < this.maxReconnectAttempts) {
      this.reconnectAttempts.set(participantId, attempts + 1)
      this.state.reconnecting = true
      this.notifyStateChange()

      console.log(`Attempting to reconnect to ${participantId} (attempt ${attempts + 1})`)
      
      try {
        // Remove the failed connection
        this.removePeerConnection(participantId)
        
        // Wait a bit before reconnecting
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempts + 1)))
        
        // Create new connection
        await this.createPeerConnection(participantId, true)
        
        this.state.reconnecting = false
        this.notifyStateChange()
      } catch (error) {
        console.error(`Reconnection attempt ${attempts + 1} failed:`, error)
        this.state.reconnecting = false
        this.notifyStateChange()
        
        if (attempts + 1 >= this.maxReconnectAttempts) {
          this.callbacks?.onError(`Failed to reconnect to participant ${participantId}`)
        }
      }
    } else {
      this.callbacks?.onError(`Connection to participant ${participantId} permanently failed`)
      this.updateConnectionQuality(participantId, 'disconnected')
    }
  }

  leaveCall(): void {
    // Stop quality monitoring
    if (this.qualityCheckInterval) {
      clearInterval(this.qualityCheckInterval)
      this.qualityCheckInterval = null
    }

    // Close all peer connections
    this.peerConnections.forEach(pc => pc.close())
    this.peerConnections.clear()

    // Stop local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop())
      this.localStream = null
    }

    // Notify server
    if (this.sessionId && this.userId) {
      socketService.emit('leave-video-call', { 
        sessionId: this.sessionId, 
        userId: this.userId 
      })
    }

    // Reset state
    this.state = {
      isConnected: false,
      isVideoEnabled: true,
      isAudioEnabled: true,
      isAudioOnlyMode: false,
      participants: [],
      localStream: null,
      remoteStreams: new Map(),
      connectionQuality: new Map(),
      reconnecting: false
    }

    // Clear reconnection attempts
    this.reconnectAttempts.clear()

    this.notifyStateChange()
  }

  getState(): VideoCallState {
    return { ...this.state }
  }

  private notifyStateChange(): void {
    this.callbacks?.onStateChange({ ...this.state })
  }
}

export const webrtcService = new WebRTCService()