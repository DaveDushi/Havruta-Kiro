# Requirements Document

## Introduction

Havruta is a collaborative learning platform designed for paired or small-group Jewish text study. The platform enables users to connect with study partners and engage with Jewish texts from the Sefaria API in real-time learning sessions. The system combines traditional text study methods with modern technology, providing seamless authentication, synchronized text navigation, automatic progress tracking, and integrated video communication to create an immersive collaborative learning experience.

## Requirements

### Requirement 1

**User Story:** As a user, I want to sign in quickly and securely using OAuth providers, so that I can access the platform without creating yet another password.

#### Acceptance Criteria

1. WHEN a user visits the sign-in page THEN the system SHALL display OAuth options for Google
2. WHEN a user selects an OAuth provider THEN the system SHALL redirect to the provider's authentication flow
3. WHEN authentication is successful THEN the system SHALL create or update the user's profile and redirect to the dashboard
4. IF authentication fails THEN the system SHALL display an appropriate error message and allow retry

### Requirement 2

**User Story:** As a user, I want to create or join Havrutot (study partnerships) with other users, so that I can establish ongoing collaborative text study relationships.

#### Acceptance Criteria

1. WHEN a user creates a new Havruta THEN the system SHALL allow selection of a book from the Sefaria library
2. WHEN a user creates a new Havruta THEN the system SHALL allow invitation of 1 or more study partners
3. WHEN a user joins an existing Havruta THEN the system SHALL add them to the Havruta participant list
4. WHEN a Havruta is created THEN the system SHALL generate a unique Havruta identifier
5. WHEN a Havruta is created THEN the system SHALL initialize it with no active sessions
6. WHEN a Havruta is created THEN the system SHALL designate the creator as the "owner" with special privileges
7. IF a user tries to join a non-existent Havruta THEN the system SHALL display an error message

### Requirement 2A

**User Story:** As a user like Isaac or Jacob, I want to understand the difference between a Havruta (ongoing study partnership) and a session (individual study instance), so that I can effectively manage my collaborative learning.

#### Acceptance Criteria

1. WHEN a user views their dashboard THEN the system SHALL clearly show Havrutot as ongoing partnerships with persistent information (participants, book, current location)
2. WHEN a Havruta is displayed THEN the system SHALL show the book being studied (e.g., Genesis), participants (e.g., Isaac and Jacob), and current "last place" (e.g., Genesis 2:1)
3. WHEN a session is started THEN the system SHALL create a temporary study instance that opens to the Havruta's "last place"
4. WHEN a session is active THEN the system SHALL track the session's coverage range (starting location to current location)
5. WHEN the Havruta owner navigates during a session THEN the system SHALL update the potential "last place" that will be saved when the session ends
6. WHEN non-owner participants navigate during a session THEN the system SHALL sync their view but the owner's location determines the saved progress
7. WHEN a session ends THEN the system SHALL save the session's coverage range to session history and update the Havruta's "last place" to the owner's final location

### Requirement 3

**User Story:** As a Havruta participant, I want to start learning sessions within my Havruta that automatically load our last studied section, so that we can continue from where we left off.

#### Acceptance Criteria

1. WHEN a user starts a new session within a Havruta THEN the system SHALL create a new session instance linked to that Havruta
2. WHEN a session is started THEN the system SHALL load the last saved text section from the Havruta's progress
3. WHEN a new Havruta has its first session THEN the system SHALL start from the beginning of the selected book
4. WHEN participants navigate to a new section during a session THEN the system SHALL sync the navigation for all session participants in real-time
5. WHEN a session ends THEN the system SHALL automatically save the current section as the Havruta's last studied location
6. WHEN a session ends THEN the system SHALL record the session in the Havruta's session history

### Requirement 3A

**User Story:** As a Havruta owner like Isaac, I want to explicitly end learning sessions and have the system save our progress, so that future sessions automatically resume from where we left off.

#### Acceptance Criteria

