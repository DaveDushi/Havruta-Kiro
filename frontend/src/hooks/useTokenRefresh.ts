import { useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import authService from '../services/authService'

export const useTokenRefresh = () => {
  const { logout } = useAuth()

  const refreshToken = useCallback(async () => {
    try {
      await authService.refreshAccessToken()
      return true
    } catch (error) {
      console.error('Token refresh failed:', error)
      logout()
      return false
    }
  }, [logout])

  useEffect(() => {
    // Set up automatic token refresh
    const interval = setInterval(() => {
      if (authService.isAuthenticated()) {
        refreshToken()
      }
    }, 15 * 60 * 1000) // Refresh every 15 minutes

    return () => clearInterval(interval)
  }, [refreshToken])

  return { refreshToken }
}