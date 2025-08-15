import React, { useState, useEffect } from 'react'
import {
  Box,
  TextField,
  InputAdornment,
  IconButton,
  Chip,
  Typography,
  Collapse
} from '@mui/material'
import {
  Search,
  Clear,
  KeyboardArrowUp,
  KeyboardArrowDown
} from '@mui/icons-material'

interface TextSearchBarProps {
  value: string
  onChange: (value: string) => void
  onSearch: (query: string) => void
  resultsCount?: number
  disabled?: boolean
  placeholder?: string
}

const TextSearchBar: React.FC<TextSearchBarProps> = ({
  value,
  onChange,
  onSearch,
  resultsCount = 0,
  disabled = false,
  placeholder = "Search in text..."
}) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const [currentResultIndex, setCurrentResultIndex] = useState(0)

  // Auto-expand when there's a search query
  useEffect(() => {
    if (value.trim()) {
      setIsExpanded(true)
    }
  }, [value])

  // Reset result index when results change
  useEffect(() => {
    setCurrentResultIndex(0)
  }, [resultsCount])

  const handleSearch = () => {
    onSearch(value)
  }

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleSearch()
    } else if (event.key === 'Escape') {
      handleClear()
    }
  }

  const handleClear = () => {
    onChange('')
    onSearch('')
    setIsExpanded(false)
    setCurrentResultIndex(0)
  }

  const handleToggleExpand = () => {
    setIsExpanded(!isExpanded)
    if (!isExpanded && value.trim()) {
      handleSearch()
    }
  }

  const handleNextResult = () => {
    if (resultsCount > 0) {
      setCurrentResultIndex((prev) => (prev + 1) % resultsCount)
    }
  }

  const handlePreviousResult = () => {
    if (resultsCount > 0) {
      setCurrentResultIndex((prev) => (prev - 1 + resultsCount) % resultsCount)
    }
  }

  return (
    <Box sx={{ width: '100%' }}>
      {/* Main search bar */}
      <TextField
        fullWidth
        size="small"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyPress}
        disabled={disabled}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <IconButton
                size="small"
                onClick={handleToggleExpand}
                disabled={disabled}
              >
                <Search />
              </IconButton>
            </InputAdornment>
          ),
          endAdornment: value && (
            <InputAdornment position="end">
              <IconButton
                size="small"
                onClick={handleClear}
                disabled={disabled}
              >
                <Clear />
              </IconButton>
            </InputAdornment>
          )
        }}
      />

      {/* Expanded search controls */}
      <Collapse in={isExpanded && value.trim().length > 0}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mt: 1,
            p: 1,
            bgcolor: 'grey.50',
            borderRadius: 1,
            border: 1,
            borderColor: 'grey.200'
          }}
        >
          {/* Results info */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {resultsCount > 0 ? (
              <>
                <Chip
                  label={`${currentResultIndex + 1} of ${resultsCount}`}
                  size="small"
                  variant="outlined"
                />
                <Typography variant="caption" color="text.secondary">
                  results found
                </Typography>
              </>
            ) : (
              <Typography variant="caption" color="text.secondary">
                {value.trim() ? 'No results found' : 'Enter search term'}
              </Typography>
            )}
          </Box>

          {/* Navigation controls */}
          {resultsCount > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <IconButton
                size="small"
                onClick={handlePreviousResult}
                disabled={disabled || resultsCount <= 1}
                title="Previous result"
              >
                <KeyboardArrowUp />
              </IconButton>
              <IconButton
                size="small"
                onClick={handleNextResult}
                disabled={disabled || resultsCount <= 1}
                title="Next result"
              >
                <KeyboardArrowDown />
              </IconButton>
            </Box>
          )}
        </Box>
      </Collapse>
    </Box>
  )
}

export default TextSearchBar