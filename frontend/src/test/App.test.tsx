import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from '../App'

describe('App Component', () => {
  it('renders the main heading', () => {
    render(<App />)
    const heading = screen.getByText('Havruta Platform')
    expect(heading).toBeInTheDocument()
  })

  it('renders the subtitle', () => {
    render(<App />)
    const subtitle = screen.getByText('Collaborative Jewish Text Study')
    expect(subtitle).toBeInTheDocument()
  })
})