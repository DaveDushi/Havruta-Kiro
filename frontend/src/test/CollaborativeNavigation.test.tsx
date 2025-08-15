import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import { CollaborativeNavigationProvider } from '../contexts/CollaborativeNavigationContext'
import { AuthProvider } from '../contexts/AuthContext'
import { TextViewer } from '../components/TextViewer'
import { socketService } from '../services/socketService'
import { User, NavigationEvent, NavigationConflict } from '../types'

// Mock the socket service
vi.mock('../services/socketService', () => ({
  socketService: {
    connect: vi.fn(),
    disconnect: vi.fn(),
    joinSession: vi.fn(),
    leaveSession: vi.fn(),
    broadcastNavigation: vi.fn(),
    syncToReference: vi.fn(),
    resolveConflict: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    isConnected: vi.fn(() => true),
    getCurrentSessionId: vi.fn(() => 'test-session'),
    getCurrentUser: vi.fn(() => mockUser)
  }
}))

// Mock the Sefaria service
vi.mock('../services/sefariaService', () => ({
  sefariaService: {
    getText: vi.fn(() => Promise.resolve({
      ref: 'Genesis 1:1',
      heRef: 'בראשית א:א',
      text: ['In the beginning God created the heaven and the earth.'],
      he: ['בְּרֵאשִׁית בָּרָא אֱלֹהִים אֵת הַשָּׁמַיִם וְאֵת הָאָרֶץ'],
      versions: [],
      textDepth: 1,
      sectionNames: ['Chapter', 'Verse'],
      addressTypes: ['Integer', 'Integer']
    })),
    parseRef: vi.fn((ref: string) => ({ book: 'Genesis', chapter: 1, verse: 1 })),
    buildRef: vi.fn((book: string, chapter?: number, verse?: number) => 
      verse ? `${book} ${chapter}:${verse}` : chapter ? `${book} ${chapter}` : book
    )
  }
}))

const mockUser: User = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
  oauthProvider: 'google',
  oauthId: 'google-123',
  createdAt: new Date(),
  lastActiveAt: new Date()
}

const theme = createTheme()

// Mock the auth context
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    state: {
      user: mockUser,
      isAuthenticated: true,
      isLoading: false,
      error: null
    },
    login: vi.fn(),
    handleOAuthCallback: vi.fn(),
    logout: vi.fn(),
    clearError: vi.fn()
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children
}))

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider theme={theme}>
    <CollaborativeNavigationProvider>
      {children}
    </CollaborativeNavigationProvider>
  </ThemeProvider>
)

