import React, { createContext, useContext, useReducer, ReactNode } from 'react'
import { Havruta } from '../types'

// App state type
interface AppState {
  havrutot: Havruta[]
  currentHavruta: Havruta | null
  isLoading: boolean
  error: string | null
}

// Action types
type AppAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_HAVRUTOT'; payload: Havruta[] }
  | { type: 'SET_CURRENT_HAVRUTA'; payload: Havruta | null }
  | { type: 'ADD_HAVRUTA'; payload: Havruta }
  | { type: 'UPDATE_HAVRUTA'; payload: Havruta }
  | { type: 'REMOVE_HAVRUTA'; payload: string }

// Initial state
const initialState: AppState = {
  havrutot: [],
  currentHavruta: null,
  isLoading: false,
  error: null,
}

// App reducer
const appReducer = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload,
      }
    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
      }
    case 'SET_HAVRUTOT':
      return {
        ...state,
        havrutot: action.payload,
      }
    case 'SET_CURRENT_HAVRUTA':
      return {
        ...state,
        currentHavruta: action.payload,
      }
    case 'ADD_HAVRUTA':
      return {
        ...state,
        havrutot: [...state.havrutot, action.payload],
      }
    case 'UPDATE_HAVRUTA':
      return {
        ...state,
        havrutot: state.havrutot.map(h => 
          h.id === action.payload.id ? action.payload : h
        ),
        currentHavruta: state.currentHavruta?.id === action.payload.id 
          ? action.payload 
          : state.currentHavruta,
      }
    case 'REMOVE_HAVRUTA':
      return {
        ...state,
        havrutot: state.havrutot.filter(h => h.id !== action.payload),
        currentHavruta: state.currentHavruta?.id === action.payload 
          ? null 
          : state.currentHavruta,
      }
    default:
      return state
  }
}

// Context type
interface AppContextType {
  state: AppState
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  setHavrutot: (havrutot: Havruta[]) => void
  setCurrentHavruta: (havruta: Havruta | null) => void
  addHavruta: (havruta: Havruta) => void
  updateHavruta: (havruta: Havruta) => void
  removeHavruta: (id: string) => void
}

// Create context
const AppContext = createContext<AppContextType | undefined>(undefined)

// Provider component
interface AppProviderProps {
  children: ReactNode
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState)

  const setLoading = (loading: boolean) => {
    dispatch({ type: 'SET_LOADING', payload: loading })
  }

  const setError = (error: string | null) => {
    dispatch({ type: 'SET_ERROR', payload: error })
  }

  const setHavrutot = (havrutot: Havruta[]) => {
    dispatch({ type: 'SET_HAVRUTOT', payload: havrutot })
  }

  const setCurrentHavruta = (havruta: Havruta | null) => {
    dispatch({ type: 'SET_CURRENT_HAVRUTA', payload: havruta })
  }

  const addHavruta = (havruta: Havruta) => {
    dispatch({ type: 'ADD_HAVRUTA', payload: havruta })
  }

  const updateHavruta = (havruta: Havruta) => {
    dispatch({ type: 'UPDATE_HAVRUTA', payload: havruta })
  }

  const removeHavruta = (id: string) => {
    dispatch({ type: 'REMOVE_HAVRUTA', payload: id })
  }

  const value: AppContextType = {
    state,
    setLoading,
    setError,
    setHavrutot,
    setCurrentHavruta,
    addHavruta,
    updateHavruta,
    removeHavruta,
  }

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  )
}

// Custom hook to use app context
export const useApp = (): AppContextType => {
  const context = useContext(AppContext)
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider')
  }
  return context
}