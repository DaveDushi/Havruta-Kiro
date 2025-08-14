import React from 'react'
import {
  Box,
  Typography,
  Paper,
  Avatar,
  Divider,
  List,
  ListItem,
  ListItemText,
} from '@mui/material'
import { useAuth } from '../contexts/AuthContext'

const ProfilePage: React.FC = () => {
  const { state: authState } = useAuth()

  if (!authState.user) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Typography variant="h6" color="text.secondary">
          No user information available
        </Typography>
      </Box>
    )
  }

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Profile
      </Typography>

      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <Avatar
            src={authState.user.profilePicture}
            sx={{ width: 80, height: 80, mr: 3 }}
          >
            {authState.user.name.charAt(0).toUpperCase()}
          </Avatar>
          <Box>
            <Typography variant="h5" gutterBottom>
              {authState.user.name}
            </Typography>
            <Typography color="text.secondary">
              {authState.user.email}
            </Typography>
          </Box>
        </Box>

        <Divider sx={{ my: 3 }} />

        <Typography variant="h6" gutterBottom>
          Account Information
        </Typography>
        
        <List>
          <ListItem>
            <ListItemText
              primary="User ID"
              secondary={authState.user.id}
            />
          </ListItem>
          <ListItem>
            <ListItemText
              primary="OAuth Provider"
              secondary={authState.user.oauthProvider}
            />
          </ListItem>
          <ListItem>
            <ListItemText
              primary="Member Since"
              secondary={new Date(authState.user.createdAt).toLocaleDateString()}
            />
          </ListItem>
          <ListItem>
            <ListItemText
              primary="Last Active"
              secondary={new Date(authState.user.lastActiveAt).toLocaleDateString()}
            />
          </ListItem>
        </List>
      </Paper>
    </Box>
  )
}

export default ProfilePage