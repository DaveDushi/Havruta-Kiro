# Database Schema Changes - Enhanced Session Management

## Overview
This document outlines the database schema changes made to support enhanced session management with owner-based navigation and instant sessions.

## Changes Made

### 1. Havruta Model Updates
- **Removed redundant fields:**
  - `creatorId` (redundant with `ownerId`)
  - `currentSection` (redundant with `lastPlace`)

- **Enhanced fields:**
  - `ownerId`: Designates the Havruta owner with special privileges (navigation control, session ending)
  - `lastPlace`: Current location where the Havruta left off (e.g., "Genesis 2:1")

### 2. Session Model Enhancements
- **New session type tracking:**
  - `type`: 'scheduled' | 'instant' - distinguishes between scheduled and instant sessions
  - `status`: 'scheduled' | 'active' | 'completed' | 'cancelled' - tracks session lifecycle

- **Enhanced progress tracking:**
  - `startingSection`: Where the session began (e.g., "Genesis 1:1")
  - `endingSection`: Where the session ended (e.g., "Genesis 2:1") 
  - `coverageRange`: Full range covered (e.g., "Genesis 1:1 to Genesis 2:1")

- **Performance indexes:**
  - `@@index([havrutaId, status])` - Fast queries for active sessions by Havruta
  - `@@index([status])` - Fast queries for sessions by status
  - `@@index([type, status])` - Fast queries for instant/scheduled sessions by status

### 3. New Invitation System
- **Invitation Model:** Complete email-based invitation system
  - `inviteeEmail`: Email address of the person being invited
  - `status`: 'pending' | 'accepted' | 'declined' | 'expired'
  - `invitationToken`: Unique token for secure invitation links
  - `expiresAt`: Expiration date for invitations
  - Foreign keys to `User` (inviter) and `Havruta`

## Migration Strategy

### Migration 1: Enhanced Session Management
- Added new fields to existing models
- Populated `ownerId` from existing `creatorId` data
- Set appropriate default values for new session fields
- Created indexes for performance

### Migration 2: Remove Redundant Fields  
- Removed `creatorId` and `currentSection` fields
- Updated foreign key relationships
- Cleaned up deprecated references

## Key Benefits

1. **Clear Ownership Model:** Single `ownerId` field eliminates confusion
2. **Enhanced Session Tracking:** Detailed session progress with coverage ranges
3. **Instant Session Support:** Type field enables instant vs scheduled session workflows
4. **Performance Optimized:** Strategic indexes for common query patterns
5. **Complete Invitation System:** Email-based invitations with token security

## Backward Compatibility

- Existing data is preserved through careful migration scripts
- Deprecated fields (`sectionsStudied`) maintained temporarily for gradual migration
- All existing functionality continues to work with enhanced features

## Testing

- Seed script updated with comprehensive test data
- Includes examples of both instant and scheduled sessions
- Sample invitations with various statuses
- Progress tracking examples with new session workflow