# Design Document

## Overview

The Havruta platform is a real-time collaborative learning application that enables synchronized Jewish text study. The system architecture follows a client-server model with real-time communication capabilities, integrating with external services for authentication (OAuth providers), text content (Sefaria API), and video communication (WebRTC).

The platform consists of a web-based frontend application, a backend API server with real-time capabilities, and a database for user and session management. The design emphasizes real-time synchronization, scalability, and seamless user experience.

## Architecture

### High-Level Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        WEB[Web Application]
        VIDEO[WebRTC Video Client]
        SOCKET[Socket.io Client]
    end
    
    subgraph "Application Layer"
        API[REST API Server]
        WS[WebSocket Server with Session Rooms]
        AUTH[Authentication Service]
        ROOMS[Session Room Manager]
    end
    
    subgraph "Data Layer"
        DB[(PostgreSQL Database)]
        CACHE[(Redis Cache - Room State)]
    end
    
    subgraph "External Services"
        OAUTH[OAuth Providers]
        SEFARIA[Sefaria API]
    end
    
    WEB --> API
    SOCKET --> WS
    VIDEO --> SOCKET
    WS --> ROOMS
    ROOMS --> CACHE
    API --> AUTH
    API --> DB
    AUTH --> OAUTH
    API --> SEFARIA
    
    note1[Session Rooms handle:<br/>- User join/leave<br/>- Navigation sync<br/>- WebRTC coordination<br/>- Auto-reconnection]
    ROOMS -.-> note1
```

### Technology Stack

**Frontend:**
- React.js with TypeScript for the web application
- WebRTC for peer-to-peer video communication
- Socket.io client for real-time synchronization
- Material-UI or similar for consistent UI components

**Backend:**
- Node.js with Express.js for the REST API
- Socket.io for WebSocket connections and real-time features
- Passport.js for OAuth authentication
- Prisma ORM for database operations

**Database & Caching:**
- PostgreSQL for persistent data storage
- Redis for session management and real-time state caching

**External Integrations:**
- Sefaria API for Jewish text content
- OAuth providers (Google, Apple) for authentication

## Session Lifecycle and Workflow

### Havruta vs Session Distinction

**Havruta (Ongoing Partnership):**
- Persistent relationship between study partners (e.g., Isaac and Jacob)
- Tracks the book being studied (e.g., Genesis)
- Maintains the "last place" where they left off (e.g., Genesis 2:1)
- Has an owner (creator) whose navigation determines progress saving
- Contains multiple sessions over time

**Session (Individual Study Instance):**
- Temporary study period within a Havruta
- Opens automatically to the Havruta's "last place"
- Tracks coverage range for that specific session (e.g., Genesis 1:1 to Genesis 2:1)
- Can be scheduled or instant
- Ends when owner clicks "End Session" or auto-timeout occurs

### WebSocket Session Room Workflow

```mermaid
sequenceDiagram
    participant Owner as Isaac (Owner)
    participant Participant as Jacob
    participant WSServer as WebSocket Server
    participant SessionRoom as Session Room
    participant System

    Owner->>System: Click "Start Instant Session"
    System->>System: Create Session (ID: session-123)
    Owner->>WSServer: Connect & Join Room "session-123"
    WSServer->>SessionRoom: Add Isaac to room
    
    System->>Participant: Send real-time notification
    Participant->>System: Click "Join Now"
    Participant->>WSServer: Connect & Join Room "session-123"
    WSServer->>SessionRoom: Add Jacob to room
    WSServer->>Owner: Broadcast "Jacob joined"
    
    Owner->>WSServer: Navigate to Genesis 3:5
    WSServer->>SessionRoom: Broadcast navigation event
    WSServer->>Participant: Sync to Genesis 3:5
    
    Note over Owner, Participant: Optional WebRTC video coordination
    Owner->>WSServer: WebRTC offer for Jacob
    WSServer->>Participant: Forward WebRTC offer
    Participant->>WSServer: WebRTC answer
    WSServer->>Owner: Forward WebRTC answer
    
    Owner->>WSServer: Click "End Session"
    WSServer->>SessionRoom: Broadcast session end
    WSServer->>Participant: Notify session ended
    WSServer->>SessionRoom: Close room "session-123"
