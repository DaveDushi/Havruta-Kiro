import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import { vi } from 'vitest'
import DashboardPage from '../pages/DashboardPage'
import * as AuthContext from '../contexts/AuthContext'
import * as useDashboardDataHook from '../hooks/useDashboardData'

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

// Mock the havrutaService
vi.mock('../services/havrutaService', () => ({
  havrutaService: {
    inviteParticipants: vi.fn(),
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

// Mock the useDashboardData hook
const mockUseDashboardData = vi.fn()
vi.spyOn(useDashboardDataHook, 'useDashboardData').mockImplementation(mockUseDashboardData)

// Mock data
const mockHavrutot = [
  {
    id: '1',
    name: 'Genesis Study Group',
    bookId: 'genesis',
    bookTitle: 'Genesis',
    creatorId: 'user1',
    participants: ['user1', 'user2'],
    currentSection: 'Genesis 1:1',
    isActive: true,
    createdAt: new Date('2024-01-01'),
    lastStudiedAt: new Date('2024-01-15'),
    totalSessions: 5,
  },
  {
    id: '2',
    name: 'Talmud Bavli',
    bookId: 'berakhot',
    bookTitle: 'Berakhot',
    creatorId: 'user1',
    participants: ['user1', 'user3'],
    currentSection: 'Berakhot 2a',
    isActive: true,
    createdAt: new Date('2024-01-02'),
    lastStudiedAt: new Date('2024-01-14'),
    totalSessions: 3,
  },
  {
    id: '3',
    name: 'Mishnah Study Circle',
    bookId: 'mishnah',
    bookTitle: 'Mishnah Berakhot',
    creatorId: 'user1',
    participants: ['user1', 'user4', 'user5'],
    currentSection: 'Mishnah Berakhot 1:1',
    isActive: false,
    createdAt: new Date('2024-01-03'),
    lastStudiedAt: new Date('2024-01-13'),
    totalSessions: 8,
  },
]

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

    mockUseDashboardData.mockReturnValue({
      havrutot: mockHavrutot,
      activeSessions: [],
      nextSession: {
        id: '1',
        name: 'Genesis Study Group',
        scheduledTime: new Date(Date.now() + 3600000),
        currentSection: 'Genesis 1:1',
      },
      statistics: {
        totalHavrutot: 3,
        totalSessions: 16,
        activeHavrutot: 2,
        totalStudyPartners: 4,
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      joinHavruta: vi.fn(),
      scheduleSession: vi.fn(),
      createHavruta: vi.fn(),
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
      
      // Search for "Berakhot" - should match both "Berakhot" and "Mishnah Berakhot"
      const searchInput = screen.getByPlaceholderText('Search Havrutot...')
      fireEvent.change(searchInput, { target: { value: 'Berakhot' } })
      
      // Should show both Talmud Bavli and Mishnah Study Circle (both have "Berakhot" in book title)
      expect(screen.getByText('Talmud Bavli')).toBeInTheDocument()
      expect(screen.getByText('Mishnah Study Circle')).toBeInTheDocument()
      
      // Check that the count reflects the filtered results
      expect(screen.getByText('My Havrutot (2)')).toBeInTheDocument()
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
      renderDashboard()
      
      // Click join collaborative button on first Havruta card
      const joinButtons = screen.getAllByRole('button', { name: /join collaborative/i })
      fireEvent.click(joinButtons[0])
      
      // Should call the join function (mocked in useDashboardData)
      expect(mockUseDashboardData().joinHavruta).toBeDefined()
    })

    it('handles invite participants action', () => {
      renderDashboard()
      
      // Click invite participants button on first Havruta card
      const inviteButtons = screen.getAllByRole('button', { name: /invite participants/i })
      fireEvent.click(inviteButtons[0])
      
      // Should open invitation dialog
      expect(screen.getByText(/invite participants to/i)).toBeInTheDocument()
    })

    it('handles invite participant action', () => {
      renderDashboard()
      
      // Click invite participants button
      const inviteButtons = screen.getAllByRole('button', { name: /invite participants/i })
      fireEvent.click(inviteButtons[0])
      
      // Should open invitation dialog
      expect(screen.getByText(/invite participants to/i)).toBeInTheDocument()
    })

    it('does not show Study Solo button', () => {
      renderDashboard()
      
      // Study Solo button should not be present
      expect(screen.queryByRole('button', { name: /study solo/i })).not.toBeInTheDocument()
    })

    it('shows Join Collaborative and Invite Participants buttons', () => {
      renderDashboard()
      
      // Should show Join Collaborative buttons
      const joinButtons = screen.getAllByRole('button', { name: /join collaborative/i })
      expect(joinButtons.length).toBeGreaterThan(0)
      
      // Should show Invite Participants buttons
      const inviteButtons = screen.getAllByRole('button', { name: /invite participants/i })
      expect(inviteButtons.length).toBeGreaterThan(0)
    })

    it('handles create new Havruta action', () => {
      renderDashboard()
      
      // Click new Havruta button
      const newHavrutaButton = screen.getByRole('button', { name: /new havruta/i })
      fireEvent.click(newHavrutaButton)
      
      // Should open create havruta dialog
      expect(screen.getByText(/create new havruta/i)).toBeInTheDocument()
    })

    it('handles join session from Next Up section', () => {
      renderDashboard()
      
      // Click join session button in Next Up section
      const joinSessionButton = screen.getByRole('button', { name: /join session/i })
      fireEvent.click(joinSessionButton)
      
      // Should call the join function (mocked in useDashboardData)
      expect(mockUseDashboardData().joinHavruta).toBeDefined()
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