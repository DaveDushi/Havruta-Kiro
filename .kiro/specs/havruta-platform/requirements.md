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

**User Story:** As a user, I want to create or join Havruta learning sessions with other users, so that I can study Jewish texts collaboratively.

#### Acceptance Criteria

1. WHEN a user creates a new Havruta THEN the system SHALL allow selection of a book from the Sefaria library
2. WHEN a user creates a new Havruta THEN the system SHALL allow invitation of 1 or more study partners
3. WHEN a user joins an existing Havruta THEN the system SHALL add them to the session participant list
4. WHEN a Havruta is created THEN the system SHALL generate a unique session identifier
5. IF a user tries to join a non-existent Havruta THEN the system SHALL display an error message

### Requirement 3

**User Story:** As a Havruta participant, I want the session to automatically load the last studied section when I join, so that we can continue from where we left off.

#### Acceptance Criteria

1. WHEN a user joins an active Havruta THEN the system SHALL load the last saved text section for all participants
2. WHEN a new Havruta is created THEN the system SHALL start from the beginning of the selected book
3. WHEN participants navigate to a new section THEN the system SHALL sync the navigation for all participants in real-time
4. WHEN a Havruta session ends THEN the system SHALL automatically save the current section as the last studied location

### Requirement 4

**User Story:** As a Havruta participant, I want access to the full Sefaria library with synchronized navigation, so that all participants can study the same text simultaneously.

#### Acceptance Criteria

1. WHEN a user browses available texts THEN the system SHALL display the complete Sefaria library catalog
2. WHEN a participant navigates to a different section THEN the system SHALL update the view for all other participants
3. WHEN text content is loaded THEN the system SHALL retrieve it from the Sefaria API
4. IF the Sefaria API is unavailable THEN the system SHALL display an appropriate error message and suggest retry

### Requirement 5

**User Story:** As a Havruta participant, I want built-in video communication that starts automatically, so that I can discuss the texts with my study partners without needing external tools.

#### Acceptance Criteria

1. WHEN a user joins a Havruta session THEN the system SHALL automatically initiate a video call with all participants
2. WHEN a participant joins an ongoing session THEN the system SHALL add them to the existing video call
3. WHEN a user prefers audio-only THEN the system SHALL provide an option to disable video while maintaining audio
4. WHEN a participant leaves the session THEN the system SHALL remove them from the video call
5. IF video call fails to initialize THEN the system SHALL display an error message and provide retry options

### Requirement 6

**User Story:** As a user, I want a dashboard showing all my Havrutot with relevant information, so that I can easily manage and access my study sessions.

#### Acceptance Criteria

1. WHEN a user accesses the dashboard THEN the system SHALL display all their Havrutot with book titles, partner names, and current progress
2. WHEN a user has scheduled sessions THEN the system SHALL display a "Next Up" section showing the next scheduled session
3. WHEN a user views a Havruta on the dashboard THEN the system SHALL provide quick actions to join, schedule, or invite participants
4. WHEN a user clicks join on an active Havruta THEN the system SHALL navigate them directly to the session

### Requirement 7

**User Story:** As a user, I want to track my progress and view my study history, so that I can see my learning journey and accomplishments.

#### Acceptance Criteria

1. WHEN a user views their progress THEN the system SHALL display completion status for each Havruta
2. WHEN a user accesses their history THEN the system SHALL show past sessions with dates and sections covered
3. WHEN a Havruta session is completed THEN the system SHALL update the progress tracking automatically
4. WHEN a user views a specific Havruta's history THEN the system SHALL display all previous sessions and their covered content

### Requirement 8

**User Story:** As a user, I want to schedule future Havruta sessions with recurring options, so that I can plan regular study times with my partners.

#### Acceptance Criteria

1. WHEN a user schedules a session THEN the system SHALL allow selection of date, time, and participants
2. WHEN a user schedules a session THEN the system SHALL provide recurring options (once, daily, weekly, bi-weekly, monthly)
3. WHEN a recurring session is created THEN the system SHALL generate all future session instances based on the selected frequency
4. WHEN a session is scheduled THEN the system SHALL send notifications to all invited participants
5. WHEN a scheduled session time arrives THEN the system SHALL notify participants and provide easy access to join
6. IF a participant cannot attend a scheduled session THEN the system SHALL allow them to decline and notify other participants
7. WHEN a user modifies a recurring session THEN the system SHALL allow them to update just that instance or all future instances