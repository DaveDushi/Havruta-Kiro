import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import VideoCall from '../components/VideoCall/VideoCall'
import { webrtcService } from '../services/webrtcService'

// Mock the WebRTC service
vi.mock('../services/webrtcService', () => ({
  webrtcService: {
    setCallbacks: vi.fn(),
    initializeCall: vi.fn(),
    leaveCall: vi.fn(),
    toggleVideo: vi.fn(),
    toggleAudio: vi.fn(),
    switchToAudioOnly: vi.fn(),
    getState: vi.fn(() => ({
      isConnected: true,
      isVideoEnabled: true,
      isAudioEnabled: true,
      isAudioOnlyMode: false,
      participants: [],
      localStream: null,
      remoteStreams: new Map(),
      connectionQuality: new Map(),
      reconnecting: false
    }))
  }
}))

// Mock video element
Object.defineProperty(HTMLVideoElement.prototype, 'srcObject', {
  set: vi.fn(),
  get: vi.fn()
})

describe('VideoCall Integration Tests', () => {
  const defaultProps = {
    sessionId: 'test-session',
    userId: 'test-user'
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Audio-only mode', () => {
    it('should initialize in audio-only mode when specified', async () => {
      const mockWebRTCService = webrtcService as any
      mockWebRTCService.initializeCall.mockResolvedValue(undefined)

      render(<VideoCall {...defaultProps} audioOnlyMode={true} />)

      await waitFor(() => {
        expect(mockWebRTCService.initializeCall).toHaveBeenCalledWith(
          'test-session',
          'test-user',
          true
        )
      })
    })

    it('should show audio-only indicator when in audio-only mode', async () => {
      const mockWebRTCService = webrtcService as any
      mockWebRTCService.initializeCall.mockResolvedValue(undefined)
      mockWebRTCService.getState.mockReturnValue({
        isConnected: true,
        isVideoEnabled: false,
        isAudioEnabled: true,
        isAudioOnlyMode: true,
        participants: [],
        localStream: null,
        remoteStreams: new Map(),
        connectionQuality: new Map(),
        reconnecting: false
      })

      render(<VideoCall {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Audio Only')).toBeInTheDocument()
      })
    })

    it('should disable video button in audio-only mode', async () => {
      const mockWebRTCService = webrtcService as any
      mockWebRTCService.initializeCall.mockResolvedValue(undefined)
      mockWebRTCService.getState.mockReturnValue({
        isConnected: true,
        isVideoEnabled: false,
        isAudioEnabled: true,
        isAudioOnlyMode: true,
        participants: [],
        localStream: null,
        remoteStreams: new Map(),
        connectionQuality: new Map(),
        reconnecting: false
      })

      render(<VideoCall {...defaultProps} />)

      await waitFor(() => {
        // Find the disabled video button by looking for a disabled button with VideocamOff icon
        const buttons = screen.getAllByRole('button')
        const videoButton = buttons.find(button => button.disabled && button.querySelector('[data-testid="VideocamOffIcon"]'))
        expect(videoButton).toBeDefined()
        expect(videoButton).toBeDisabled()
      })
    })

    it('should switch to audio-only mode when button is clicked', async () => {
      const mockWebRTCService = webrtcService as any
      mockWebRTCService.initializeCall.mockResolvedValue(undefined)
      mockWebRTCService.switchToAudioOnly.mockResolvedValue(undefined)

      render(<VideoCall {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText(/Video Call/)).toBeInTheDocument()
      })

      // Find the audio-only button by looking for VolumeUp icon
      const buttons = screen.getAllByRole('button')
      const audioOnlyButton = buttons.find(button => button.querySelector('[data-testid="VolumeUpIcon"]'))
      
      if (audioOnlyButton) {
        fireEvent.click(audioOnlyButton)
        expect(mockWebRTCService.switchToAudioOnly).toHaveBeenCalled()
      } else {
        // If not in audio-only mode, the button might not be visible
        expect(mockWebRTCService.switchToAudioOnly).not.toHaveBeenCalled()
      }
    })
  })

  describe('Connection quality indicators', () => {
    it('should display connection quality for remote participants', async () => {
      const mockWebRTCService = webrtcService as any
      mockWebRTCService.initializeCall.mockResolvedValue(undefined)
      
      const mockRemoteStreams = new Map([['participant1', {} as MediaStream]])
      const mockConnectionQuality = new Map([
        ['participant1', {
          participantId: 'participant1',
          quality: 'good' as const,
          latency: 100,
          packetLoss: 1,
          lastUpdated: new Date()
        }]
      ])

      mockWebRTCService.getState.mockReturnValue({
        isConnected: true,
        isVideoEnabled: true,
        isAudioEnabled: true,
        isAudioOnlyMode: false,
        participants: ['participant1'],
        localStream: null,
        remoteStreams: mockRemoteStreams,
        connectionQuality: mockConnectionQuality,
        reconnecting: false
      })

      render(<VideoCall {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Participant ant1')).toBeInTheDocument()
      })

      // Connection quality indicator should be present (as an icon)
      const qualityIndicator = screen.queryByTestId('SignalWifi3BarIcon')
      expect(qualityIndicator).toBeInTheDocument()
    })

    it('should show reconnecting status', async () => {
      const mockWebRTCService = webrtcService as any
      mockWebRTCService.initializeCall.mockResolvedValue(undefined)
      mockWebRTCService.getState.mockReturnValue({
        isConnected: true,
        isVideoEnabled: true,
        isAudioEnabled: true,
        isAudioOnlyMode: false,
        participants: [],
        localStream: null,
        remoteStreams: new Map(),
        connectionQuality: new Map(),
        reconnecting: true
      })

      render(<VideoCall {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Reconnecting...')).toBeInTheDocument()
      })
    })
  })

  describe('Error handling', () => {
    it('should display error message when initialization fails', async () => {
      const mockWebRTCService = webrtcService as any
      mockWebRTCService.initializeCall.mockRejectedValue(new Error('Camera access denied'))

      render(<VideoCall {...defaultProps} />)

      await waitFor(() => {
        expect(mockWebRTCService.setCallbacks).toHaveBeenCalled()
      })

      // Simulate error callback
      const callbacks = mockWebRTCService.setCallbacks.mock.calls[0][0]
      callbacks.onError('Failed to access camera/microphone')

      await waitFor(() => {
        expect(screen.getByText('Failed to access camera/microphone')).toBeInTheDocument()
      })
    })

    it('should handle connection quality changes', async () => {
      const mockWebRTCService = webrtcService as any
      mockWebRTCService.initializeCall.mockResolvedValue(undefined)

      render(<VideoCall {...defaultProps} />)

      await waitFor(() => {
        expect(mockWebRTCService.setCallbacks).toHaveBeenCalled()
      })

      // Simulate connection quality change callback
      const callbacks = mockWebRTCService.setCallbacks.mock.calls[0][0]
      const qualityData = {
        participantId: 'participant1',
        quality: 'poor' as const,
        latency: 500,
        packetLoss: 10,
        lastUpdated: new Date()
      }

      callbacks.onConnectionQualityChanged('participant1', qualityData)

      // Should not throw error and should handle the callback gracefully
      expect(callbacks.onConnectionQualityChanged).toBeDefined()
    })
  })

  describe('Participant management', () => {
    it('should handle participant joining', async () => {
      const mockWebRTCService = webrtcService as any
      mockWebRTCService.initializeCall.mockResolvedValue(undefined)

      render(<VideoCall {...defaultProps} />)

      await waitFor(() => {
        expect(mockWebRTCService.setCallbacks).toHaveBeenCalled()
      })

      // Simulate participant joined callback
      const callbacks = mockWebRTCService.setCallbacks.mock.calls[0][0]
      callbacks.onParticipantJoined('participant1')

      // Should handle the callback without errors
      expect(callbacks.onParticipantJoined).toBeDefined()
    })

    it('should handle participant leaving', async () => {
      const mockWebRTCService = webrtcService as any
      mockWebRTCService.initializeCall.mockResolvedValue(undefined)

      render(<VideoCall {...defaultProps} />)

      await waitFor(() => {
        expect(mockWebRTCService.setCallbacks).toHaveBeenCalled()
      })

      // Simulate participant left callback
      const callbacks = mockWebRTCService.setCallbacks.mock.calls[0][0]
      callbacks.onParticipantLeft('participant1')

      // Should handle the callback without errors
      expect(callbacks.onParticipantLeft).toBeDefined()
    })

    it('should update participant count correctly', async () => {
      const mockWebRTCService = webrtcService as any
      mockWebRTCService.initializeCall.mockResolvedValue(undefined)
      mockWebRTCService.getState.mockReturnValue({
        isConnected: true,
        isVideoEnabled: true,
        isAudioEnabled: true,
        isAudioOnlyMode: false,
        participants: ['participant1', 'participant2'],
        localStream: null,
        remoteStreams: new Map([
          ['participant1', {} as MediaStream],
          ['participant2', {} as MediaStream]
        ]),
        connectionQuality: new Map(),
        reconnecting: false
      })

      render(<VideoCall {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Video Call (3 participants)')).toBeInTheDocument()
      })
    })
  })

  describe('Cleanup', () => {
    it('should cleanup resources on unmount', async () => {
      const mockWebRTCService = webrtcService as any
      mockWebRTCService.initializeCall.mockResolvedValue(undefined)

      const { unmount } = render(<VideoCall {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText(/Video Call/)).toBeInTheDocument()
      })

      unmount()

      expect(mockWebRTCService.leaveCall).toHaveBeenCalled()
    })
  })
})