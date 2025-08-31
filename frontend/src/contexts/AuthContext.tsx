import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react'
import { User, AuthState } from '../types'
import authService from '../services/authService'

// Action types
type AuthAction =
  | { type: 'LOGIN_START' }
  | { type: 'LOGIN_SUCCESS'; payload: User }
  | { type: 'LOGIN_FAILURE'; payload: string }
  | { type: 'LOGOUT' }
  | { type: 'CLEAR_ERROR' }

// Initial state
const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
}

// Auth reducer
const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case 'LOGIN_START':
      return {
        ...state,
        isLoading: true,
        error: null,
      }
    case 'LOGIN_SUCCESS':
      return {
        ...state,
        user: action.payload,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      }
    case 'LOGIN_FAILURE':
      return {
        ...state,
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: action.payload,
      }
    case 'LOGOUT':
      return {
        ...state,
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      }
    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null,
      }
    default:
      return state
  }
}

// Context type
interface AuthContextType {
  state: AuthState
  login: (provider: 'google' | 'apple') => Promise<void>
  handleOAuthCallback: (code: string, provider: 'google' | 'apple') => Promise<void>
  logout: () => void
  clearError: () => void
}

// Create context
export const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Provider component
interface AuthProviderProps {
  children: ReactNode
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState)

  // Check for existing authentication on mount
  useEffect(() => {
    const checkAuth = async () => {
      if (authService.isAuthenticated()) {
        dispatch({ type: 'LOGIN_START' })
        try {
          const user = await authService.getCurrentUser()
          if (user) {
            dispatch({ type: 'LOGIN_SUCCESS', payload: user })
          } else {
            authService.logout()
            dispatch({ type: 'LOGOUT' })
          }
        } catch (error) {
          authService.logout()
          dispatch({ type: 'LOGOUT' })
        }
      }
    }

    checkAuth()
  }, [])

  const login = async (provider: 'google' | 'apple') => {
    dispatch({ type: 'LOGIN_START' })
    try {
      await authService.initiateOAuthLogin(provider)
    } catch (error) {
      dispatch({ 
        type: 'LOGIN_FAILURE', 
        payload: error instanceof Error ? error.message : 'Login failed' 
      })
    }
  }

  const handleOAuthCallback = async (code: string, provider: 'google' | 'apple') => {
    dispatch({ type: 'LOGIN_START' })
    try {
      const { user } = await authService.handleOAuthCallback(code, provider)
      dispatch({ type: 'LOGIN_SUCCESS', payload: user })
    } catch (error) {
      dispatch({ 
        type: 'LOGIN_FAILURE', 
        payload: error instanceof Error ? error.message : 'Authentication failed' 
      })
    }
  }

  const logout = () => {
    authService.logout()
    dispatch({ type: 'LOGOUT' })
  }

  const clearError = () => {
    dispatch({ type: 'CLEAR_ERROR' })
  }

  const value: AuthContextType = {
    state,
    login,
    handleOAuthCallback,
    logout,
    clearError,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

// Custom hook to use auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}