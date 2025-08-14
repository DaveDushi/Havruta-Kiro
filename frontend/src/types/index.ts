// User types
export interface User {
  id: string
  email: string
  name: string
  profilePicture?: string
  oauthProvider: 'google' | 'apple'
  oauthId: string
  createdAt: Date
  lastActiveAt: Date
}

// Authentication types
export interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
}

// Havruta types
export interface Havruta {
  id: string
  name: string
  bookId: string
  bookTitle: string
  creatorId: string
  participants: string[]
  currentSection: string
  isActive: boolean
  createdAt: Date
  lastStudiedAt: Date
  totalSessions: number
}

// Session types
export interface Session {
  id: string
  havrutaId: string
  startTime: Date
  endTime?: Date
  participantIds: string[]
  sectionsStudied: string[]
  isRecurring: boolean
  recurrencePattern?: RecurrencePattern
}

export interface RecurrencePattern {
  frequency: 'once' | 'daily' | 'weekly' | 'bi-weekly' | 'monthly'
  interval: number
  endDate?: Date
  daysOfWeek?: number[]
}

// Progress types
export interface Progress {
  id: string
  userId: string
  havrutaId: string
  sectionsCompleted: string[]
  lastSection: string
  totalTimeStudied: number
  updatedAt: Date
}