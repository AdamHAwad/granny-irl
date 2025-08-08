# Timer System Backup Documentation
**Date**: 2025-01-08
**Issue**: Persistent +25 second timer desync for non-host players
**Purpose**: Complete backup before major timer system rework

## Current Timer Architecture

### File Locations
- **Primary Timer Logic**: `/app/game/[roomCode]/page.tsx` (lines 353-456)
- **Server Timer Creation**: `/lib/gameService.ts` (lines 865-980)
- **Subscription System**: `/lib/gameService.ts` (lines 1341-1420)
- **Type Definitions**: `/types/game.ts` (lines 52-69)

### Current Timer Calculation (WORKING VERSION TO RESTORE)

```typescript
// FROM: /app/game/[roomCode]/page.tsx (lines 353-456)
const updateTimers = () => {
  // Simple, direct timer calculation using server timestamps
  // All players use the same server timestamps for perfect synchronization
  // Removed client offset logic that was causing +25/+50 second desync issues
  const now = Date.now();
  
  // DEBUG: Comprehensive timer logging to identify desync source
  const isHost = user?.id === room.host_uid;
  
  // POTENTIAL FIX: Account for network time synchronization
  // Use server-side time adjustment to sync with database timestamps
  const serverTimeOffset = 0; // We'll calculate this dynamically
  const adjustedNow = now + serverTimeOffset;
  
  console.log('🕰️ TIMER DEBUG:', {
    isHost,
    playerRole: room.players[user?.id || '']?.role,
    status: room.status,
    clientTime: now,
    clientTimeDate: new Date(now).toISOString(),
    adjustedTime: adjustedNow,
    headstart_started_at: room.headstart_started_at,
    headstartDate: room.headstart_started_at ? new Date(room.headstart_started_at).toISOString() : null,
    game_started_at: room.game_started_at,
    gameStartDate: room.game_started_at ? new Date(room.game_started_at).toISOString() : null,
    timeDiffFromHeadstart: room.headstart_started_at ? (adjustedNow - room.headstart_started_at) : null,
    timeDiffFromGameStart: room.game_started_at ? (adjustedNow - room.game_started_at) : null,
    roomCreatedAt: room.created_at,
    headstartDurationMs: room.settings.headstartMinutes * 60 * 1000,
    roundDurationMs: room.settings.roundLengthMinutes * 60 * 1000
  });
  
  // Use adjusted time for calculations
  const syncedNow = adjustedNow;

  if (room.status === 'headstart' && room.headstart_started_at) {
    const headstartEnd = room.headstart_started_at + (room.settings.headstartMinutes * 60 * 1000);
    const remaining = Math.max(0, headstartEnd - syncedNow);
    console.log('🟡 HEADSTART TIMER:', {
      isHost,
      headstartEnd,
      headstartEndDate: new Date(headstartEnd).toISOString(),
      remaining,
      remainingSeconds: Math.floor(remaining / 1000),
      calculation: `${headstartEnd} - ${syncedNow} = ${headstartEnd - syncedNow}`,
      usingClientTime: `${headstartEnd} - ${now} = ${headstartEnd - now}`
    });
    setHeadstartRemaining(remaining);
  }

  if (room.status === 'active' && room.game_started_at) {
    const gameEnd = room.game_started_at + (room.settings.roundLengthMinutes * 60 * 1000);
    const remaining = Math.max(0, gameEnd - syncedNow);
    console.log('🔴 ACTIVE TIMER:', {
      isHost,
      gameEnd,
      gameEndDate: new Date(gameEnd).toISOString(),
      remaining,
      remainingSeconds: Math.floor(remaining / 1000),
      calculation: `${gameEnd} - ${syncedNow} = ${gameEnd - syncedNow}`,
      usingClientTime: `${gameEnd} - ${now} = ${gameEnd - now}`
    });
    setTimeRemaining(remaining);

    // Play game start sound when transitioning to active
    if (!gameStartSoundPlayed) {
      playGameStart();
      vibrate([200, 100, 200]);
      setGameStartSoundPlayed(true);
    }

    // Play countdown sounds in final 10 seconds
    if (remaining <= 10000 && remaining > 0 && Math.floor(remaining / 1000) !== Math.floor((remaining - 1000) / 1000)) {
      playCountdown();
      vibrate(100);
    }

    // Check if game should end due to timer (only if game has been active for at least 5 seconds)
    if (remaining <= 0 && room.status === 'active' && room.game_started_at && (Date.now() - room.game_started_at) > 5000) {
      console.log('Game timer expired on client side, triggering game end check');
      import('@/lib/gameService').then(({ checkGameEnd }) => {
        checkGameEnd(params.roomCode);
      });
    }
  }

  // Handle escape timer (10 minutes after escape area revealed)
  const escapeArea = getEscapeArea(room);
  if (room.status === 'active' && room.escape_timer_started_at && escapeArea?.isRevealed) {
    const escapeEnd = room.escape_timer_started_at + (10 * 60 * 1000); // 10 minutes
    const escapeRemaining = Math.max(0, escapeEnd - now);
    setEscapeTimerRemaining(escapeRemaining);

    // Play warning sounds in final 60 seconds
    if (escapeRemaining <= 60000 && escapeRemaining > 0 && Math.floor(escapeRemaining / 1000) !== Math.floor((escapeRemaining - 1000) / 1000)) {
      const secondsLeft = Math.floor(escapeRemaining / 1000);
      if (secondsLeft <= 10) {
        playCountdown();
        vibrate([200, 100, 200]); // More intense vibration for escape timer
      } else if (secondsLeft % 10 === 0) {
        playGameStart(); // Warning sound every 10 seconds in final minute
        vibrate(150);
      }
    }

    // Auto-eliminate when escape timer expires
    if (escapeRemaining <= 0 && room.escape_timer_started_at && (now - room.escape_timer_started_at) > (10 * 60 * 1000)) {
      console.log('Escape timer expired on client side, triggering auto-elimination');
      import('@/lib/gameService').then(({ checkEscapeTimerExpired }) => {
        checkEscapeTimerExpired(params.roomCode);
      });
    }
  } else {
    setEscapeTimerRemaining(0);
  }
};

updateTimers();
// Update every second - more frequent updates can cause worse sync issues
const interval = setInterval(updateTimers, 1000);
```

