import React, { useState } from 'react'
import {
  Box,
  IconButton,
  Typography,
  TextField,
  Button,
  Tooltip,
  Chip,
  Menu,
  MenuItem,
  ListItemText
} from '@mui/material'
import {
  NavigateBefore,
  NavigateNext,
  Search,
  List as ListIcon
} from '@mui/icons-material'
import { TextNavigation } from '../../types'

interface TextNavigationControlsProps {
  navigation: TextNavigation
  onNavigate: (ref: string) => void
  onJumpToSection: (ref: string) => void
  disabled?: boolean
}

const TextNavigationControls: React.FC<TextNavigationControlsProps> = ({
  navigation,
  onNavigate,
  onJumpToSection,
  disabled = false
}) => {
  const [jumpToRef, setJumpToRef] = useState('')
  const [showJumpInput, setShowJumpInput] = useState(false)
  const [sectionsMenuAnchor, setSectionsMenuAnchor] = useState<null | HTMLElement>(null)

  const handlePrevious = () => {
    if (navigation.previousRef) {
      onNavigate(navigation.previousRef)
    }
  }

  const handleNext = () => {
    if (navigation.nextRef) {
      onNavigate(navigation.nextRef)
    }
  }

  const handleJumpSubmit = () => {
    if (jumpToRef.trim()) {
      onJumpToSection(jumpToRef.trim())
      setJumpToRef('')
      setShowJumpInput(false)
    }
  }

  const handleJumpKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleJumpSubmit()
    } else if (event.key === 'Escape') {
      setShowJumpInput(false)
      setJumpToRef('')
    }
  }

  const handleSectionsMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setSectionsMenuAnchor(event.currentTarget)
  }

  const handleSectionsMenuClose = () => {
    setSectionsMenuAnchor(null)
  }

  const handleSectionSelect = (ref: string) => {
    onJumpToSection(ref)
    handleSectionsMenuClose()
  }

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        p: 1,
        gap: 1,
        flexWrap: 'wrap'
      }}
    >
      {/* Left side - Navigation buttons */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Tooltip title="Previous section">
          <span>
            <IconButton
              onClick={handlePrevious}
              disabled={disabled || !navigation.hasPrevious}
              size="small"
            >
              <NavigateBefore />
            </IconButton>
          </span>
        </Tooltip>

        <Tooltip title="Next section">
          <span>
            <IconButton
              onClick={handleNext}
              disabled={disabled || !navigation.hasNext}
              size="small"
            >
              <NavigateNext />
            </IconButton>
          </span>
        </Tooltip>

        {/* Sections menu */}
        {navigation.availableSections.length > 0 && (
          <>
            <Tooltip title="Browse sections">
              <IconButton
                onClick={handleSectionsMenuOpen}
                disabled={disabled}
                size="small"
              >
                <ListIcon />
              </IconButton>
            </Tooltip>
            
            <Menu
              anchorEl={sectionsMenuAnchor}
              open={Boolean(sectionsMenuAnchor)}
              onClose={handleSectionsMenuClose}
              PaperProps={{
                style: {
                  maxHeight: 300,
                  width: '250px'
                }
              }}
            >
              {navigation.availableSections.map((sectionRef) => (
                <MenuItem
                  key={sectionRef}
                  onClick={() => handleSectionSelect(sectionRef)}
                  selected={sectionRef === navigation.currentRef}
                >
                  <ListItemText primary={sectionRef} />
                </MenuItem>
              ))}
            </Menu>
          </>
        )}
      </Box>

      {/* Center - Current reference */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Chip
          label={navigation.currentRef}
          variant="outlined"
          size="small"
          sx={{ fontFamily: 'monospace' }}
        />
      </Box>

      {/* Right side - Jump to section */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {showJumpInput ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TextField
              size="small"
              placeholder="e.g., Genesis 2:5"
              value={jumpToRef}
              onChange={(e) => setJumpToRef(e.target.value)}
              onKeyDown={handleJumpKeyPress}
              disabled={disabled}
              sx={{ width: 150 }}
              autoFocus
            />
            <Button
              size="small"
              onClick={handleJumpSubmit}
              disabled={disabled || !jumpToRef.trim()}
            >
              Go
            </Button>
            <Button
              size="small"
              onClick={() => {
                setShowJumpInput(false)
                setJumpToRef('')
              }}
              disabled={disabled}
            >
              Cancel
            </Button>
          </Box>
        ) : (
          <Tooltip title="Jump to section">
            <IconButton
              onClick={() => setShowJumpInput(true)}
              disabled={disabled}
              size="small"
            >
              <Search />
            </IconButton>
          </Tooltip>
        )}
      </Box>
    </Box>
  )
}

export default TextNavigationControls