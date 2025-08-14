import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import { vi } from 'vitest'
import DashboardPage from '../pages/DashboardPage'
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
vi.spyOn(AuthContext, 'useAuth').mockImplementation(mockUseAuth)

const renderDashboard = () => {
  return render(
    <BrowserRouter>
      <ThemeProvider theme={theme}>
        <DashboardPage />
      </ThemeProvider>
    </BrowserRouter>
  )
}

describe('Dashboard Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue({
      state: {
        user: mockUser,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      },
      login: vi.fn(),
      logout: vi.fn(),
      clearError: vi.fn(),
      handleOAuthCallback: vi.fn(),
    })
  })

  describe('Search and Filter Functionality', () => {
    it('filters Havrutot by search term', async () => {
      renderDashboard()
      
      // Initially should show all Havrutot
      expect(screen.getAllByText('Genesis Study Group')).toHaveLength(2) // Next Up + card
      expect(screen.getByText('Talmud Bavli')).toBeInTheDocument()
      expect(screen.getByText('Mishnah Study Circle')).toBeInTheDocument()
      
      // Search for "Genesis"
      const searchInput = screen.getByPlaceholderText('Search Havrutot...')
      fireEvent.change(searchInput, { target: { value: 'Genesis' } })
      
      // Should only show Genesis Study Group
      expect(screen.getAllByText('Genesis Study Group')).toHaveLength(2) // Next Up + card
      expect(screen.queryByText('Talmud Bavli')).not.toBeInTheDocument()
      expect(screen.queryByText('Mishnah Study Circle')).not.toBeInTheDocument()
    })

    it('filters Havrutot by book title', async () => {
      renderDashboard()
      
      // Search for "Berakhot"
      const searchInput = screen.getByPlaceholderText('Search Havrutot...')
      fireEvent.change(searchInput, { target: { value: 'Berakhot' } })
      
      // Should only show Talmud Bavli in the cards section
      // Note: "Genesis Study Group" may still appear in "Next Up" section
      expect(screen.getByText('Talmud Bavli')).toBeInTheDocument()
      expect(screen.queryByText('Mishnah Study Circle')).not.toBeInTheDocument()
      
      // Check that the count reflects the filtered results
      expect(screen.getByText('My Havrutot (1)')).toBeInTheDocument()
    })

    it('shows empty state when no results match filters', async () => {
      renderDashboard()
      
      // Search for something that doesn't exist
      const searchInput = screen.getByPlaceholderText('Search Havrutot...')
      fireEvent.change(searchInput, { target: { value: 'NonexistentHavruta' } })
      
      // Should show empty state
      expect(screen.getByText('No Havrutot match your filters')).toBeInTheDocument()
      expect(screen.getByText('Try adjusting your search or filter criteria to find your Havrutot')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /clear filters/i })).toBeInTheDocument()
    })

    it('clears filters when clear button is clicked', async () => {
      renderDashboard()
      
      // Apply a search filter
      const searchInput = screen.getByPlaceholderText('Search Havrutot...')
      fireEvent.change(searchInput, { target: { value: 'NonexistentHavruta' } })
      
      // Should show empty state
      expect(screen.getByText('No Havrutot match your filters')).toBeInTheDocument()
      
      // Click clear filters
      const clearButton = screen.getByRole('button', { name: /clear filters/i })
      fireEvent.click(clearButton)
      
      // Should show all Havrutot again
      expect(screen.getAllByText('Genesis Study Group')).toHaveLength(2) // Next Up + card
      expect(screen.getByText('Talmud Bavli')).toBeInTheDocument()
      expect(screen.getByText('Mishnah Study Circle')).toBeInTheDocument()
    })

    it('renders filter and sort controls', () => {
      renderDashboard()
      
      // Check that filter controls are present
      expect(screen.getByPlaceholderText('Search Havrutot...')).toBeInTheDocument()
      expect(screen.getAllByRole('combobox')).toHaveLength(2) // Status and Sort by
      expect(screen.getByRole('button', { name: /z-a/i })).toBeInTheDocument()
    })
  })

  describe('Sorting Functionality', () => {
    it('toggles sort order', async () => {
      renderDashboard()
      
      // Click sort order toggle
      const sortOrderButton = screen.getByRole('button', { name: /z-a/i })
      fireEvent.click(sortOrderButton)
      
      // Should change to A-Z
      expect(screen.getByRole('button', { name: /a-z/i })).toBeInTheDocument()
    })

    it('displays sort controls', () => {
      renderDashboard()
      
      // Check that sort controls are present
      expect(screen.getAllByRole('combobox')).toHaveLength(2) // Status and Sort by selects
      expect(screen.getByRole('button', { name: /z-a/i })).toBeInTheDocument()
    })
  })

  describe('Quick Actions', () => {
    it('handles join Havruta action', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      renderDashboard()
      
      // Click join button on first Havruta card
      const joinButtons = screen.getAllByRole('button', { name: /^join$/i })
      fireEvent.click(joinButtons[0])
      
      expect(consoleSpy).toHaveBeenCalledWith('Join havruta 1')
      consoleSpy.mockRestore()
    })

    it('handles schedule session action', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      renderDashboard()
      
      // Click schedule button on first Havruta card
      const scheduleButtons = screen.getAllByRole('button', { name: /schedule/i })
      fireEvent.click(scheduleButtons[0])
      
      expect(consoleSpy).toHaveBeenCalledWith('Schedule havruta 1')
      consoleSpy.mockRestore()
    })

    it('handles invite participant action', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      renderDashboard()
      
      // Click invite button (PersonAdd icon)
      const inviteButtons = screen.getAllByTitle('Invite participant')
      fireEvent.click(inviteButtons[0])
      
      expect(consoleSpy).toHaveBeenCalledWith('Invite participant to havruta 1')
      consoleSpy.mockRestore()
    })

    it('handles create new Havruta action', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      renderDashboard()
      
      // Click new Havruta button
      const newHavrutaButton = screen.getByRole('button', { name: /new havruta/i })
      fireEvent.click(newHavrutaButton)
      
      expect(consoleSpy).toHaveBeenCalledWith('Create new Havruta')
      consoleSpy.mockRestore()
    })

    it('handles join session from Next Up section', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      renderDashboard()
      
      // Click join session button in Next Up section
      const joinSessionButton = screen.getByRole('button', { name: /join session/i })
      fireEvent.click(joinSessionButton)
      
      expect(consoleSpy).toHaveBeenCalledWith('Join havruta 1')
      consoleSpy.mockRestore()
    })
  })

  describe('Combined Filter and Sort Operations', () => {
    it('updates count display when filters are applied', async () => {
      renderDashboard()
      
      // Initially shows all 3 Havrutot
      expect(screen.getByText('My Havrutot (3)')).toBeInTheDocument()
      
      // Apply search filter
      const searchInput = screen.getByPlaceholderText('Search Havrutot...')
      fireEvent.change(searchInput, { target: { value: 'Genesis' } })
      
      // Should show filtered count
      expect(screen.getByText('My Havrutot (1)')).toBeInTheDocument()
    })

    it('combines search with other functionality', async () => {
      renderDashboard()
      
      // Search for "Study" 
      const searchInput = screen.getByPlaceholderText('Search Havrutot...')
      fireEvent.change(searchInput, { target: { value: 'Study' } })
      
      // Should show Genesis Study Group and Mishnah Study Circle (both contain "Study")
      expect(screen.getAllByText('Genesis Study Group')).toHaveLength(2) // Next Up + card
      expect(screen.getByText('Mishnah Study Circle')).toBeInTheDocument()
      expect(screen.queryByText('Talmud Bavli')).not.toBeInTheDocument() // Doesn't contain "Study"
    })
  })

  describe('Responsive Behavior', () => {
    it('renders filter controls in responsive layout', () => {
      renderDashboard()
      
      // Check that all filter controls are present
      expect(screen.getByPlaceholderText('Search Havrutot...')).toBeInTheDocument()
      expect(screen.getAllByRole('combobox')).toHaveLength(2) // Status and Sort by
      expect(screen.getByRole('button', { name: /z-a/i })).toBeInTheDocument()
    })

    it('displays Havruta cards in responsive grid', () => {
      renderDashboard()
      
      // Check that Havruta cards are rendered
      expect(screen.getAllByText('Genesis Study Group')).toHaveLength(2) // Next Up + card
      expect(screen.getByText('Talmud Bavli')).toBeInTheDocument()
      expect(screen.getByText('Mishnah Study Circle')).toBeInTheDocument()
    })
  })
})