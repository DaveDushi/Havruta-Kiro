# Collaborative Session Debug Guide

## Issue Analysis

The "Not authorized for this session" error occurs because of a mismatch between frontend and backend expectations:

### Backend WebSocket Service Expects:
- **Event**: `join-havruta`
- **Parameter**: `havrutaId` (the study group ID)
- **Authorization**: Checks if user is a participant in the Havruta
- **Room Management**: Creates/joins WebSocket room using `havrutaId`

### Frontend Was Sending:
- **Event**: `join-havruta` 
- **Parameter**: `sessionId` (fake session ID like `session-${havrutaId}`)
- **Problem**: Backend couldn't find this fake session ID in its Havruta database

## Fix Applied

### 1. Updated Dashboard (`handleJoinHavruta`)
- Now uses actual `havrutaId` for WebSocket connection
- Session management is optional (for progress tracking)
- Passes `havrutaId` as `sessionId` parameter to TextViewer

### 2. WebSocket Flow Now Works:
1. User clicks "Join Collaborative" on Havruta card
2. Dashboard passes `havrutaId` to TextViewer as `sessionId`
3. TextViewer calls `collaborative.connectToSession(sessionId)` 
4. This calls `socketService.joinSession(sessionId)` with the `havrutaId`
5. Socket service emits `join-havruta` with `havrutaId`
6. Backend verifies user is participant in that Havruta ✅
7. User joins WebSocket room for collaborative features ✅

## Testing Steps

### 1. Basic Collaborative Session
1. Start backend: `cd backend && npm run dev`
2. Start frontend: `cd frontend && npm run dev`
3. Login to dashboard
4. Click "Join Collaborative" on any Havruta
5. Should see: "Socket connection successful" in console
6. Should see: "Successfully connected to collaborative session" in console
7. No "Not authorized" error ❌

### 2. Video Call Testing
1. After joining collaborative session
2. Click "Test Socket" button (if available)
3. Click "Join Call" button
4. Should see: "Initializing video call for session: [havrutaId]"
5. Should see: "Video call initialized successfully"
6. No authorization errors ❌

### 3. Multi-User Testing
1. Open two browser windows/tabs
2. Login as different users (or same user)
3. Both join same Havruta collaborative session
4. Navigate in one window - should see navigation sync in other
5. Both should be able to join video call

## Debug Console Messages

### Expected Success Flow:
```
TextViewerPage rendered with: {sessionId: "havruta-123", collaborative: true, ...}
Connecting to collaborative session: havruta-123 with user: {id: "user-123", name: "User Name"}
Socket connection successful
Successfully connected to collaborative session
Initializing video call for session: havruta-123 user: user-123
Video call initialized successfully
```

### Previous Error Flow:
```
TextViewerPage rendered with: {sessionId: "session-havruta-123", collaborative: true, ...}
Connecting to collaborative session: session-havruta-123 with user: {id: "user-123", name: "User Name"}
Socket connection successful
Socket error: {message: 'Not authorized for this session'}
```

## Architecture Notes

### Havruta vs Session Distinction:
- **Havruta**: Persistent study group with participants
- **Session**: Temporary study meeting within a Havruta
- **WebSocket Rooms**: Organized by Havruta ID, not session ID
- **Video Calls**: Use Havruta ID as the "session" identifier

### Why This Design Makes Sense:
1. **Persistent Collaboration**: Users can join/leave throughout the day
2. **Flexible Sessions**: Multiple study sessions can happen in same Havruta
3. **Simple Authorization**: Just check Havruta membership
4. **Scalable Rooms**: One WebSocket room per Havruta

## Future Improvements

### 1. Better Session Integration
- Track which users are in active study sessions
- Show session history in Havruta
- Integrate scheduled sessions with collaborative features

### 2. Enhanced Authorization
- Check if user should be in specific scheduled session
- Support private/public Havrutot
- Add moderator controls

### 3. Session State Management
- Sync current text position across sessions
- Save session progress automatically
- Resume from last position

## Files Modified
- `frontend/src/pages/DashboardPage.tsx` - Fixed `handleJoinHavruta` to use correct IDs
- Added debug documentation and testing guide