## Server-Side Timer Creation

```typescript
// FROM: /lib/gameService.ts (lines 896-898)
// Use current time and calculate game start time immediately for consistency
const headstartStartTime = Date.now();
const gameStartTime = headstartStartTime + (room.settings.headstartMinutes * 60 * 1000);

const { data: updateData, error: updateError } = await supabase
  .from('rooms')
  .update({
    status: 'headstart',
    headstart_started_at: headstartStartTime,
    players: updatedPlayers,
  })
  .eq('id', roomCode)
  .select('headstart_started_at');
```

## Subscription System Settings

```typescript
// FROM: /lib/gameService.ts (lines 1351-1355)
const POLLING_INTERVAL = 3000; // 3 seconds fallback polling
const DEBOUNCE_TIME = 100; // Debounce rapid updates
const CACHE_TTL_SHORT = 5000; // 5 seconds for room data
```

## Problem Statement

**Issue**: Non-host players consistently see +25 seconds on their timers
**Behavior**: 
- Host shows timer correctly (e.g., 0:30 remaining)
- Non-host shows timer with +25s (e.g., 0:55 remaining) 
- Game still ends at correct time for everyone

**Attempts Made**:
1. ✅ Removed client offset logic (was adding 25s intentionally)
2. ✅ Added comprehensive debug logging
3. ❌ Issue persists despite no explicit offset code

## Git History Analysis

**Relevant Commits**:
- `ef0a179` - Added debug logging (current)
- `1d72d56` - Removed client offset logic
- `9d8f1ca` - Fixed sign out + Android icons  
- `b9d6b3a` - Port iOS fixes to Android

## Current State

- Timer calculations use direct `Date.now()` vs server timestamps
- No explicit client offset logic remains
- Debug logs show detailed calculation steps
- Issue persists suggesting deeper architectural problem

## Potential Root Causes

1. **Database Timestamp Precision**: PostgreSQL vs JavaScript timestamp handling
2. **Supabase Real-time Lag**: Non-host players receive stale cached data
3. **Client Clock Drift**: Device time synchronization issues
4. **Subscription Race Conditions**: Different delivery timing for room updates
5. **Hidden Offset Logic**: Undiscovered code path adding 25s

## Recovery Instructions

To restore this exact timer system if new implementation fails:

1. **Restore Timer Logic**:
   ```bash
   git checkout ef0a179 -- app/game/[roomCode]/page.tsx
   ```

2. **Restore Server Logic**:
   ```bash
   git checkout ef0a179 -- lib/gameService.ts
   ```

3. **Remove Debug Logging** (if desired):
   - Remove all `console.log` statements with emoji prefixes
   - Keep core timer calculation logic intact

4. **Build and Deploy**:
   ```bash
   npm run build
   npm run mobile:sync
   git add .
   git commit -m "Restore original timer system"
   git push origin main
   ```

## Next Investigation Steps

1. **Server-Side Timer Approach**: Move timer calculations to server
2. **NTP Time Sync**: Use network time protocol for client sync
3. **WebSocket Direct Updates**: Bypass Supabase real-time for timers
4. **Periodic Server Sync**: Regular time correction from server
5. **Complete Architecture Redesign**: Rethink timer synchronization approach

---
**Status**: BACKUP COMPLETE - Ready for major timer system rework
**Restore Hash**: `ef0a179`