```

### Instant Session Creation

1. **Trigger:** User clicks "Start Instant Session" on Havruta card
2. **Validation:** Check no active session exists for this Havruta
3. **Creation:** Create session with type='instant', startingSection=havruta.lastPlace
4. **Notification:** Send real-time notifications to all participants
5. **Auto-open:** Creator automatically joins the session

## Components and Interfaces

### Frontend Components

#### Authentication Component
- **Purpose:** Handle OAuth login flow and session management
- **Key Methods:**
  - `initiateOAuthLogin(provider: string)`
  - `handleAuthCallback()`
  - `logout()`

#### Dashboard Component
- **Purpose:** Display user's Havrutot and provide session management
- **Key Methods:**
  - `fetchUserHavrutot()`
  - `createNewHavruta()`
  - `startInstantSession(havrutaId: string)` // New instant session feature
  - `joinActiveSession(sessionId: string)`
  - `scheduleSession(havrutaId: string)`
  - `inviteParticipants(havrutaId: string, emails: string[])`
  - `viewSessionHistory(havrutaId: string)`

#### Participant Invitation Dialog Component
- **Purpose:** Handle email-based participant invitations
- **Key Methods:**
  - `validateEmails(emails: string[])`
  - `sendInvitations(havrutaId: string, emails: string[])`
  - `handleInvitationResponse()`

#### Havruta Session Component
- **Purpose:** Main collaborative study interface
- **Key Methods:**
  - `initializeSession(sessionId: string)`
  - `syncTextNavigation(section: string)`
  - `initializeVideoCall()`
  - `endSession()` // Owner-only action
  - `trackSessionProgress(currentSection: string)`

#### Session Management Component
- **Purpose:** Handle session creation and lifecycle
- **Key Methods:**
  - `createInstantSession(havrutaId: string)`
  - `createScheduledSession(havrutaId: string, schedule: SessionSchedule)`
  - `joinSession(sessionId: string)`
  - `endSession(sessionId: string)` // Owner privilege check
  - `getSessionHistory(havrutaId: string)`

#### Text Viewer Component
- **Purpose:** Display and navigate Sefaria texts
- **Key Methods:**
  - `loadText(book: string, section: string)`
  - `navigateToSection(section: string)`
  - `syncWithParticipants()`

### Backend Services

#### Authentication Service
```typescript
interface AuthService {
  authenticateOAuth(provider: string, code: string): Promise<User>
  generateJWT(user: User): string
  validateJWT(token: string): Promise<User>
}
```

#### Havruta Service
```typescript
interface HavrutaService {
  createHavruta(creatorId: string, bookId: string, participants: string[]): Promise<Havruta>
  joinHavruta(userId: string, sessionId: string): Promise<void>
  getHavrutaState(havrutaId: string): Promise<HavrutaState>
  updateLastPlace(havrutaId: string, section: string, ownerId: string): Promise<void>
  inviteParticipants(havrutaId: string, emails: string[]): Promise<InvitationResult>
}

interface SessionService {
  createScheduledSession(havrutaId: string, scheduledTime: Date, recurrence?: RecurrencePattern): Promise<Session>
  createInstantSession(havrutaId: string, creatorId: string): Promise<Session>
  joinSession(sessionId: string, userId: string): Promise<void>
  endSession(sessionId: string, ownerId: string, finalSection: string): Promise<Session>
  getActiveSession(havrutaId: string): Promise<Session | null>
  getSessionHistory(havrutaId: string): Promise<Session[]>
  updateSessionProgress(sessionId: string, currentSection: string): Promise<void>
}
```

#### Email Service
```typescript
interface EmailService {
  sendHavrutaInvitation(email: string, havrutaDetails: HavrutaInvitation): Promise<void>
  validateEmailFormat(email: string): boolean
  checkExistingUser(email: string): Promise<User | null>
}

interface HavrutaInvitation {
  havrutaId: string
  havrutaName: string
  bookTitle: string
  inviterName: string
  joinLink: string
}

interface InvitationResult {
  successful: string[]
  failed: { email: string; reason: string }[]
  existingUsers: string[]
  newUsers: string[]
}
```

#### Sefaria Integration Service
```typescript
interface SefariaService {
  // Get index of all available texts
  getIndex(): Promise<SefariaIndex[]>
  
  // Get specific text content by reference (e.g., "Genesis 1:1-3")
  getText(ref: string): Promise<SefariaText>
  
  // Get text structure and table of contents
  getTextStructure(title: string): Promise<SefariaTextStructure>
  
  // Search texts
  searchTexts(query: string): Promise<SefariaSearchResult[]>
  
  // Get links between texts
  getLinks(ref: string): Promise<SefariaLink[]>
}

interface SefariaText {
  ref: string
  heRef: string
  text: string[]
  he: string[]
  versions: SefariaVersion[]
  textDepth: number
  sectionNames: string[]
  addressTypes: string[]
}

interface SefariaIndex {
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
```

#### WebSocket Session Room Service
```typescript
interface WebSocketRoomService {
  // Room management
  joinSessionRoom(sessionId: string, userId: string, socketId: string): Promise<void>
  leaveSessionRoom(sessionId: string, userId: string, socketId: string): Promise<void>
  getRoomParticipants(sessionId: string): Promise<string[]>
  
  // Real-time communication
  broadcastToRoom(sessionId: string, event: string, data: any, excludeUserId?: string): void
  broadcastNavigation(sessionId: string, section: string, navigatorId: string): void
  broadcastParticipantJoined(sessionId: string, userId: string): void
  broadcastParticipantLeft(sessionId: string, userId: string): void
  broadcastSessionEnd(sessionId: string, finalSection: string): void
  
  // Connection management
  handleReconnection(sessionId: string, userId: string, newSocketId: string): Promise<void>
  cleanupEmptyRooms(): Promise<void>
  