1. WHEN a Havruta owner is in an active session THEN the system SHALL display an "End Session" button prominently in the interface
2. WHEN the "End Session" button is clicked THEN the system SHALL prompt for confirmation before ending the session
3. WHEN a session is ended by the owner THEN the system SHALL save the owner's current text location (e.g., Genesis 2:1) as the Havruta's "last place" for future sessions
4. WHEN a session is ended THEN the system SHALL notify all other participants that the session has concluded
5. WHEN a session is ended THEN the system SHALL record the session's starting location and ending location (e.g., "Genesis 1:1 to Genesis 2:1") in the session history
6. WHEN the next session is started for the same Havruta THEN the system SHALL automatically open to the saved "last place" location
7. WHEN a session is active THEN the system SHALL track the range of text covered from session start to current location
8. IF no participants remain in a session THEN the system SHALL automatically end the session after a 5-minute timeout and save the last known owner position

### Requirement 3B

**User Story:** As a Havruta participant, I want to view the history of our learning sessions, so that I can see what we've covered in each study period.

#### Acceptance Criteria

1. WHEN a user views a Havruta's details THEN the system SHALL display a session history showing all completed sessions
2. WHEN a session history entry is displayed THEN the system SHALL show the date, duration, participants, and text range covered (e.g., "Genesis 1:1 to Genesis 2:1")
3. WHEN a user clicks on a session history entry THEN the system SHALL show detailed information about that session
4. WHEN a session is in progress THEN the system SHALL show the current session's starting point and real-time coverage range
5. WHEN viewing session history THEN the system SHALL order sessions chronologically with the most recent first
6. WHEN a session covered multiple text sections THEN the system SHALL display the full range accurately

### Requirement 4

**User Story:** As a Havruta participant, I want access to the full Sefaria library with synchronized navigation, so that all participants can study the same text simultaneously.

#### Acceptance Criteria

1. WHEN a user browses available texts THEN the system SHALL display the complete Sefaria library catalog
2. WHEN a participant navigates to a different section THEN the system SHALL update the view for all other participants
3. WHEN text content is loaded THEN the system SHALL retrieve it from the Sefaria API
4. IF the Sefaria API is unavailable THEN the system SHALL display an appropriate error message and suggest retry

### Requirement 5

**User Story:** As a Havruta participant, I want to start and join individual learning sessions within my Havruta, so that I can have focused study periods with my partners.

#### Acceptance Criteria

1. WHEN a user wants to study THEN the system SHALL allow them to start a new session within any of their Havrutot
2. WHEN a session is started THEN the system SHALL notify all Havruta participants and allow them to join
3. WHEN a participant joins a session THEN the system SHALL add them to the active session participant list
4. WHEN a session has no active participants THEN the system SHALL automatically end the session after a timeout period
5. WHEN a session is active THEN the system SHALL display session status and participant count to Havruta members
6. WHEN multiple sessions are requested for the same Havruta THEN the system SHALL only allow one active session per Havruta at a time

### Requirement 5A

**User Story:** As a Havruta participant, I want to start instant learning sessions that immediately invite all participants, so that I can begin studying right away without scheduling.

#### Acceptance Criteria

1. WHEN a user views a Havruta THEN the system SHALL display a "Start Instant Session" button alongside scheduling options
2. WHEN the "Start Instant Session" button is clicked THEN the system SHALL immediately create a new session and open it to the Havruta's last place
3. WHEN an instant session is created THEN the system SHALL automatically send real-time notifications to all Havruta participants
4. WHEN participants receive an instant session notification THEN the system SHALL provide a "Join Now" option with one-click access
5. WHEN an instant session is started THEN the system SHALL function identically to scheduled sessions (same navigation, ending, progress saving)
6. WHEN an instant session is created THEN the system SHALL record it in the session history with a "instant" session type
7. IF a Havruta already has an active session THEN the system SHALL prevent starting another instant session and display the existing session status

### Requirement 6

**User Story:** As a Havruta participant, I want built-in video communication that starts automatically when I join a session, so that I can discuss the texts with my study partners without needing external tools.

#### Acceptance Criteria

1. WHEN a user joins a learning session THEN the system SHALL automatically initiate a video call with all session participants
2. WHEN a participant joins an ongoing session THEN the system SHALL add them to the existing video call
3. WHEN a user prefers audio-only THEN the system SHALL provide an option to disable video while maintaining audio
4. WHEN a participant leaves the session THEN the system SHALL remove them from the video call
5. IF video call fails to initialize THEN the system SHALL display an error message and provide retry options

### Requirement 7

**User Story:** As a user, I want a dashboard showing all my Havrutot with relevant information, so that I can easily manage and access my study sessions.

#### Acceptance Criteria

