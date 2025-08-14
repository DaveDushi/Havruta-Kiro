import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AuthProvider, useAuth } from '../contexts/AuthContext'
import authService from '../services/authService'

// Mock the auth service
vi.mock('../services/authService', () => ({
  default: {
    isAuthenticated: vi.fn(),
    getCurrentUser: vi.fn(),
    initiateOAuthLogin: vi.fn(),
    handleOAuthCallback: vi.fn(),
    logout: vi.fn(),
  },
}))

// Test component that uses the auth context
const TestComponent = () => {
  const { state, login, logout, clearError } = useAuth()

  return (
    <div>
      <div data-testid="auth-state">
        {state.isAuthenticated ? 'authenticated' : 'not-authenticated'}
      </div>
      <div data-testid="loading">{state.isLoading ? 'loading' : 'not-loading'}</div>
      <div data-testid="error">{state.error || 'no-error'}</div>
      <button onClick={() => login('google')} data-testid="login-button">
        Login
      </button>
      <button onClick={logout} data-testid="logout-button">
        Logout
      </button>
      <button onClick={clearError} data-testid="clear-error-button">
        Clear Error
      </button>
    </div>
  )
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('provides initial auth state', () => {
    vi.mocked(authService.isAuthenticated).mockReturnValue(false)

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    expect(screen.getByTestId('auth-state')).toHaveTextContent('not-authenticated')
    expect(screen.getByTestId('loading')).toHaveTextContent('not-loading')
    expect(screen.getByTestId('error')).toHaveTextContent('no-error')
  })

  it('handles login flow', async () => {
    vi.mocked(authService.isAuthenticated).mockReturnValue(false)
    vi.mocked(authService.initiateOAuthLogin).mockResolvedValue()

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    const loginButton = screen.getByTestId('login-button')
    fireEvent.click(loginButton)

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('loading')
    })

    expect(authService.initiateOAuthLogin).toHaveBeenCalledWith('google')
  })

  it('handles login error', async () => {
    vi.mocked(authService.isAuthenticated).mockReturnValue(false)
    vi.mocked(authService.initiateOAuthLogin).mockRejectedValue(new Error('Login failed'))

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    const loginButton = screen.getByTestId('login-button')
    fireEvent.click(loginButton)

    await waitFor(() => {
      expect(screen.getByTestId('error')).toHaveTextContent('Login failed')
    })
  })

  it('handles logout', () => {
    vi.mocked(authService.isAuthenticated).mockReturnValue(false)

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    const logoutButton = screen.getByTestId('logout-button')
    fireEvent.click(logoutButton)

    expect(authService.logout).toHaveBeenCalled()
    expect(screen.getByTestId('auth-state')).toHaveTextContent('not-authenticated')
  })

  it('clears error state', async () => {
    vi.mocked(authService.isAuthenticated).mockReturnValue(false)
    vi.mocked(authService.initiateOAuthLogin).mockRejectedValue(new Error('Login failed'))

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    // Trigger an error
    const loginButton = screen.getByTestId('login-button')
    fireEvent.click(loginButton)

    await waitFor(() => {
      expect(screen.getByTestId('error')).toHaveTextContent('Login failed')
    })

    // Clear the error
    const clearErrorButton = screen.getByTestId('clear-error-button')
    fireEvent.click(clearErrorButton)

    expect(screen.getByTestId('error')).toHaveTextContent('no-error')
  })
})