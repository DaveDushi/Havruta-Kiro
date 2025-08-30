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
6. IF a user tries to join a non-existent Havruta THEN the system SHALL display an error message

### Requirement 3

**User Story:** As a Havruta participant, I want to start learning sessions within my Havruta that automatically load our last studied section, so that we can continue from where we left off.

#### Acceptance Criteria

1. WHEN a user starts a new session within a Havruta THEN the system SHALL create a new session instance linked to that Havruta
2. WHEN a session is started THEN the system SHALL load the last saved text section from the Havruta's progress
3. WHEN a new Havruta has its first session THEN the system SHALL start from the beginning of the selected book
4. WHEN participants navigate to a new section during a session THEN the system SHALL sync the navigation for all session participants in real-time
5. WHEN a session ends THEN the system SHALL automatically save the current section as the Havruta's last studied location
6. WHEN a session ends THEN the system SHALL record the session in the Havruta's session history

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

**User Story:** As a user, I want to track my progress and view my study history, so that I can see my learning journey and accomplishments.

#### Acceptance Criteria

1. WHEN a user clicks the "Add Participant" button on a Havruta THEN the system SHALL open a dialog for entering email addresses
2. WHEN a user enters email addresses in the invitation dialog THEN the system SHALL validate the email format before allowing submission
3. WHEN a user submits valid email addresses THEN the system SHALL send invitation emails with a link to join the specific Havruta
4. WHEN an invited email belongs to an existing user THEN the system SHALL automatically add the Havruta to their dashboard
5. WHEN an invited email belongs to a new user THEN the system SHALL include registration instructions in the invitation email
6. WHEN an invitation email is sent THEN the system SHALL display a confirmation message to the inviting user
7. IF email sending fails THEN the system SHALL display an error message and allow the user to retry