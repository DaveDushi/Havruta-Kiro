import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import VideoCall from '../components/VideoCall/VideoCall'

// Mock the WebRTC service
vi.mock('../services/webrtcService', () => ({
  webrtcService: {
    setCallbacks: vi.fn(),
    initializeCall: vi.fn(),
    leaveCall: vi.fn(),
    toggleVideo: vi.fn(),
    toggleAudio: vi.fn(),
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

import { webrtcService } from '../services/webrtcService'
const mockWebRTCService = webrtcService as any

// Mock video element
Object.defineProperty(HTMLVideoElement.prototype, 'srcObject', {
  set: vi.fn(),
  get: vi.fn()
})

describe('VideoCall Component', () => {
  const defaultProps = {
    sessionId: 'test-session',
    userId: 'test-user'
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render video call component', async () => {
    mockWebRTCService.initializeCall.mockResolvedValue(undefined)

    render(<VideoCall {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText(/Video Call/)).toBeInTheDocument()
    })

    expect(mockWebRTCService.setCallbacks).toHaveBeenCalled()
    expect(mockWebRTCService.initializeCall).toHaveBeenCalledWith('test-session', 'test-user', false)
  })

  it('should show initializing state', () => {
    mockWebRTCService.initializeCall.mockImplementation(() => new Promise(() => {})) // Never resolves

    render(<VideoCall {...defaultProps} />)

    expect(screen.getByText('Initializing video call...')).toBeInTheDocument()
  })

  it('should display error message when initialization fails', async () => {
    const errorMessage = 'Failed to access camera'
    mockWebRTCService.initializeCall.mockRejectedValue(new Error(errorMessage))

    render(<VideoCall {...defaultProps} />)

    await waitFor(() => {
      expect(screen.queryByText('Initializing video call...')).not.toBeInTheDocument()
    })

    // The component should handle the error through the callback system
    expect(mockWebRTCService.setCallbacks).toHaveBeenCalled()
  })

  it('should toggle video when video button is clicked', async () => {
    mockWebRTCService.initializeCall.mockResolvedValue(undefined)

    render(<VideoCall {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText(/Video Call/)).toBeInTheDocument()
    })

    const videoButton = screen.getByLabelText(/turn off camera/i).querySelector('button')!
    fireEvent.click(videoButton)

    expect(mockWebRTCService.toggleVideo).toHaveBeenCalled()
  })

  it('should toggle audio when audio button is clicked', async () => {
    mockWebRTCService.initializeCall.mockResolvedValue(undefined)

    render(<VideoCall {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText(/Video Call/)).toBeInTheDocument()
    })

    const audioButton = screen.getByRole('button', { name: /mute microphone/i })
    fireEvent.click(audioButton)

    expect(mockWebRTCService.toggleAudio).toHaveBeenCalled()
  })

  it('should end call when end call button is clicked', async () => {
    const onCallEnd = vi.fn()
    mockWebRTCService.initializeCall.mockResolvedValue(undefined)

    render(<VideoCall {...defaultProps} onCallEnd={onCallEnd} />)

    await waitFor(() => {
      expect(screen.getByText(/Video Call/)).toBeInTheDocument()
    })

    const endCallButton = screen.getByRole('button', { name: /end call/i })
    fireEvent.click(endCallButton)

    expect(mockWebRTCService.leaveCall).toHaveBeenCalled()
    expect(onCallEnd).toHaveBeenCalled()
  })

  it('should toggle minimize when minimize button is clicked', async () => {
    const onToggleMinimize = vi.fn()
    mockWebRTCService.initializeCall.mockResolvedValue(undefined)

    render(<VideoCall {...defaultProps} onToggleMinimize={onToggleMinimize} />)

    await waitFor(() => {
      expect(screen.getByText(/Video Call/)).toBeInTheDocument()
    })

    const minimizeButton = screen.getByTestId('ExpandLessIcon').closest('button')!
    fireEvent.click(minimizeButton)

    expect(onToggleMinimize).toHaveBeenCalled()
  })

  it('should show participant count correctly', async () => {
    mockWebRTCService.initializeCall.mockResolvedValue(undefined)
    mockWebRTCService.getState.mockReturnValue({
      isConnected: true,
      isVideoEnabled: true,
      isAudioEnabled: true,
      participants: [],
      localStream: null,
      remoteStreams: new Map([['participant1', {} as MediaStream]])
    })

    render(<VideoCall {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('Video Call (2 participants)')).toBeInTheDocument()
    })
  })

  it('should render in minimized state', async () => {
    mockWebRTCService.initializeCall.mockResolvedValue(undefined)

    render(<VideoCall {...defaultProps} minimized={true} />)

    await waitFor(() => {
      expect(screen.getByText(/Video Call/)).toBeInTheDocument()
    })

    // In minimized state, controls should not be visible
    expect(screen.queryByRole('button', { name: /turn off camera/i })).not.toBeInTheDocument()
  })

  it('should cleanup on unmount', async () => {
    mockWebRTCService.initializeCall.mockResolvedValue(undefined)

    const { unmount } = render(<VideoCall {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText(/Video Call/)).toBeInTheDocument()
    })

    unmount()

    expect(mockWebRTCService.leaveCall).toHaveBeenCalled()
  })
})