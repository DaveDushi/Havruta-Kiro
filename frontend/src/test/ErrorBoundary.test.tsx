import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ErrorBoundary, withErrorBoundary } from '../components/ErrorBoundary'
import React from 'react'

// Mock fetch for error reporting
global.fetch = vi.fn()

// Component that throws an error
const ThrowError: React.FC<{ shouldThrow?: boolean }> = ({ shouldThrow = true }) => {
  if (shouldThrow) {
    throw new Error('Test error message')
  }
  return <div>No error</div>
}

// Component that throws an error on click
const ThrowErrorOnClick: React.FC = () => {
  const [shouldThrow, setShouldThrow] = React.useState(false)
  
  if (shouldThrow) {
    throw new Error('Click error')
  }
  
  return (
    <button onClick={() => setShouldThrow(true)}>
      Throw Error
    </button>
  )
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock console.error to avoid noise in tests
    vi.spyOn(console, 'error').mockImplementation(() => {})
    
    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      },
      writable: true,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should render children when there is no error', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>
    )

    expect(screen.getByText('No error')).toBeInTheDocument()
  })

  it('should render error UI when child component throws', () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    )

    expect(screen.getByText('Oops! Something went wrong')).toBeInTheDocument()
    expect(screen.getByText(/Test error message/)).toBeInTheDocument()
  })

  it('should display error ID', () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    )

    expect(screen.getByText(/Error ID:/)).toBeInTheDocument()
  })

  it('should have retry button that resets error state', async () => {
    let shouldThrow = true
    
    const TestComponent = () => {
      if (shouldThrow) {
        throw new Error('Test error')
      }
      return <div>No error</div>
    }

    const { rerender } = render(
      <ErrorBoundary>
        <TestComponent />
      </ErrorBoundary>
    )

    expect(screen.getByText('Oops! Something went wrong')).toBeInTheDocument()

    const retryButton = screen.getByText('Try Again')
    
    // Change the condition before clicking retry
    shouldThrow = false
    
    fireEvent.click(retryButton)

    // Re-render with the same component but different state
    rerender(
      <ErrorBoundary>
        <TestComponent />
      </ErrorBoundary>
    )

    await waitFor(() => {
      expect(screen.getByText('No error')).toBeInTheDocument()
    })
  })

  it('should have go home button', () => {
    // Mock window.location
    delete (window as any).location
    window.location = { href: '' } as any

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    )

    const homeButton = screen.getByText('Go to Dashboard')
    fireEvent.click(homeButton)

    expect(window.location.href).toBe('/dashboard')
  })

  it('should have report bug button that opens email', () => {
    // Mock window.open
    const mockOpen = vi.fn()
    window.open = mockOpen

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    )

    const reportButton = screen.getByText('Report Bug')
    fireEvent.click(reportButton)

    expect(mockOpen).toHaveBeenCalledWith(
      expect.stringContaining('mailto:support@havruta.app')
    )
  })

  it('should call custom onError handler when provided', () => {
    const mockOnError = vi.fn()

    render(
      <ErrorBoundary onError={mockOnError}>
        <ThrowError />
      </ErrorBoundary>
    )

    expect(mockOnError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        componentStack: expect.any(String)
      })
    )
  })

  it('should render custom fallback when provided', () => {
    const customFallback = <div>Custom error message</div>

    render(
      <ErrorBoundary fallback={customFallback}>
        <ThrowError />
      </ErrorBoundary>
    )

    expect(screen.getByText('Custom error message')).toBeInTheDocument()
    expect(screen.queryByText('Oops! Something went wrong')).not.toBeInTheDocument()
  })

  it('should show development error details in development mode', () => {
    const originalEnv = import.meta.env.NODE_ENV
    import.meta.env.NODE_ENV = 'development'

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    )

    expect(screen.getByText('Development Error Details:')).toBeInTheDocument()

    import.meta.env.NODE_ENV = originalEnv
  })

  it('should not show development error details in production mode', () => {
    const originalEnv = import.meta.env.NODE_ENV
    import.meta.env.NODE_ENV = 'production'

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    )

    expect(screen.queryByText('Development Error Details:')).not.toBeInTheDocument()

    import.meta.env.NODE_ENV = originalEnv
  })

  it('should attempt to report error to service in production', async () => {
    const originalEnv = import.meta.env.NODE_ENV
    import.meta.env.NODE_ENV = 'production'

    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true })
    } as Response)

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    )

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/errors/report',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          }),
          body: expect.stringContaining('Test error message')
        })
      )
    })

    import.meta.env.NODE_ENV = originalEnv
  })

  describe('withErrorBoundary HOC', () => {
    it('should wrap component with error boundary', () => {
      const TestComponent = () => <div>Test Component</div>
      const WrappedComponent = withErrorBoundary(TestComponent)

      render(<WrappedComponent />)

      expect(screen.getByText('Test Component')).toBeInTheDocument()
    })

    it('should catch errors in wrapped component', () => {
      const WrappedComponent = withErrorBoundary(ThrowError)

      render(<WrappedComponent />)

      expect(screen.getByText('Oops! Something went wrong')).toBeInTheDocument()
    })

    it('should use custom fallback in HOC', () => {
      const customFallback = <div>HOC Custom Fallback</div>
      const WrappedComponent = withErrorBoundary(ThrowError, customFallback)

      render(<WrappedComponent />)

      expect(screen.getByText('HOC Custom Fallback')).toBeInTheDocument()
    })

    it('should call custom onError in HOC', () => {
      const mockOnError = vi.fn()
      const WrappedComponent = withErrorBoundary(ThrowError, undefined, mockOnError)

      render(<WrappedComponent />)

      expect(mockOnError).toHaveBeenCalled()
    })
  })
})