import React from 'react'
import {
  Box,
  Chip,
  Avatar,
  Tooltip,
  Typography,
  Paper,
  useTheme
} from '@mui/material'
import {
  Visibility,
  VisibilityOff
} from '@mui/icons-material'
import { ParticipantPosition } from '../../types'

interface ParticipantIndicatorsProps {
  participants: ParticipantPosition[]
  currentRef: string
  currentUserId?: string
}

const ParticipantIndicators: React.FC<ParticipantIndicatorsProps> = ({
  participants,
  currentRef,
  currentUserId
}) => {
  const theme = useTheme()

  // Filter out current user and inactive participants
  const otherParticipants = participants.filter(p => 
    p.userId !== currentUserId && p.isActive
  )

  // Participants on the same section
  const participantsOnSameSection = otherParticipants.filter(p => 
    p.currentRef === currentRef
  )

  // Participants on different sections
  const participantsOnDifferentSections = otherParticipants.filter(p => 
    p.currentRef !== currentRef && p.currentRef
  )

  if (otherParticipants.length === 0) {
    return null
  }

  const getParticipantColor = (userId: string): string => {
    // Generate consistent colors for participants
    const colors = [
      theme.palette.primary.main,
      theme.palette.secondary.main,
      theme.palette.error.main,
      theme.palette.warning.main,
      theme.palette.info.main,
      theme.palette.success.main,
    ]
    
    const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
    return colors[hash % colors.length]
  }

  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <Paper
      elevation={2}
      sx={{
        position: 'absolute',
        top: 16,
        right: 16,
        p: 2,
        minWidth: 200,
        maxWidth: 300,
        zIndex: 1000,
        backgroundColor: 'background.paper',
        border: 1,
        borderColor: 'divider'
      }}
    >
      <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>
        Study Partners
      </Typography>

      {/* Participants on same section */}
      {participantsOnSameSection.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            On this section:
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {participantsOnSameSection.map((participant) => (
              <Tooltip
                key={participant.userId}
                title={`${participant.userName} is viewing ${participant.currentRef}`}
              >
                <Chip
                  avatar={
                    <Avatar
                      sx={{
                        bgcolor: getParticipantColor(participant.userId),
                        width: 24,
                        height: 24,
                        fontSize: '0.75rem'
                      }}
                    >
                      {getInitials(participant.userName)}
                    </Avatar>
                  }
                  label={participant.userName}
                  size="small"
                  variant="outlined"
                  sx={{
                    borderColor: getParticipantColor(participant.userId)
                  }}
                />
              </Tooltip>
            ))}
          </Box>
        </Box>
      )}

      {/* Participants on different sections */}
      {participantsOnDifferentSections.length > 0 && (
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            On other sections:
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {participantsOnDifferentSections.map((participant) => (
              <Tooltip
                key={participant.userId}
                title={`Click to navigate to ${participant.currentRef}`}
              >
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    p: 1,
                    borderRadius: 1,
                    cursor: 'pointer',
                    '&:hover': {
                      backgroundColor: 'action.hover'
                    }
                  }}
                >
                  <Avatar
                    sx={{
                      bgcolor: getParticipantColor(participant.userId),
                      width: 20,
                      height: 20,
                      fontSize: '0.7rem'
                    }}
                  >
                    {getInitials(participant.userName)}
                  </Avatar>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="caption" sx={{ fontWeight: 'medium' }}>
                      {participant.userName}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{
                        display: 'block',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {participant.currentRef}
                    </Typography>
                  </Box>
                  <VisibilityOff
                    sx={{
                      fontSize: 16,
                      color: 'text.secondary'
                    }}
                  />
                </Box>
              </Tooltip>
            ))}
          </Box>
        </Box>
      )}

      {/* Connection status */}
      <Box sx={{ mt: 2, pt: 1, borderTop: 1, borderColor: 'divider' }}>
        <Typography variant="caption" color="text.secondary">
          {otherParticipants.length} participant{otherParticipants.length !== 1 ? 's' : ''} connected
        </Typography>
      </Box>
    </Paper>
  )
}

export default ParticipantIndicators