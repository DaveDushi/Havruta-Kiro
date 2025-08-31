# Implementation Plan

- [x] 1. Set up project structure and development environment






  - Create monorepo structure with frontend and backend directories
  - Initialize package.json files with required dependencies
  - Set up TypeScript configuration for both frontend and backend
  - Configure development scripts and build processes
  - _Requirements: Foundation for all requirements_

- [x] 2. Update database schema for enhanced session management







  - Update Havruta model to include ownerId and lastPlace fields
  - Modify Session model to track startingSection, endingSection, coverageRange, and type (scheduled/instant)
  - Add session status field and proper indexing for active session queries
  - Create database migration scripts for existing data
  - Update Prisma client generation and seed scripts with new session workflow data
  - _Requirements: 2.6, 2A.2, 3A.3, 3A.5, 5A.6, 3B.2_

- [x] 3. Create authentication system






  - Implement OAuth authentication service with Passport.js
  - Create JWT token generation and validation utilities
  - Build authentication middleware for protected routes
  - Write unit tests for authentication functions
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 4. Build user management API endpoints




  - Create REST endpoints for user registration and profile management
  - Implement user CRUD operations with database integration
  - Add input validation and error handling for user operations
  - Write integration tests for user API endpoints
  - _Requirements: 1.1, 1.3_

- [x] 5. Implement Sefaria API integration service




  - Create SefariaService class with methods for getText, getIndex, and getTextStructure
  - Implement HTTP client with error handling and retry logic
  - Add caching layer for frequently accessed texts
  - Write unit tests with mocked Sefaria API responses
  - _Requirements: 4.1, 4.3, 4.4_

- [x] 6. Build Havruta session management



- [x] 6.1 Create Havruta CRUD operations


  - Implement HavrutaService with create, join, and state management methods
  - Build REST endpoints for Havruta creation and participant management
  - Add validation for participant limits and permissions
  - Write unit tests for Havruta service methods
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 6.2 Implement session state management and lifecycle





  - Create session initialization logic that loads Havruta's lastPlace as starting section
  - Build session progress tracking that updates currentSection during navigation
  - Implement "End Session" functionality that saves coverage range and updates Havruta lastPlace
  - Create session participant management (join/leave) with owner privilege checks
  - Write integration tests for complete session lifecycle from creation to completion
  - _Requirements: 3.1, 3.2, 3.4, 3A.1, 3A.3, 3A.5, 3A.7_

- [x] 6.3 Implement instant session creation







  - Create instant session service that immediately creates and opens sessions
  - Build real-time notification system for instant session invitations
  - Implement one-click join functionality for instant session participants
  - Add validation to prevent multiple active sessions per Havruta
  - Write unit tests for instant session creation and notification flow
  - _Requirements: 5A.1, 5A.2, 5A.3, 5A.4, 5A.7_

- [ ] 6.4 Build session history and progress tracking


  - Implement session history storage with coverage ranges (e.g., "Genesis 1:1 to Genesis 2:1")
  - Create session history API endpoints with filtering and pagination
  - Build progress calculation service that tracks Havruta lastPlace updates
  - Add session type tracking (scheduled vs instant) in history
  - Write integration tests for session history and progress persistence
  - _Requirements: 3A.5, 3B.1, 3B.2, 3B.4, 5A.6_

- [x] 7. Create real-time synchronization system




- [x] 7.1 Set up WebSocket server with Socket.io


  - Configure Socket.io server with authentication middleware
  - Create room-based communication for Havruta sessions
  - Implement connection handling and error recovery
  - Write unit tests for WebSocket event handlers
  - _Requirements: 3.3, 4.2_


- [x] 7.2 Implement WebSocket session room management







  - Create WebSocketRoomService with room join/leave functionality
  - Implement session room state management using Redis for scalability
  - Build participant tracking and real-time join/leave notifications
  - Add automatic room cleanup for empty sessions after timeout
  - Write unit tests for room management and participant tracking
  - _Requirements: 10.1, 10.2, 10.3, 10.8_

- [ ] 7.3 Implement owner-based navigation synchronization through rooms

  - Update navigation sync to use room-based broadcasting
  - Build client-side handlers that sync all room participants to owner's navigation
  - Implement session progress updates that only save when owner navigates
  - Add real-time session end broadcasting to all room participants
  - Write integration tests for room-based navigation and progress saving
  - _Requirements: 2A.5, 2A.6, 3.4, 3A.3, 3A.4, 10.4, 10.5, 10.6_

- [ ] 7.4 Add WebSocket connection management and reconnection

  - Implement automatic reconnection logic for dropped WebSocket connections
  - Build session room rejoin functionality after reconnection
  - Add connection state tracking and heartbeat monitoring
  - Create fallback mechanisms for network interruptions
  - Write integration tests for connection drops and automatic recovery
  - _Requirements: 10.7_

- [x] 8. Build scheduling system







- [x] 8.1 Create recurring session logic



  - Implement RecurrencePattern model and validation
  - Build session generation logic for recurring patterns
  - Create background job system for session notifications
  - Write unit tests for recurrence calculation
  - _Requirements: 8.2, 8.3, 8.7_