describe('Collaborative Navigation', () => {
  let mockSocketOn: any
  let mockSocketOff: any
  let mockSocketConnect: any
  let mockSocketJoinSession: any
  let mockSocketBroadcastNavigation: any

  beforeEach(() => {
    mockSocketOn = vi.fn()
    mockSocketOff = vi.fn()
    mockSocketConnect = vi.fn(() => Promise.resolve())
    mockSocketJoinSession = vi.fn(() => Promise.resolve())
    mockSocketBroadcastNavigation = vi.fn()

    vi.mocked(socketService.on).mockImplementation(mockSocketOn)
    vi.mocked(socketService.off).mockImplementation(mockSocketOff)
    vi.mocked(socketService.connect).mockImplementation(mockSocketConnect)
    vi.mocked(socketService.joinSession).mockImplementation(mockSocketJoinSession)
    vi.mocked(socketService.broadcastNavigation).mockImplementation(mockSocketBroadcastNavigation)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('TextViewer Collaborative Integration', () => {
    it('should render collaborative text viewer with participant indicators', async () => {
      render(
        <TestWrapper>
          <TextViewer
            bookTitle="Genesis"
            sessionId="test-session"
            isCollaborative={true}
            initialRef="Genesis 1:1"
          />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('Genesis')).toBeInTheDocument()
      })

      // Should connect to socket service
      expect(mockSocketConnect).toHaveBeenCalled()
      expect(mockSocketJoinSession).toHaveBeenCalledWith('test-session')
    })

    it('should broadcast navigation when user navigates', async () => {
      const user = userEvent.setup()
      
      render(
        <TestWrapper>
          <TextViewer
            bookTitle="Genesis"
            sessionId="test-session"
            isCollaborative={true}
            initialRef="Genesis 1:1"
          />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('Genesis')).toBeInTheDocument()
      })

      // Simulate navigation
      const nextButton = screen.getByRole('button', { name: /next section/i })
      if (nextButton && !nextButton.hasAttribute('disabled')) {
        await user.click(nextButton)
        expect(mockSocketBroadcastNavigation).toHaveBeenCalled()
      }
    })

    it('should handle incoming navigation events', async () => {
      let navigationHandler: (event: NavigationEvent) => void

      mockSocketOn.mockImplementation((event: string, handler: Function) => {
        if (event === 'navigation:update') {
          navigationHandler = handler as (event: NavigationEvent) => void
        }
      })

      render(
        <TestWrapper>
          <TextViewer
            bookTitle="Genesis"
            sessionId="test-session"
            isCollaborative={true}
            initialRef="Genesis 1:1"
          />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('Genesis')).toBeInTheDocument()
      })

      // Simulate incoming navigation event
      const navigationEvent: NavigationEvent = {
        sessionId: 'test-session',
        userId: 'user-2',
        userName: 'Other User',
        newRef: 'Genesis 2:1',
        timestamp: new Date()
      }

      if (navigationHandler!) {
        navigationHandler(navigationEvent)
      }

      await waitFor(() => {
        expect(screen.getByText(/Other User navigated to Genesis 2:1/)).toBeInTheDocument()
      })
    })

    it('should display navigation conflict dialog', async () => {
      let conflictHandler: (conflict: NavigationConflict) => void

      mockSocketOn.mockImplementation((event: string, handler: Function) => {
        if (event === 'navigation:conflict') {
          conflictHandler = handler as (conflict: NavigationConflict) => void
        }
      })

      render(
        <TestWrapper>
          <TextViewer
            bookTitle="Genesis"
            sessionId="test-session"
            isCollaborative={true}
            initialRef="Genesis 1:1"
          />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('Genesis')).toBeInTheDocument()
      })

      // Simulate navigation conflict
      const conflict: NavigationConflict = {
        sessionId: 'test-session',
        conflictingRefs: [
          {
            ref: 'Genesis 2:1',
            participants: [{ userId: 'user-1', userName: 'User One' }]
          },
          {
            ref: 'Genesis 3:1',
            participants: [{ userId: 'user-2', userName: 'User Two' }]
          }
        ],
        timestamp: new Date()
      }

      if (conflictHandler!) {
        conflictHandler(conflict)
      }

      await waitFor(() => {
        expect(screen.getByText('Navigation Conflict')).toBeInTheDocument()
        expect(screen.getByText('Genesis 2:1')).toBeInTheDocument()
        expect(screen.getByText('Genesis 3:1')).toBeInTheDocument()
      })
    })

    it('should resolve navigation conflicts', async () => {
      const user = userEvent.setup()
      let conflictHandler: (conflict: NavigationConflict) => void

      mockSocketOn.mockImplementation((event: string, handler: Function) => {
        if (event === 'navigation:conflict') {
          conflictHandler = handler as (conflict: NavigationConflict) => void
        }
      })

      const mockResolveConflict = vi.fn()
      vi.mocked(socketService.resolveConflict).mockImplementation(mockResolveConflict)

      render(
        <TestWrapper>
          <TextViewer
            bookTitle="Genesis"
            sessionId="test-session"
            isCollaborative={true}
            initialRef="Genesis 1:1"
          />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('Genesis')).toBeInTheDocument()
      })

      // Simulate navigation conflict
      const conflict: NavigationConflict = {
        sessionId: 'test-session',
        conflictingRefs: [
          {
            ref: 'Genesis 2:1',
            participants: [{ userId: 'user-1', userName: 'User One' }]
          },
          {
            ref: 'Genesis 3:1',
            participants: [{ userId: 'user-2', userName: 'User Two' }]
          }
        ],
        timestamp: new Date()
      }

      if (conflictHandler!) {
        conflictHandler(conflict)
      }

      await waitFor(() => {
        expect(screen.getByText('Navigation Conflict')).toBeInTheDocument()
      })

      // Click on first option to resolve conflict
      const firstOption = screen.getByText('Genesis 2:1').closest('[role="button"]')
      if (firstOption) {
        await user.click(firstOption)
        expect(mockResolveConflict).toHaveBeenCalledWith('Genesis 2:1')
      }
    })
  })

  describe('Participant Indicators', () => {
    it('should display participant positions', async () => {
      let participantHandler: (positions: any[]) => void

      mockSocketOn.mockImplementation((event: string, handler: Function) => {
        if (event === 'participant:positions') {
          participantHandler = handler as (positions: any[]) => void
        }
      })

      render(
        <TestWrapper>
          <TextViewer
            bookTitle="Genesis"
            sessionId="test-session"
            isCollaborative={true}
            initialRef="Genesis 1:1"
          />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('Genesis')).toBeInTheDocument()
      })

      // Simulate participant positions update
      const positions = [
        {
          userId: 'user-2',
          userName: 'Other User',
          currentRef: 'Genesis 1:1',
          timestamp: new Date(),
          isActive: true
        },
        {
          userId: 'user-3',
          userName: 'Third User',
          currentRef: 'Genesis 2:1',
          timestamp: new Date(),
          isActive: true
        }
      ]

      if (participantHandler!) {
        participantHandler(positions)
      }

      await waitFor(() => {
        expect(screen.getByText('Study Partners')).toBeInTheDocument()
        expect(screen.getByText('Other User')).toBeInTheDocument()
        expect(screen.getByText('Third User')).toBeInTheDocument()
      })
    })

    it('should separate participants by current section', async () => {
      let participantHandler: (positions: any[]) => void

      mockSocketOn.mockImplementation((event: string, handler: Function) => {
        if (event === 'participant:positions') {
          participantHandler = handler as (positions: any[]) => void
        }
      })

      render(
        <TestWrapper>
          <TextViewer
            bookTitle="Genesis"
            sessionId="test-session"
            isCollaborative={true}
            initialRef="Genesis 1:1"
          />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('Genesis')).toBeInTheDocument()
      })

      // Simulate participant positions with different sections
      const positions = [
        {
          userId: 'user-2',
          userName: 'Same Section User',
          currentRef: 'Genesis 1:1', // Same as current
          timestamp: new Date(),
          isActive: true
        },
        {
          userId: 'user-3',
          userName: 'Different Section User',
          currentRef: 'Genesis 2:1', // Different from current
          timestamp: new Date(),
          isActive: true
        }
      ]

      if (participantHandler!) {
        participantHandler(positions)
      }

      await waitFor(() => {
        expect(screen.getByText('On this section:')).toBeInTheDocument()
        expect(screen.getByText('On other sections:')).toBeInTheDocument()
        expect(screen.getByText('Same Section User')).toBeInTheDocument()
        expect(screen.getByText('Different Section User')).toBeInTheDocument()
      })
    })
  })

  describe('Socket Service Integration', () => {
    it('should connect and disconnect properly', async () => {
      const mockDisconnect = vi.fn()
      const mockLeaveSession = vi.fn()
      
      vi.mocked(socketService.disconnect).mockImplementation(mockDisconnect)
      vi.mocked(socketService.leaveSession).mockImplementation(mockLeaveSession)

      const { unmount } = render(
        <TestWrapper>
          <TextViewer
            bookTitle="Genesis"
            sessionId="test-session"
            isCollaborative={true}
            initialRef="Genesis 1:1"
          />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(mockSocketConnect).toHaveBeenCalled()
        expect(mockSocketJoinSession).toHaveBeenCalledWith('test-session')
      })

      // Unmount should trigger cleanup
      unmount()
      
      await waitFor(() => {
        expect(mockLeaveSession).toHaveBeenCalled()
      })
    })

    it('should handle connection errors gracefully', async () => {
      const mockConnectError = vi.fn(() => Promise.reject(new Error('Connection failed')))
      vi.mocked(socketService.connect).mockImplementation(mockConnectError)

      // Should not crash the component
      render(
        <TestWrapper>
          <TextViewer
            bookTitle="Genesis"
            sessionId="test-session"
            isCollaborative={true}
            initialRef="Genesis 1:1"
          />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('Genesis')).toBeInTheDocument()
      })

      expect(mockConnectError).toHaveBeenCalled()
    })
  })
})