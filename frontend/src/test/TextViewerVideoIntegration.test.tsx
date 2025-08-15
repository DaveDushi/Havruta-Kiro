import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import TextViewer from '../components/TextViewer/TextViewer'

// Mock the services
vi.mock('../services/sefariaService', () => ({
  sefariaService: {
    getText: vi.fn().mockResolvedValue({
      ref: 'Genesis 1',
      heRef: 'בראשית א',
      text: ['In the beginning God created the heaven and the earth.'],
      he: ['בְּרֵאשִׁית בָּרָא אֱלֹהִים אֵת הַשָּׁמַיִם וְאֵת הָאָרֶץ']
    }),
    parseRef: vi.fn().mockReturnValue({ book: 'Genesis', chapter: 1, verse: 1 }),
    buildRef: vi.fn().mockReturnValue('Genesis 1')
  }
}))

vi.mock('../services/socketService', () => ({
  socketService: {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    getCurrentUser: vi.fn().mockReturnValue({ id: 'test-user', name: 'Test User' })
  }
}))

vi.mock('../services/webrtcService', () => ({
  webrtcService: {
    setCallbacks: vi.fn(),
    initializeCall: vi.fn().mockResolvedValue(undefined),
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

vi.mock('../contexts/CollaborativeNavigationContext', () => ({
  useCollaborativeNavigation: () => ({
    connectToSession: vi.fn().mockResolvedValue(undefined),
    disconnectFromSession: vi.fn(),
    broadcastNavigation: vi.fn(),
    onNavigationUpdate: vi.fn(),
    offNavigationUpdate: vi.fn(),
    resolveConflict: vi.fn(),
    state: {
      isConnected: true,
      participants: [],
      currentConflict: null,
      sessionId: 'test-session'
    }
  })
}))

// Mock video element
Object.defineProperty(HTMLVideoElement.prototype, 'srcObject', {
  set: vi.fn(),
  get: vi.fn()
})

describe('TextViewer Video Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render TextViewer without video call in non-collaborative mode', async () => {
    render(
      <TextViewer
        bookTitle="Genesis"
        initialRef="Genesis 1"
        isCollaborative={false}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Genesis')).toBeInTheDocument()
    })

    // Video call should not be visible
    expect(screen.queryByText(/Video Call/)).not.toBeInTheDocument()
  })

  it('should render TextViewer with video call in collaborative mode', async () => {
    render(
      <TextViewer
        bookTitle="Genesis"
        initialRef="Genesis 1"
        sessionId="test-session"
        userId="test-user"
        isCollaborative={true}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Genesis')).toBeInTheDocument()
    })

    // Video call should be visible
    await waitFor(() => {
      expect(screen.getByText(/Video Call/)).toBeInTheDocument()
    })
  })

  it('should not show video call without userId in collaborative mode', async () => {
    render(
      <TextViewer
        bookTitle="Genesis"
        initialRef="Genesis 1"
        sessionId="test-session"
        isCollaborative={true}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Genesis')).toBeInTheDocument()
    })

    // Video call should not be visible without userId
    expect(screen.queryByText(/Video Call/)).not.toBeInTheDocument()
  })

  it('should not show video call without sessionId in collaborative mode', async () => {
    render(
      <TextViewer
        bookTitle="Genesis"
        initialRef="Genesis 1"
        userId="test-user"
        isCollaborative={true}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Genesis')).toBeInTheDocument()
    })

    // Video call should not be visible without sessionId
    expect(screen.queryByText(/Video Call/)).not.toBeInTheDocument()
  })

  it('should initialize video call when collaborative session is active', async () => {
    const { webrtcService } = await import('../services/webrtcService')

    render(
      <TextViewer
        bookTitle="Genesis"
        initialRef="Genesis 1"
        sessionId="test-session"
        userId="test-user"
        isCollaborative={true}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Genesis')).toBeInTheDocument()
    })

    // Wait for video call initialization
    await waitFor(() => {
      expect(webrtcService.setCallbacks).toHaveBeenCalled()
      expect(webrtcService.initializeCall).toHaveBeenCalledWith('test-session', 'test-user')
    })
  })

  it('should cleanup video call on unmount', async () => {
    const { webrtcService } = await import('../services/webrtcService')

    const { unmount } = render(
      <TextViewer
        bookTitle="Genesis"
        initialRef="Genesis 1"
        sessionId="test-session"
        userId="test-user"
        isCollaborative={true}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Genesis')).toBeInTheDocument()
    })

    unmount()

    expect(webrtcService.leaveCall).toHaveBeenCalled()
  })
})