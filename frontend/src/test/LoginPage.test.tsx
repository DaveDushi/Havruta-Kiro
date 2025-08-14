import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '../contexts/AuthContext'
import LoginPage from '../pages/LoginPage'

// Mock the auth service
vi.mock('../services/authService', () => ({
  default: {
    isAuthenticated: vi.fn(() => false),
    getCurrentUser: vi.fn(),
    initiateOAuthLogin: vi.fn(),
    handleOAuthCallback: vi.fn(),
    logout: vi.fn(),
  },
}))

const renderLoginPage = () => {
  return render(
    <BrowserRouter>
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    </BrowserRouter>
  )
}

describe('LoginPage', () => {
  it('renders login form with OAuth buttons', () => {
    renderLoginPage()

    expect(screen.getByText('Welcome to Havruta')).toBeInTheDocument()
    expect(screen.getByText('Collaborative Jewish Text Study')).toBeInTheDocument()
    expect(screen.getByText('Continue with Google')).toBeInTheDocument()
    expect(screen.getByText('Continue with Apple')).toBeInTheDocument()
  })

  it('handles Google login button click', () => {
    renderLoginPage()

    const googleButton = screen.getByText('Continue with Google')
    fireEvent.click(googleButton)

    // The button should be disabled during loading
    expect(googleButton).toBeDisabled()
  })

  it('handles Apple login button click', () => {
    renderLoginPage()

    const appleButton = screen.getByText('Continue with Apple')
    fireEvent.click(appleButton)

    // The button should be disabled during loading
    expect(appleButton).toBeDisabled()
  })

  it('displays terms and privacy policy text', () => {
    renderLoginPage()

    expect(screen.getByText(/By signing in, you agree to our Terms of Service and Privacy Policy/)).toBeInTheDocument()
  })
})