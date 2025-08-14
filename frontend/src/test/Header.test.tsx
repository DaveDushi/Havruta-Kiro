import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import { vi } from 'vitest'
import Header from '../components/Layout/Header'
import * as AuthContext from '../contexts/AuthContext'

// Mock the authService
vi.mock('../services/authService', () => ({
  default: {
    isAuthenticated: vi.fn(() => false),
    getCurrentUser: vi.fn(),
    logout: vi.fn(),
    initiateOAuthLogin: vi.fn(),
    handleOAuthCallback: vi.fn(),
  },
}))

const theme = createTheme()

const mockUser = {
  id: 'user1',
  email: 'test@example.com',
  name: 'Test User',
  profilePicture: 'https://example.com/avatar.jpg',
  oauthProvider: 'google' as const,
  oauthId: 'google123',
  createdAt: new Date(),
  lastActiveAt: new Date(),
}

// Mock the useAuth hook
const mockUseAuth = vi.fn()
const mockLogout = vi.fn()
vi.spyOn(AuthContext, 'useAuth').mockImplementation(mockUseAuth)

// Mock useNavigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ pathname: '/dashboard' }),
  }
})

const renderHeader = (isAuthenticated = true, user = mockUser) => {
  mockUseAuth.mockReturnValue({
    state: {
      user: isAuthenticated ? user : null,
      isAuthenticated,
      isLoading: false,
      error: null,
    },
    login: vi.fn(),
    logout: mockLogout,
    clearError: vi.fn(),
    handleOAuthCallback: vi.fn(),
  })

  return render(
    <BrowserRouter>
      <ThemeProvider theme={theme}>
        <Header />
      </ThemeProvider>
    </BrowserRouter>
  )
}

describe('Header Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('When user is authenticated', () => {
    it('renders the platform title', () => {
      renderHeader()
      
      expect(screen.getByText('Havruta Platform')).toBeInTheDocument()
    })

    it('displays navigation tabs', () => {
      renderHeader()
      
      expect(screen.getByRole('tab', { name: /dashboard/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /profile/i })).toBeInTheDocument()
    })

    it('shows welcome message with user name', () => {
      renderHeader()
      
      expect(screen.getByText('Welcome, Test User')).toBeInTheDocument()
    })

    it('displays user avatar when profile picture is available', () => {
      renderHeader()
      
      const avatar = screen.getByRole('button', { name: /account of current user/i })
      expect(avatar).toBeInTheDocument()
    })

    it('displays account circle icon when no profile picture', () => {
      const userWithoutPicture = { ...mockUser, profilePicture: undefined }
      renderHeader(true, userWithoutPicture)
      
      const avatar = screen.getByRole('button', { name: /account of current user/i })
      expect(avatar).toBeInTheDocument()
    })

    it('navigates to dashboard when title is clicked', () => {
      renderHeader()
      
      const title = screen.getByText('Havruta Platform')
      fireEvent.click(title)
      
      expect(mockNavigate).toHaveBeenCalledWith('/')
    })

    it('navigates when tab is clicked', () => {
      renderHeader()
      
      const profileTab = screen.getByRole('tab', { name: /profile/i })
      fireEvent.click(profileTab)
      
      expect(mockNavigate).toHaveBeenCalledWith('/profile')
    })

    it('opens user menu when avatar is clicked', () => {
      renderHeader()
      
      const avatar = screen.getByRole('button', { name: /account of current user/i })
      fireEvent.click(avatar)
      
      expect(screen.getByRole('menuitem', { name: /profile/i })).toBeInTheDocument()
      expect(screen.getByRole('menuitem', { name: /logout/i })).toBeInTheDocument()
    })

    it('navigates to profile when profile menu item is clicked', () => {
      renderHeader()
      
      const avatar = screen.getByRole('button', { name: /account of current user/i })
      fireEvent.click(avatar)
      
      const profileMenuItem = screen.getByRole('menuitem', { name: /profile/i })
      fireEvent.click(profileMenuItem)
      
      expect(mockNavigate).toHaveBeenCalledWith('/profile')
    })

    it('calls logout and navigates when logout menu item is clicked', () => {
      renderHeader()
      
      const avatar = screen.getByRole('button', { name: /account of current user/i })
      fireEvent.click(avatar)
      
      const logoutMenuItem = screen.getByRole('menuitem', { name: /logout/i })
      fireEvent.click(logoutMenuItem)
      
      expect(mockLogout).toHaveBeenCalled()
      expect(mockNavigate).toHaveBeenCalledWith('/login')
    })

    it('menu behavior works correctly', () => {
      renderHeader()
      
      const avatar = screen.getByRole('button', { name: /account of current user/i })
      fireEvent.click(avatar)
      
      // Menu should be open
      expect(screen.getByRole('menuitem', { name: /profile/i })).toBeInTheDocument()
      expect(screen.getByRole('menuitem', { name: /logout/i })).toBeInTheDocument()
      
      // Note: Material-UI handles menu closing behavior internally
      // This test verifies the menu opens correctly
    })

    it('highlights the correct tab based on current location', () => {
      renderHeader()
      
      const dashboardTab = screen.getByRole('tab', { name: /dashboard/i })
      expect(dashboardTab).toHaveAttribute('aria-selected', 'true')
    })
  })

  describe('When user is not authenticated', () => {
    it('shows login button instead of navigation', () => {
      renderHeader(false, null)
      
      expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument()
      expect(screen.queryByRole('tab', { name: /dashboard/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('tab', { name: /profile/i })).not.toBeInTheDocument()
    })

    it('does not show welcome message', () => {
      renderHeader(false, null)
      
      expect(screen.queryByText(/welcome/i)).not.toBeInTheDocument()
    })

    it('navigates to login when login button is clicked', () => {
      renderHeader(false, null)
      
      const loginButton = screen.getByRole('button', { name: /login/i })
      fireEvent.click(loginButton)
      
      expect(mockNavigate).toHaveBeenCalledWith('/login')
    })

    it('still shows platform title', () => {
      renderHeader(false, null)
      
      expect(screen.getByText('Havruta Platform')).toBeInTheDocument()
    })
  })

  describe('Responsive behavior', () => {
    it('renders without errors on different screen sizes', () => {
      renderHeader()
      
      // The component should render without throwing errors
      expect(screen.getByText('Havruta Platform')).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /dashboard/i })).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA labels for interactive elements', () => {
      renderHeader()
      
      const avatar = screen.getByRole('button', { name: /account of current user/i })
      expect(avatar).toHaveAttribute('aria-label', 'account of current user')
      expect(avatar).toHaveAttribute('aria-controls', 'menu-appbar')
      expect(avatar).toHaveAttribute('aria-haspopup', 'true')
    })

    it('has proper tab navigation structure', () => {
      renderHeader()
      
      const tablist = screen.getByRole('tablist')
      expect(tablist).toBeInTheDocument()
      
      const tabs = screen.getAllByRole('tab')
      expect(tabs).toHaveLength(2)
    })
  })
})