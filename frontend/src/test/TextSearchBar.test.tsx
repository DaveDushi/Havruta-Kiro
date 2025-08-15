import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import TextSearchBar from '../components/TextViewer/TextSearchBar'

describe('TextSearchBar', () => {
  const user = userEvent.setup()
  
  const defaultProps = {
    value: '',
    onChange: vi.fn(),
    onSearch: vi.fn(),
    resultsCount: 0,
    disabled: false
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Basic Rendering', () => {
    it('renders search input with placeholder', () => {
      render(<TextSearchBar {...defaultProps} />)
      
      expect(screen.getByPlaceholderText('Search in text...')).toBeInTheDocument()
    })

    it('renders with custom placeholder', () => {
      render(
        <TextSearchBar 
          {...defaultProps} 
          placeholder="Custom search placeholder"
        />
      )
      
      expect(screen.getByPlaceholderText('Custom search placeholder')).toBeInTheDocument()
    })

    it('displays current value', () => {
      render(<TextSearchBar {...defaultProps} value="test query" />)
      
      const input = screen.getByDisplayValue('test query')
      expect(input).toBeInTheDocument()
    })

    it('shows search icon', () => {
      render(<TextSearchBar {...defaultProps} />)
      
      const searchIcon = screen.getByRole('button')
      expect(searchIcon).toBeInTheDocument()
    })
  })

  describe('Search Functionality', () => {
    it('calls onChange when typing in input', async () => {
      const onChange = vi.fn()
      
      render(<TextSearchBar {...defaultProps} onChange={onChange} />)
      
      const input = screen.getByPlaceholderText('Search in text...')
      await user.type(input, 'search term')
      
      expect(onChange).toHaveBeenCalledTimes(11) // One call per character
      expect(onChange).toHaveBeenLastCalledWith('search term')
    })

    it('calls onSearch when Enter is pressed', async () => {
      const onSearch = vi.fn()
      
      render(
        <TextSearchBar 
          {...defaultProps} 
          value="test query"
          onSearch={onSearch}
        />
      )
      
      const input = screen.getByDisplayValue('test query')
      await user.type(input, '{Enter}')
      
      expect(onSearch).toHaveBeenCalledWith('test query')
    })

    it('calls onSearch when search icon is clicked', async () => {
      const onSearch = vi.fn()
      
      render(
        <TextSearchBar 
          {...defaultProps} 
          value="click search"
          onSearch={onSearch}
        />
      )
      
      const searchButton = screen.getByRole('button')
      await user.click(searchButton)
      
      expect(onSearch).toHaveBeenCalledWith('click search')
    })

    it('expands search controls when there is a search query', () => {
      render(<TextSearchBar {...defaultProps} value="test" />)
      
      // Should show expanded controls
      expect(screen.getByText('Enter search term')).toBeInTheDocument()
    })

    it('shows clear button when there is a value', () => {
      render(<TextSearchBar {...defaultProps} value="test" />)
      
      const clearButton = screen.getByRole('button', { name: /clear/i })
      expect(clearButton).toBeInTheDocument()
    })

    it('clears search when clear button is clicked', async () => {
      const onChange = vi.fn()
      const onSearch = vi.fn()
      
      render(
        <TextSearchBar 
          {...defaultProps} 
          value="test query"
          onChange={onChange}
          onSearch={onSearch}
        />
      )
      
      const clearButton = screen.getByRole('button', { name: /clear/i })
      await user.click(clearButton)
      
      expect(onChange).toHaveBeenCalledWith('')
      expect(onSearch).toHaveBeenCalledWith('')
    })

    it('clears search when Escape is pressed', async () => {
      const onChange = vi.fn()
      const onSearch = vi.fn()
      
      render(
        <TextSearchBar 
          {...defaultProps} 
          value="test query"
          onChange={onChange}
          onSearch={onSearch}
        />
      )
      
      const input = screen.getByDisplayValue('test query')
      await user.type(input, '{Escape}')
      
      expect(onChange).toHaveBeenCalledWith('')
      expect(onSearch).toHaveBeenCalledWith('')
    })
  })

  describe('Results Display', () => {
    it('shows results count when results are found', () => {
      render(
        <TextSearchBar 
          {...defaultProps} 
          value="test"
          resultsCount={5}
        />
      )
      
      expect(screen.getByText('1 of 5')).toBeInTheDocument()
      expect(screen.getByText('results found')).toBeInTheDocument()
    })

    it('shows no results message when no results found', () => {
      render(
        <TextSearchBar 
          {...defaultProps} 
          value="test"
          resultsCount={0}
        />
      )
      
      expect(screen.getByText('No results found')).toBeInTheDocument()
    })

    it('shows navigation buttons when there are multiple results', () => {
      render(
        <TextSearchBar 
          {...defaultProps} 
          value="test"
          resultsCount={3}
        />
      )
      
      expect(screen.getByTitle('Previous result')).toBeInTheDocument()
      expect(screen.getByTitle('Next result')).toBeInTheDocument()
    })

    it('disables navigation buttons when there is only one result', () => {
      render(
        <TextSearchBar 
          {...defaultProps} 
          value="test"
          resultsCount={1}
        />
      )
      
      expect(screen.getByTitle('Previous result')).toBeDisabled()
      expect(screen.getByTitle('Next result')).toBeDisabled()
    })

    it('cycles through results when navigation buttons are clicked', async () => {
      render(
        <TextSearchBar 
          {...defaultProps} 
          value="test"
          resultsCount={3}
        />
      )
      
      // Should start at result 1 of 3
      expect(screen.getByText('1 of 3')).toBeInTheDocument()
      
      // Click next
      const nextButton = screen.getByTitle('Next result')
      await user.click(nextButton)
      
      expect(screen.getByText('2 of 3')).toBeInTheDocument()
      
      // Click next again
      await user.click(nextButton)
      
      expect(screen.getByText('3 of 3')).toBeInTheDocument()
      
      // Click next again (should cycle to 1)
      await user.click(nextButton)
      
      expect(screen.getByText('1 of 3')).toBeInTheDocument()
    })

    it('cycles backwards through results when previous button is clicked', async () => {
      render(
        <TextSearchBar 
          {...defaultProps} 
          value="test"
          resultsCount={3}
        />
      )
      
      // Should start at result 1 of 3
      expect(screen.getByText('1 of 3')).toBeInTheDocument()
      
      // Click previous (should cycle to last result)
      const previousButton = screen.getByTitle('Previous result')
      await user.click(previousButton)
      
      expect(screen.getByText('3 of 3')).toBeInTheDocument()
    })
  })

  describe('Disabled State', () => {
    it('disables input when disabled prop is true', () => {
      render(<TextSearchBar {...defaultProps} disabled />)
      
      const input = screen.getByPlaceholderText('Search in text...')
      expect(input).toBeDisabled()
    })

    it('disables all buttons when disabled prop is true', () => {
      render(
        <TextSearchBar 
          {...defaultProps} 
          value="test"
          resultsCount={3}
          disabled
        />
      )
      
      const buttons = screen.getAllByRole('button')
      buttons.forEach(button => {
        expect(button).toBeDisabled()
      })
    })
  })

  describe('Auto-expand Behavior', () => {
    it('auto-expands when value is provided', () => {
      render(<TextSearchBar {...defaultProps} value="auto expand" />)
      
      expect(screen.getByText('Enter search term')).toBeInTheDocument()
    })

    it('does not show expanded controls when value is empty', () => {
      render(<TextSearchBar {...defaultProps} value="" />)
      
      expect(screen.queryByText('Enter search term')).not.toBeInTheDocument()
    })

    it('resets result index when results count changes', () => {
      const { rerender } = render(
        <TextSearchBar 
          {...defaultProps} 
          value="test"
          resultsCount={3}
        />
      )
      
      // Navigate to second result
      const nextButton = screen.getByTitle('Next result')
      user.click(nextButton)
      
      // Change results count
      rerender(
        <TextSearchBar 
          {...defaultProps} 
          value="test"
          resultsCount={5}
        />
      )
      
      // Should reset to first result
      expect(screen.getByText('1 of 5')).toBeInTheDocument()
    })
  })
})