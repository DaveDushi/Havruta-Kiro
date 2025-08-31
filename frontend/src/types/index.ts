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
  ownerId: string
  owner: {
    id: string
    name: string
    email: string
    profilePicture?: string
  }
  participants: Array<{
    user: {
      id: string
      name: string
      email: string
      profilePicture?: string
    }
  }>
  lastPlace: string
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

// Sefaria types
export interface SefariaText {
  ref: string
  heRef: string
  text: string[]
  he: string[]
  versions: SefariaVersion[]
  textDepth: number
  sectionNames: string[]
  addressTypes: string[]
  next?: string | null
  prev?: string | null
  book: string
  title: string
  heTitle: string
  categories: string[]
  primary_category: string
  sections: number[]
  toSections: number[]
  sectionRef: string
  heSectionRef: string
  firstAvailableSectionRef: string
  isSpanning: boolean
  spanningRefs: string[]
}

export interface SefariaVersion {
  title?: string
  versionTitle: string
  versionSource?: string
  status: string
  priority: number | string
  license?: string
  versionNotes?: string
  formatAsPoetry?: boolean | string
  digitizedBySefaria?: boolean | string
  method?: string
  heversionSource?: string
  versionUrl?: string
  versionTitleInHebrew?: string
  versionNotesInHebrew?: string
  shortVersionTitle?: string
  shortVersionTitleInHebrew?: string
  extendedNotes?: string
  extendedNotesHebrew?: string
  purchaseInformationImage?: string
  purchaseInformationURL?: string
  hasManuallyWrappedRefs?: string
  actualLanguage?: string
  languageFamilyName?: string
  isSource?: boolean
  isPrimary?: boolean
  direction?: string
  language?: string
  text?: string[] | string[][]
  firstSectionRef?: string
}

export interface SefariaIndex {
  title: string
  heTitle: string
  categories: string[]
  primary_category: string
  enDesc?: string
  heDesc?: string
  compDate?: string
  compPlace?: string
  pubDate?: string
  pubPlace?: string
  era?: string
}

export interface SefariaTextStructure {
  title: string
  heTitle: string
  titleVariants: string[]
  sectionNames: string[]
  addressTypes: string[]
  depth: number
  textDepth: number
  lengths: number[]
  schema: any
}

export interface SefariaSearchResult {
  ref: string
  heRef: string
  text: string
  he: string
  version: string
  lang: string
}

export interface SefariaLink {
  ref: string
  heRef: string
  anchorRef: string
  anchorHeRef: string
  type: string
  category: string
}

// Text viewer types
export interface TextSection {
  ref: string
  heRef: string
  text: string[]
  he: string[]
  sectionIndex: number
  chapterIndex?: number
  verseIndex?: number
}

export interface TextNavigation {
  currentRef: string
  availableSections: string[]
  hasNext: boolean
  hasPrevious: boolean
  nextRef?: string
  previousRef?: string
}

export interface SearchHighlight {
  text: string
  startIndex: number
  endIndex: number
  ref: string
}

// Collaborative navigation types
export interface ParticipantPosition {
  userId: string
  userName: string
  currentRef: string
  timestamp: Date
  isActive: boolean
}

export interface NavigationEvent {
  sessionId: string
  userId: string
  userName: string
  newRef: string
  timestamp: Date
}

export interface NavigationConflict {
  sessionId: string
  conflictingRefs: Array<{
    ref: string
    participants: Array<{ userId: string, userName: string }>
  }>
  timestamp: Date
}

export interface CollaborativeState {
  isConnected: boolean
  sessionId: string | null
  participants: ParticipantPosition[]
  currentConflict: NavigationConflict | null
  isNavigationLocked: boolean
}