  // WebRTC coordination
  coordinateWebRTCOffer(sessionId: string, fromUserId: string, toUserId: string, offer: RTCSessionDescription): void
  coordinateWebRTCAnswer(sessionId: string, fromUserId: string, toUserId: string, answer: RTCSessionDescription): void
  coordinateICECandidate(sessionId: string, fromUserId: string, toUserId: string, candidate: RTCIceCandidate): void
}

interface SessionProgressService {
  updateSessionProgress(sessionId: string, currentSection: string, isOwner: boolean): void
  calculateCoverageRange(startSection: string, endSection: string): string
  saveHavrutaProgress(havrutaId: string, lastPlace: string, ownerId: string): Promise<void>
}
```

## Data Models

### User Model
```typescript
interface User {
  id: string
  email: string
  name: string
  profilePicture?: string
  oauthProvider: 'google' | 'apple'
  oauthId: string
  createdAt: Date
  lastActiveAt: Date
}
```

### Havruta Model
```typescript
interface Havruta {
  id: string
  name: string
  bookId: string
  bookTitle: string
  ownerId: string // Creator becomes the owner with special privileges
  participants: string[]
  lastPlace: string // Current location where they left off (e.g., "Genesis 2:1")
  isActive: boolean
  createdAt: Date
  lastStudiedAt: Date
  totalSessions: number
}
```

### Session Model
```typescript
interface Session {
  id: string
  havrutaId: string
  type: 'scheduled' | 'instant'
  startTime: Date
  endTime?: Date
  participantIds: string[]
  startingSection: string // Where the session began (e.g., "Genesis 1:1")
  endingSection?: string // Where the session ended (e.g., "Genesis 2:1")
  coverageRange?: string // Full range covered (e.g., "Genesis 1:1 to Genesis 2:1")
  isRecurring: boolean
  recurrencePattern?: RecurrencePattern
  status: 'scheduled' | 'active' | 'completed' | 'cancelled'
}
```

### RecurrencePattern Model
```typescript
interface RecurrencePattern {
  frequency: 'once' | 'daily' | 'weekly' | 'bi-weekly' | 'monthly'
  interval: number
  endDate?: Date
  daysOfWeek?: number[] // For weekly patterns
}
```

### Progress Model
```typescript
interface Progress {
  id: string
  userId: string
  havrutaId: string
  sectionsCompleted: string[]
  lastSection: string
  totalTimeStudied: number
  updatedAt: Date
}
```

### Invitation Model
```typescript
interface Invitation {
  id: string
  havrutaId: string
  inviterUserId: string
  inviteeEmail: string
  status: 'pending' | 'accepted' | 'declined' | 'expired'
  invitationToken: string
  createdAt: Date
  expiresAt: Date
  acceptedAt?: Date
}
```

## Error Handling

### Client-Side Error Handling
- **Network Errors:** Implement retry logic with exponential backoff for API calls
- **Authentication Errors:** Redirect to login page and clear invalid tokens
- **Video Call Errors:** Provide fallback to audio-only mode and connection retry
- **Synchronization Errors:** Implement conflict resolution for concurrent navigation
- **Email Validation Errors:** Provide real-time feedback for invalid email formats
- **Invitation Errors:** Display clear error messages for failed invitations with retry options

### Server-Side Error Handling
- **Database Errors:** Log errors and return appropriate HTTP status codes
- **External API Errors:** Implement circuit breaker pattern for Sefaria API calls
- **WebSocket Errors:** Handle connection drops and implement reconnection logic
- **Authentication Errors:** Return standardized error responses with clear messages
- **Email Service Errors:** Implement retry logic for failed email sends with exponential backoff
- **Invitation Token Errors:** Handle expired or invalid invitation tokens gracefully

### Error Response Format
```typescript
interface ErrorResponse {
  error: {
    code: string
    message: string
    details?: any
  }
  timestamp: string
  requestId: string
}
```

## Testing Strategy

### Unit Testing
- **Frontend:** Jest and React Testing Library for component testing
- **Backend:** Jest for service and utility function testing
- **Database:** Test database with seed data for repository testing

### Integration Testing
- **API Endpoints:** Supertest for HTTP endpoint testing
- **WebSocket Events:** Custom test utilities for real-time event testing
- **External Services:** Mock Sefaria API responses for consistent testing

### End-to-End Testing
- **User Flows:** Playwright for complete user journey testing
- **Real-time Features:** Multi-browser testing for synchronization features
- **Video Calling:** Automated testing of WebRTC connection establishment

### Performance Testing
- **Load Testing:** Test concurrent user sessions and real-time synchronization
- **Database Performance:** Query optimization and indexing validation
- **API Response Times:** Ensure sub-200ms response times for critical endpoints

### Test Data Management
- **Seed Data:** Consistent test data for development and testing environments
- **Test Users:** OAuth test accounts for authentication flow testing
- **Mock Services:** Local mocks for Sefaria API during development

### Continuous Integration
- **Automated Testing:** Run all test suites on pull requests
- **Code Coverage:** Maintain minimum 80% code coverage
- **Performance Monitoring:** Track API response times and error rates