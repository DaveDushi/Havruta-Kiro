import React from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Chip,
  Divider,
  useTheme
} from '@mui/material'
import {
  Warning,
  Group,
  Navigation
} from '@mui/icons-material'
import { NavigationConflict } from '../../types'

interface NavigationConflictDialogProps {
  open: boolean
  conflict: NavigationConflict | null
  onResolve: (chosenRef: string) => void
  onCancel: () => void
}

const NavigationConflictDialog: React.FC<NavigationConflictDialogProps> = ({
  open,
  conflict,
  onResolve,
  onCancel
}) => {
  const theme = useTheme()

  if (!conflict) {
    return null
  }

  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const getParticipantColor = (userId: string): string => {
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

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          boxShadow: theme.shadows[8]
        }
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Warning color="warning" />
          <Typography variant="h6" component="span">
            Navigation Conflict
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Multiple participants are trying to navigate to different sections. 
          Choose which section everyone should view together.
        </Typography>

        <List sx={{ bgcolor: 'background.paper' }}>
          {conflict.conflictingRefs.map((conflictRef, index) => (
            <React.Fragment key={conflictRef.ref}>
              <ListItem
                sx={{
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                  mb: 1,
                  cursor: 'pointer',
                  '&:hover': {
                    backgroundColor: 'action.hover'
                  }
                }}
                onClick={() => onResolve(conflictRef.ref)}
              >
                <ListItemAvatar>
                  <Avatar sx={{ bgcolor: 'primary.main' }}>
                    <Navigation />
                  </Avatar>
                </ListItemAvatar>
                
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 'medium' }}>
                        {conflictRef.ref}
                      </Typography>
                      <Chip
                        size="small"
                        label={`${conflictRef.participants.length} participant${conflictRef.participants.length !== 1 ? 's' : ''}`}
                        variant="outlined"
                      />
                    </Box>
                  }
                  secondary={
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {conflictRef.participants.map((participant) => (
                        <Chip
                          key={participant.userId}
                          avatar={
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
                          }
                          label={participant.userName}
                          size="small"
                          variant="outlined"
                          sx={{
                            height: 24,
                            '& .MuiChip-label': {
                              fontSize: '0.7rem'
                            }
                          }}
                        />
                      ))}
                    </Box>
                  }
                />
              </ListItem>
              
              {index < conflict.conflictingRefs.length - 1 && (
                <Divider sx={{ my: 1 }} />
              )}
            </React.Fragment>
          ))}
        </List>

        <Box
          sx={{
            mt: 2,
            p: 2,
            bgcolor: 'info.light',
            borderRadius: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 1
          }}
        >
          <Group color="info" />
          <Typography variant="caption" color="info.dark">
            Click on any section above to navigate all participants there
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onCancel} color="inherit">
          Cancel
        </Button>
        <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
          Navigation is locked until resolved
        </Typography>
      </DialogActions>
    </Dialog>
  )
}

export default NavigationConflictDialog