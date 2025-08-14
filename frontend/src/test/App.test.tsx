import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from '../App'

describe('App Component', () => {
  it('renders login page by default when not authenticated', () => {
    render(<App />)
    const welcomeElement = screen.getByText(/Welcome to Havruta/i)
    expect(welcomeElement).toBeInTheDocument()
  })

  it('renders OAuth login buttons', () => {
    render(<App />)
    const googleButton = screen.getByText(/Continue with Google/i)
    const appleButton = screen.getByText(/Continue with Apple/i)
    expect(googleButton).toBeInTheDocument()
    expect(appleButton).toBeInTheDocument()
  })

  it('renders the subtitle', () => {
    render(<App />)
    const subtitle = screen.getByText('Collaborative Jewish Text Study')
    expect(subtitle).toBeInTheDocument()
  })
})