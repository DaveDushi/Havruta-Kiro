# Dashboard Sessions Update

## Problem Identified
The dashboard was showing **Havrutot** (study groups) instead of **upcoming sessions**. This was confusing because:
- Users expected to see their scheduled study sessions
- Recurring Havrutot should show multiple session instances
- The main focus should be on "when is my next study session" not "what study groups do I belong to"

## Solution Implemented

### 1. Updated Dashboard Data Structure
- ✅ Added `upcomingSessions` array to dashboard data
- ✅ Transformed raw session data to include Havruta information
- ✅ Updated statistics and next session calculation

### 2. Redesigned Main Dashboard Section
**Before**: "My Havrutot" - showed study groups
**After**: "Upcoming Sessions" - shows scheduled sessions

### 3. Session Cards Now Show:
- **Havruta name** (which study group)
- **Book title** (what text)
- **Start time** (when the session is scheduled)
- **Current section** (where to continue from)
- **Participant count** (who's joining)
- **Recurring indicator** (one-time vs recurring)
- **Actions**: "Join Session" and "Reschedule"

### 4. Added Separate Havrutot Management Section
- Compact cards showing study groups
- Actions: "Schedule" and "Invite" participants
- Focused on group management, not session joining

## New Dashboard Structure

```
Dashboard
├── Quick Stats (total havrutot, sessions, etc.)
├── Next Up (immediate next session)
├── Upcoming Sessions (main section)
│   ├── Session cards with scheduling info
│   ├── Search and filter by havruta/book
│   └── Sort by start time or havruta name
└── My Havrutot (management section)
    ├── Compact havruta cards
    └── Schedule/invite actions
```

## Benefits

### 1. **Clear Session Focus**
- Users see exactly when their next study sessions are
- Recurring sessions appear multiple times (as expected)
- Easy to join upcoming sessions

### 2. **Better Information Architecture**
- **Sessions** = "When am I studying?" (main focus)
- **Havrutot** = "What study groups do I manage?" (secondary)

### 3. **Improved User Experience**
- No confusion between study groups and study sessions
- Clear call-to-action for joining sessions
- Separate area for managing study groups

## Example: Recurring Havruta

**Before**: 
- "Talmud Study Group" appears once
- User clicks "Join Collaborative" (unclear when)

**After**:
- "Talmud Study Group - Monday 7pm" (session card)
- "Talmud Study Group - Wednesday 7pm" (session card)  
- "Talmud Study Group - Friday 7pm" (session card)
- Each has clear start time and "Join Session" button

## API Integration

### Data Flow:
1. `schedulingService.getUpcomingSessions(7)` - gets next 7 days of sessions
2. Transform sessions to include Havruta metadata
3. Display sessions with scheduling information
4. Keep separate `havrutaService.getUserHavrutot()` for management

### Session Actions:
- **"Join Session"** → `handleJoinHavruta(session.havrutaId)` 
- **"Reschedule"** → Opens scheduling dialog for that session
- **"Schedule"** (from Havruta cards) → Creates new session for that Havruta

## Testing

### 1. Create Recurring Sessions
1. Go to dashboard
2. Click "Schedule" on a Havruta card
3. Set up weekly recurring sessions
4. Verify multiple session cards appear in "Upcoming Sessions"

### 2. Join Sessions
1. Click "Join Session" on any session card
2. Should navigate to collaborative TextViewer
3. Should use the correct Havruta ID for WebSocket connection

### 3. Manage Havrutot
1. Scroll to "My Havrutot" section
2. Use "Schedule" to create new sessions
3. Use "Invite" to add participants to study groups

## Files Modified
- `frontend/src/hooks/useDashboardData.ts` - Added upcoming sessions data
- `frontend/src/pages/DashboardPage.tsx` - Redesigned to show sessions first, Havrutot second
- Enhanced filtering, sorting, and display logic for sessions

The dashboard now properly distinguishes between **study groups** (Havrutot) and **study sessions**, with the main focus on upcoming scheduled sessions!