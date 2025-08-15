import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect } from 'vitest'
import TextNavigationControls from '../components/TextViewer/TextNavigationControls'
import { TextNavigation } from '../types'

const mockNavigation: TextNavigation = {
  currentRef: 'Genesis 1',
  availableSections: ['Genesis 1', 'Genesis 2', 'Genesis 3'],
  hasNext: true,
  hasPrevious: false,
  nextRef: 'Genesis 2',
  previousRef: undefined
}

describe('TextNavigationControls', () => {
  const user = userEvent.setup()
  
  const defaultProps = {
    navigation: mockNavigation,
    onNavigate: vi.fn(),
    onJumpToSection: vi.fn(),
    disabled: false
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Basic Rendering', () => {
    it('renders navigation buttons', () => {
      render(<TextNavigationControls {...defaultProps} />)
      
      expect(screen.getByLabelText('Previous section')).toBeInTheDocument()
      expect(screen.getByLabelText('Next section')).toBeInTheDocument()
      expect(screen.getByLabelText('Jump to section')).toBeInTheDocument()
    })

    it('displays current reference', () => {
      render(<TextNavigationControls {...defaultProps} />)
      
      expect(screen.getByText('Genesis 1')).toBeInTheDocument()
    })

    it('shows sections menu when available sections exist', () => {
      render(<TextNavigationControls {...defaultProps} />)
      
      expect(screen.getByLabelText('Browse sections')).toBeInTheDocument()
    })

    it('hides sections menu when no available sections', () => {
      const navigationWithoutSections = {
        ...mockNavigation,
        availableSections: []
      }
      
      render(
        <TextNavigationControls 
          {...defaultProps} 
          navigation={navigationWithoutSections}
        />
      )
      
      expect(screen.queryByLabelText('Browse sections')).not.toBeInTheDocument()
    })
  })

  describe('Navigation Buttons', () => {
    it('enables next button when hasNext is true', () => {
      render(<TextNavigationControls {...defaultProps} />)
      
      const nextButton = screen.getByLabelText('Next section')
      expect(nextButton).not.toBeDisabled()
    })

    it('disables previous button when hasPrevious is false', () => {
      render(<TextNavigationControls {...defaultProps} />)
      
      const previousButton = screen.getByLabelText('Previous section')
      expect(previousButton).toBeDisabled()
    })

    it('calls onNavigate with next ref when next button clicked', async () => {
      const onNavigate = vi.fn()
      
      render(
        <TextNavigationControls 
          {...defaultProps} 
          onNavigate={onNavigate}
        />
      )
      
      const nextButton = screen.getByLabelText('Next section')
      await user.click(nextButton)
      
      expect(onNavigate).toHaveBeenCalledWith('Genesis 2')
    })

    it('calls onNavigate with previous ref when previous button clicked', async () => {
      const navigationWithPrevious = {
        ...mockNavigation,
        hasPrevious: true,
        previousRef: 'Genesis 0'
      }
      const onNavigate = vi.fn()
      
      render(
        <TextNavigationControls 
          {...defaultProps} 
          navigation={navigationWithPrevious}
          onNavigate={onNavigate}
        />
      )
      
      const previousButton = screen.getByLabelText('Previous section')
      await user.click(previousButton)
      
      expect(onNavigate).toHaveBeenCalledWith('Genesis 0')
    })

    it('disables all buttons when disabled prop is true', () => {
      render(<TextNavigationControls {...defaultProps} disabled />)
      
      expect(screen.getByLabelText('Previous section')).toBeDisabled()
      expect(screen.getByLabelText('Next section')).toBeDisabled()
      expect(screen.getByLabelText('Jump to section')).toBeDisabled()
    })
  })

  describe('Sections Menu', () => {
    it('opens sections menu when browse sections button clicked', async () => {
      render(<TextNavigationControls {...defaultProps} />)
      
      const browseButton = screen.getByLabelText('Browse sections')
      await user.click(browseButton)
      
      expect(screen.getByText('Genesis 1')).toBeInTheDocument()
      expect(screen.getByText('Genesis 2')).toBeInTheDocument()
      expect(screen.getByText('Genesis 3')).toBeInTheDocument()
    })

    it('highlights current section in menu', async () => {
      render(<TextNavigationControls {...defaultProps} />)
      
      const browseButton = screen.getByLabelText('Browse sections')
      await user.click(browseButton)
      
      // The current section should be selected/highlighted
      const menuItems = screen.getAllByRole('menuitem')
      const currentItem = menuItems.find(item => item.textContent === 'Genesis 1')
      expect(currentItem).toHaveAttribute('aria-selected', 'true')
    })

    it('calls onJumpToSection when section selected from menu', async () => {
      const onJumpToSection = vi.fn()
      
      render(
        <TextNavigationControls 
          {...defaultProps} 
          onJumpToSection={onJumpToSection}
        />
      )
      
      const browseButton = screen.getByLabelText('Browse sections')
      await user.click(browseButton)
      
      const genesis2Item = screen.getByText('Genesis 2')
      await user.click(genesis2Item)
      
      expect(onJumpToSection).toHaveBeenCalledWith('Genesis 2')
    })
  })

  describe('Jump to Section', () => {
    it('shows input field when jump button clicked', async () => {
      render(<TextNavigationControls {...defaultProps} />)
      
      const jumpButton = screen.getByTitle('Jump to section')
      await user.click(jumpButton)
      
      expect(screen.getByPlaceholderText('e.g., Genesis 2:5')).toBeInTheDocument()
      expect(screen.getByText('Go')).toBeInTheDocument()
      expect(screen.getByText('Cancel')).toBeInTheDocument()
    })

    it('calls onJumpToSection when Go button clicked with valid input', async () => {
      const onJumpToSection = vi.fn()
      
      render(
        <TextNavigationControls 
          {...defaultProps} 
          onJumpToSection={onJumpToSection}
        />
      )
      
      const jumpButton = screen.getByTitle('Jump to section')
      await user.click(jumpButton)
      
      const input = screen.getByPlaceholderText('e.g., Genesis 2:5')
      await user.type(input, 'Genesis 3:10')
      
      const goButton = screen.getByText('Go')
      await user.click(goButton)
      
      expect(onJumpToSection).toHaveBeenCalledWith('Genesis 3:10')
    })

    it('calls onJumpToSection when Enter pressed in input', async () => {
      const onJumpToSection = vi.fn()
      
      render(
        <TextNavigationControls 
          {...defaultProps} 
          onJumpToSection={onJumpToSection}
        />
      )
      
      const jumpButton = screen.getByTitle('Jump to section')
      await user.click(jumpButton)
      
      const input = screen.getByPlaceholderText('e.g., Genesis 2:5')
      await user.type(input, 'Genesis 4:1')
      await user.keyboard('{Enter}')
      
      expect(onJumpToSection).toHaveBeenCalledWith('Genesis 4:1')
    })

    it('cancels jump input when Cancel button clicked', async () => {
      render(<TextNavigationControls {...defaultProps} />)
      
      const jumpButton = screen.getByTitle('Jump to section')
      await user.click(jumpButton)
      
      const input = screen.getByPlaceholderText('e.g., Genesis 2:5')
      await user.type(input, 'Genesis 5')
      
      const cancelButton = screen.getByText('Cancel')
      await user.click(cancelButton)
      
      expect(screen.queryByPlaceholderText('e.g., Genesis 2:5')).not.toBeInTheDocument()
      expect(screen.getByTitle('Jump to section')).toBeInTheDocument()
    })

    it('cancels jump input when Escape pressed', async () => {
      render(<TextNavigationControls {...defaultProps} />)
      
      const jumpButton = screen.getByTitle('Jump to section')
      await user.click(jumpButton)
      
      const input = screen.getByPlaceholderText('e.g., Genesis 2:5')
      await user.type(input, 'Genesis 6')
      await user.keyboard('{Escape}')
      
      expect(screen.queryByPlaceholderText('e.g., Genesis 2:5')).not.toBeInTheDocument()
      expect(screen.getByTitle('Jump to section')).toBeInTheDocument()
    })

    it('disables Go button when input is empty', async () => {
      render(<TextNavigationControls {...defaultProps} />)
      
      const jumpButton = screen.getByTitle('Jump to section')
      await user.click(jumpButton)
      
      const goButton = screen.getByText('Go')
      expect(goButton).toBeDisabled()
    })

    it('enables Go button when input has content', async () => {
      render(<TextNavigationControls {...defaultProps} />)
      
      const jumpButton = screen.getByTitle('Jump to section')
      await user.click(jumpButton)
      
      const input = screen.getByPlaceholderText('e.g., Genesis 2:5')
      await user.type(input, 'Genesis 7')
      
      const goButton = screen.getByText('Go')
      expect(goButton).not.toBeDisabled()
    })
  })
})