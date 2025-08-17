import React, { useState, useEffect } from 'react'
import {
  Snackbar,
  Alert,
  AlertTitle,
  Button,
  Box,
  IconButton,
  Slide,
  SlideProps
} from '@mui/material'
import { Close as CloseIcon } from '@mui/icons-material'
import { 
  ErrorNotification, 
  errorNotificationManager 
} from '../utils/errorHandler'

function SlideTransition(props: SlideProps) {
  return <Slide {...props} direction="up" />
}

export const ErrorNotifications: React.FC = () => {
  const [notifications, setNotifications] = useState<ErrorNotification[]>([])

  useEffect(() => {
    const unsubscribe = errorNotificationManager.subscribe(setNotifications)
    return unsubscribe
  }, [])

  const handleClose = (id: string) => {
    errorNotificationManager.removeNotification(id)
  }

  const handleAction = (notification: ErrorNotification) => {
    if (notification.action) {
      notification.action.handler()
    }
  }

  return (
    <Box>
      {notifications.map((notification, index) => (
        <Snackbar
          key={notification.id}
          open={true}
          autoHideDuration={notification.autoHide ? notification.duration : null}
          onClose={() => handleClose(notification.id)}
          TransitionComponent={SlideTransition}
          anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
          sx={{
            mt: index * 7, // Stack notifications
            maxWidth: 500
          }}
        >
          <Alert
            severity={notification.type}
            variant="filled"
            sx={{ width: '100%' }}
            action={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {notification.action && (
                  <Button
                    color="inherit"
                    size="small"
                    onClick={() => handleAction(notification)}
                    sx={{ 
                      color: 'white',
                      '&:hover': {
                        backgroundColor: 'rgba(255, 255, 255, 0.1)'
                      }
                    }}
                  >
                    {notification.action.label}
                  </Button>
                )}
                <IconButton
                  size="small"
                  aria-label="close"
                  color="inherit"
                  onClick={() => handleClose(notification.id)}
                  sx={{ 
                    color: 'white',
                    '&:hover': {
                      backgroundColor: 'rgba(255, 255, 255, 0.1)'
                    }
                  }}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Box>
            }
          >
            <AlertTitle>{notification.title}</AlertTitle>
            {notification.message}
          </Alert>
        </Snackbar>
      ))}
    </Box>
  )
}

export default ErrorNotifications