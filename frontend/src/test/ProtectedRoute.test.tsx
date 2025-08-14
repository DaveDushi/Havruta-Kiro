import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '../contexts/AuthContext'
import ProtectedRoute from '../components/ProtectedRoute'

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

const TestComponent = () => <div>Protected Content</div>
const LoginComponent = () => <div>Login Page</div>

const renderProtectedRoute = () => {
  return render(
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginComponent />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <TestComponent />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

describe('ProtectedRoute', () => {
  it('redirects to login when not authenticated', () => {
    renderProtectedRoute()
    // Should redirect to login page
    expect(screen.getByText('Login Page')).toBeInTheDocument()
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
  })
})