1. WHEN a user accesses the dashboard THEN the system SHALL display all their Havrutot with book titles, partner names, and current progress
2. WHEN a user has scheduled sessions THEN the system SHALL display a "Next Up" section showing the next scheduled session
3. WHEN a user views a Havruta on the dashboard THEN the system SHALL provide quick actions to join collaborative sessions and invite participants
4. WHEN a user clicks join on an active Havruta THEN the system SHALL navigate them directly to the collaborative session
5. WHEN a user views Havruta cards THEN the system SHALL NOT display a "Study Solo" option to maintain focus on collaborative learning

### Requirement 8

**User Story:** As a user, I want to invite new participants to my Havruta by email, so that I can expand my study group with people who may not yet be using the platform.

#### Acceptance Criteria

1. WHEN a user clicks the "Add Participant" button on a Havruta THEN the system SHALL open a dialog for entering email addresses
2. WHEN a user enters email addresses in the invitation dialog THEN the system SHALL validate the email format before allowing submission
3. WHEN a user submits valid email addresses THEN the system SHALL send invitation emails with a link to join the specific Havruta
4. WHEN an invited email belongs to an existing user THEN the system SHALL automatically add the Havruta to their dashboard
5. WHEN an invited email belongs to a new user THEN the system SHALL include registration instructions in the invitation email
6. WHEN an invitation email is sent THEN the system SHALL display a confirmation message to the inviting user
7. IF email sending fails THEN the system SHALL display an error message and allow the user to retry

### Requirement 9

**User Story:** As a user, I want to schedule future learning sessions within my Havrutot with recurring options, so that I can plan regular study times with my partners.

#### Acceptance Criteria

1. WHEN a user schedules a session THEN the system SHALL allow selection of date, time, and participants
2. WHEN a user schedules a session THEN the system SHALL provide recurring options (once, daily, weekly, bi-weekly, monthly)
3. WHEN a recurring session is created THEN the system SHALL generate all future session instances based on the selected frequency
4. WHEN a session is scheduled THEN the system SHALL send notifications to all invited participants
5. WHEN a scheduled session time arrives THEN the system SHALL notify participants and provide easy access to join
6. IF a participant cannot attend a scheduled session THEN the system SHALL allow them to decline and notify other participants
7. WHEN a user modifies a recurring session THEN the system SHALL allow them to update just that instance or all future instances

### Requirement 10

**User Story:** As a session participant, I want to join and communicate in real-time WebSocket session rooms, so that I can have synchronized collaborative study experiences similar to Google Meet or Zoom.

#### Acceptance Criteria

1. WHEN a user joins an active session THEN the system SHALL automatically connect them to a WebSocket "room" identified by the session ID
2. WHEN a user joins a session room THEN the system SHALL notify all other participants in real-time that they have joined
3. WHEN a user leaves a session room THEN the system SHALL notify all remaining participants in real-time that they have left
4. WHEN the session owner navigates to a new text section THEN the system SHALL broadcast the navigation to all participants in the session room
5. WHEN a participant receives a navigation broadcast THEN the system SHALL automatically sync their text view to match the owner's location
6. WHEN a session is ended by the owner THEN the system SHALL broadcast the session end event to all participants in the room and close the WebSocket connections
7. WHEN a user's WebSocket connection drops THEN the system SHALL attempt automatic reconnection and rejoin them to their active session room
8. IF a session room becomes empty (no participants) THEN the system SHALL automatically end the session after a 5-minute timeout
9. WHEN optional WebRTC video is enabled THEN the system SHALL coordinate video connection establishment through the WebSocket room

### Requirement 11

**User Story:** As a user, I want to track my progress and view my study history, so that I can see my learning journey and accomplishments.

#### Acceptance Criteria

1. WHEN a user accesses their progress dashboard THEN the system SHALL display their total study time, sessions completed, and texts covered
2. WHEN a user views session history THEN the system SHALL show chronological list of all completed sessions with dates, participants, and coverage ranges
3. WHEN a user clicks on a session history entry THEN the system SHALL display detailed session information including duration and specific sections studied
4. WHEN a user completes a session THEN the system SHALL automatically update their progress statistics and learning achievements
5. WHEN a user views Havruta progress THEN the system SHALL show the collective progress of all participants in that study partnership
6. WHEN progress is calculated THEN the system SHALL track both individual and collaborative learning metrics
7. IF progress data is corrupted or missing THEN the system SHALL display an error message and provide options to recalculate from session history