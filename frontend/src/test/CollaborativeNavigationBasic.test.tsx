import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import ParticipantIndicators from '../components/TextViewer/ParticipantIndicators'
import NavigationConflictDialog from '../components/TextViewer/NavigationConflictDialog'
import { ParticipantPosition, NavigationConflict } from '../types'

const theme = createTheme()

const mockParticipants: ParticipantPosition[] = [
  {
    userId: 'user-1',
    userName: 'Test User 1',
    currentRef: 'Genesis 1:1',
    timestamp: new Date(),
    isActive: true
  },
  {
    userId: 'user-2',
    userName: 'Test User 2',
    currentRef: 'Genesis 2:1',
    timestamp: new Date(),
    isActive: true
  }
]

const mockConflict: NavigationConflict = {
  sessionId: 'test-session',
  conflictingRefs: [
    {
      ref: 'Genesis 1:1',
      participants: [{ userId: 'user-1', userName: 'User One' }]
    },
    {
      ref: 'Genesis 2:1',
      participants: [{ userId: 'user-2', userName: 'User Two' }]
    }
  ],
  timestamp: new Date()
}

describe('Collaborative Navigation Components', () => {
  it('renders ParticipantIndicators without crashing', () => {
    render(
      <ThemeProvider theme={theme}>
        <ParticipantIndicators
          participants={mockParticipants}
          currentRef="Genesis 1:1"
          currentUserId="current-user"
        />
      </ThemeProvider>
    )
  })

  it('renders NavigationConflictDialog without crashing', () => {
    render(
      <ThemeProvider theme={theme}>
        <NavigationConflictDialog
          open={true}
          conflict={mockConflict}
          onResolve={vi.fn()}
          onCancel={vi.fn()}
        />
      </ThemeProvider>
    )
  })

  it('renders NavigationConflictDialog closed', () => {
    render(
      <ThemeProvider theme={theme}>
        <NavigationConflictDialog
          open={false}
          conflict={null}
          onResolve={vi.fn()}
          onCancel={vi.fn()}
        />
      </ThemeProvider>
    )
  })
})