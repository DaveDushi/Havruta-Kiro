import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { webrtcService, VideoCallState } from '../services/webrtcService'

// Mock socket service
vi.mock('../services/socketService', () => ({
  socketService: {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn()
  }
}))

// Mock WebRTC APIs
const mockGetUserMedia = vi.fn()
const mockRTCPeerConnection = vi.fn()

Object.defineProperty(global.navigator, 'mediaDevices', {
  value: {
    getUserMedia: mockGetUserMedia
  },
  writable: true
})

Object.defineProperty(global, 'RTCPeerConnection', {
  value: mockRTCPeerConnection,
  writable: true
})

describe('WebRTCService', () => {
  const mockVideoTrack = { kind: 'video', enabled: true, stop: vi.fn() }
  const mockAudioTrack = { kind: 'audio', enabled: true, stop: vi.fn() }
  
  const mockStream = {
    getTracks: vi.fn(() => [mockVideoTrack, mockAudioTrack]),
    getVideoTracks: vi.fn(() => [mockVideoTrack]),
    getAudioTracks: vi.fn(() => [mockAudioTrack])
  } as any

  const mockPeerConnection = {
    addTrack: vi.fn(),
    createOffer: vi.fn(),
    createAnswer: vi.fn(),
    setLocalDescription: vi.fn(),
    setRemoteDescription: vi.fn(),
    addIceCandidate: vi.fn(),
    close: vi.fn(),
    ontrack: null,
    onicecandidate: null,
    onconnectionstatechange: null,
    connectionState: 'connected'
  } as any

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset track enabled states
    mockVideoTrack.enabled = true
    mockAudioTrack.enabled = true
    mockGetUserMedia.mockResolvedValue(mockStream)
    mockRTCPeerConnection.mockReturnValue(mockPeerConnection)
  })

  afterEach(() => {
    webrtcService.leaveCall()
  })

  describe('initializeCall', () => {
    it('should successfully initialize a video call', async () => {
      const sessionId = 'test-session'
      const userId = 'test-user'
      const mockCallbacks = {
        onStateChange: vi.fn(),
        onError: vi.fn(),
        onParticipantJoined: vi.fn(),
        onParticipantLeft: vi.fn()
      }

      webrtcService.setCallbacks(mockCallbacks)

      await webrtcService.initializeCall(sessionId, userId)

      expect(mockGetUserMedia).toHaveBeenCalledWith({
        video: true,
        audio: true
      })

      const state = webrtcService.getState()
      expect(state.isConnected).toBe(true)
      expect(state.localStream).toBe(mockStream)
      expect(mockCallbacks.onStateChange).toHaveBeenCalled()
    })

    it('should handle getUserMedia failure', async () => {
      const sessionId = 'test-session'
      const userId = 'test-user'
      const mockCallbacks = {
        onStateChange: vi.fn(),
        onError: vi.fn(),
        onParticipantJoined: vi.fn(),
        onParticipantLeft: vi.fn()
      }

      webrtcService.setCallbacks(mockCallbacks)
      mockGetUserMedia.mockRejectedValue(new Error('Permission denied'))

      await expect(webrtcService.initializeCall(sessionId, userId)).rejects.toThrow()
      expect(mockCallbacks.onError).toHaveBeenCalledWith('Failed to access camera/microphone')
    })
  })

  describe('toggleVideo', () => {
    it('should toggle video track enabled state', async () => {
      const sessionId = 'test-session'
      const userId = 'test-user'
      const mockCallbacks = {
        onStateChange: vi.fn(),
        onError: vi.fn(),
        onParticipantJoined: vi.fn(),
        onParticipantLeft: vi.fn()
      }

      webrtcService.setCallbacks(mockCallbacks)
      await webrtcService.initializeCall(sessionId, userId)

      expect(mockVideoTrack.enabled).toBe(true)

      webrtcService.toggleVideo()
      expect(mockVideoTrack.enabled).toBe(false)

      const state = webrtcService.getState()
      expect(state.isVideoEnabled).toBe(false)
      expect(mockCallbacks.onStateChange).toHaveBeenCalled()
    })
  })

  describe('toggleAudio', () => {
    it('should toggle audio track enabled state', async () => {
      const sessionId = 'test-session'
      const userId = 'test-user'
      const mockCallbacks = {
        onStateChange: vi.fn(),
        onError: vi.fn(),
        onParticipantJoined: vi.fn(),
        onParticipantLeft: vi.fn()
      }

      webrtcService.setCallbacks(mockCallbacks)
      await webrtcService.initializeCall(sessionId, userId)

      expect(mockAudioTrack.enabled).toBe(true)

      webrtcService.toggleAudio()
      expect(mockAudioTrack.enabled).toBe(false)

      const state = webrtcService.getState()
      expect(state.isAudioEnabled).toBe(false)
      expect(mockCallbacks.onStateChange).toHaveBeenCalled()
    })
  })

  describe('leaveCall', () => {
    it('should clean up resources when leaving call', async () => {
      const sessionId = 'test-session'
      const userId = 'test-user'
      const mockCallbacks = {
        onStateChange: vi.fn(),
        onError: vi.fn(),
        onParticipantJoined: vi.fn(),
        onParticipantLeft: vi.fn()
      }

      webrtcService.setCallbacks(mockCallbacks)
      await webrtcService.initializeCall(sessionId, userId)

      webrtcService.leaveCall()

      const state = webrtcService.getState()
      expect(state.isConnected).toBe(false)
      expect(state.localStream).toBe(null)
      expect(state.remoteStreams.size).toBe(0)

      // Check that tracks were stopped
      expect(mockVideoTrack.stop).toHaveBeenCalled()
      expect(mockAudioTrack.stop).toHaveBeenCalled()
    })
  })

  describe('getState', () => {
    it('should return current call state', () => {
      const initialState = webrtcService.getState()
      
      expect(initialState).toEqual({
        isConnected: false,
        isVideoEnabled: true,
        isAudioEnabled: true,
        isAudioOnlyMode: false,
        participants: [],
        localStream: null,
        remoteStreams: expect.any(Map),
        connectionQuality: expect.any(Map),
        reconnecting: false
      })
    })
  })
})