- [x] 8.2 Implement scheduling API endpoints

  - Create REST endpoints for session scheduling and management
  - Build notification system for scheduled sessions
  - Add calendar integration capabilities
  - Write integration tests for scheduling workflows
  - _Requirements: 8.1, 8.4, 8.5, 8.6_

- [x] 9. Create frontend application foundation






- [x] 9.1 Set up React application with routing


  - Initialize React app with TypeScript and Material-UI
  - Configure React Router for navigation
  - Set up global state management with Context API or Redux
  - Create base layout components and styling
  - _Requirements: Foundation for all frontend requirements_



- [x] 9.2 Implement authentication components

  - Create OAuth login components for Google and Apple
  - Build authentication context and protected route components
  - Implement token storage and automatic refresh logic
  - Write unit tests for authentication components
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 10. Build user dashboard





- [x] 10.1 Create dashboard layout and navigation


  - Build main dashboard component with responsive design
  - Create navigation components for different sections
  - Implement user profile display and management
  - Write unit tests for dashboard components
  - _Requirements: 6.1, 6.3_

- [ ] 10.2 Implement enhanced Havruta management interface


  - Create Havruta cards showing book, participants, and current lastPlace location
  - Build "Start Instant Session" button alongside existing scheduling options
  - Implement active session indicators and "Join Active Session" functionality
  - Add session history viewer accessible from Havruta cards
  - Create "Next Up" section for scheduled sessions with instant session notifications
  - Write integration tests for instant session creation and joining workflows
  - _Requirements: 2A.1, 2A.2, 5A.1, 5A.3, 6.1, 6.2, 6.3_
-

- [x] 10.3 Create participant invitation system




  - Build invitation dialog component with email input validation
  - Implement email service for sending Havruta invitations
  - Create invitation token generation and validation system
  - Add database model and API endpoints for invitation management
  - Write unit tests for email validation and invitation logic
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7_

- [-] 11. Create text study interface


- [x] 11.1 Build text viewer component







  - Create responsive text display component for Hebrew and English
  - Implement text navigation controls and section jumping
  - Add text search and highlighting functionality
  - Write unit tests for text viewer interactions
  - _Requirements: 4.1, 4.2_

- [ ] 11.2 Implement owner-controlled collaborative navigation


  - Connect text viewer to owner-based synchronization system
  - Build UI indicators showing owner vs participant status
  - Implement "End Session" button visible only to session owner
  - Add session progress display showing coverage range and current location
  - Create automatic navigation sync that follows owner's movements
  - Write integration tests for owner-controlled navigation and session ending
  - _Requirements: 2A.5, 2A.6, 3.3, 3A.1, 3A.4, 4.2_

- [ ] 11.3 Build session history and progress UI


  - Create session history component showing past sessions with coverage ranges
  - Build session details view with date, duration, participants, and sections covered
  - Implement current session progress indicator showing starting point and current location
  - Add session type indicators (scheduled vs instant) in history display
  - Write unit tests for session history display and interaction
  - _Requirements: 3B.1, 3B.2, 3B.3, 3B.5, 3B.6_

- [ ] 12. Integrate WebRTC video calling









- [x] 12.1 Implement video call initialization


  - Create WebRTC peer connection management
  - Build video call UI components with controls
  - Implement automatic call start when joining sessions
  - Write unit tests for video call setup
  - _Requirements: 5.1, 5.2, 5.4_

- [x] 12.2 Add video call features and fallbacks


  - Implement audio-only mode toggle
  - Add call quality indicators and connection status
  - Build error handling and reconnection logic
  - Write integration tests for video call scenarios
  - _Requirements: 5.3, 5.5_

- [ ] 12.3 Integrate WebRTC with WebSocket session rooms

  - Coordinate WebRTC offer/answer exchange through session rooms
  - Implement ICE candidate sharing via WebSocket room broadcasts
  - Add WebRTC connection establishment when users join session rooms
  - Build video call state synchronization across room participants
  - Write integration tests for WebRTC coordination through WebSocket rooms
  - _Requirements: 10.9_

- [ ] 13. Create progress tracking system
- [ ] 13.1 Implement progress calculation and storage
  - Build progress tracking service with automatic updates
  - Create progress visualization components
  - Implement session history recording
  - Write unit tests for progress calculations
  - _Requirements: 7.1, 7.2, 7.3_

- [ ] 13.2 Build progress and history UI
  - Create progress dashboard with charts and statistics
  - Build session history viewer with filtering
  - Implement progress sharing and comparison features
  - Write integration tests for progress tracking workflows
  - _Requirements: 7.1, 7.2, 7.4_

- [x] 14. Add comprehensive error handling and logging





  - Implement global error boundaries in React components
  - Add comprehensive logging system for backend services
  - Create user-friendly error messages and recovery options
  - Build error monitoring and alerting system
  - _Requirements: All error handling acceptance criteria_

- [x] 15. Write end-to-end tests and performance optimization






  - Create Playwright tests for complete user workflows
  - Implement performance monitoring and optimization
  - Add load testing for concurrent user sessions
  - Optimize database queries and API response times
  - _Requirements: All requirements validation_

- [x] 16. Deploy and configure production environment






  - Set up production database and Redis instances
  - Configure environment variables and secrets management
  - Deploy application with CI/CD pipeline
  - Set up monitoring, logging, and backup systems
  - _Requirements: All requirements in production environment_