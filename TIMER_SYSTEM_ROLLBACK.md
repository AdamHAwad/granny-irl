# Timer System Rollback Documentation

## Current State Before Changes
**Date**: August 8, 2025
**Commit**: 44ad572 (Fix timer expiration and 75% elimination win condition logic)

## Problem Being Solved
- Non-host players see timers that are 25 seconds ahead of the host player
- Client-side timer calculations cause synchronization issues due to clock drift, network latency, and Supabase caching

## Current System (Pre-Fix)
The timer system currently has:
1. **Server-authoritative timer framework** implemented but not deployed
2. **Client-side fallback** that works but has +25s desync issue
3. **Debug logging** to track timer calculation paths

### Files Modified:
- `app/game/[roomCode]/page.tsx` (lines 366-505): Timer calculation UI logic
- `lib/gameService.ts` (lines 132-192): Room retrieval with timer functions
- `server-timer-functions-simple.sql`: PostgreSQL functions (not deployed)

## Solution Being Deployed
**New File**: `deploy_timer_functions.sql`
**Action**: Deploy `get_room_with_timers` PostgreSQL function to Supabase

### Expected Behavior After Fix:
1. **Server Path**: `get_room_with_timers()` returns room data with server-calculated timers
2. **Client Path**: Uses server timers (`headstart_remaining_ms`, `active_remaining_ms`, `escape_remaining_ms`)
3. **Fallback Path**: Client calculation (current behavior) if server function fails

## Rollback Instructions

### If Timer System Breaks:
1. **Remove the deployed function**:
   ```sql
   DROP FUNCTION IF EXISTS get_room_with_timers(TEXT);
   ```

2. **The system will automatically fall back** to client-side calculation (current behavior with +25s issue)

3. **Alternative: Revert specific commits**:
   ```bash
   git revert 44ad572  # Remove game end logic changes if needed
   git revert d880855  # Remove server timer implementation if needed
   ```

### Verification Commands:
```sql
-- Check if function exists
SELECT routine_name FROM information_schema.routines 
WHERE routine_name = 'get_room_with_timers';

-- Test function manually
SELECT * FROM get_room_with_timers('TESTROOM');
```

### Console Log Monitoring:
- `🚀 SERVER-AUTHORITATIVE TIMER`: Server timers being used
- `⚠️ Using client-side timer fallback`: Function not available, using client calculation
- `✅ Using server-calculated timers`: Server path working correctly

## Git State:
- **Current Commit**: 44ad572
- **Modified Files**: `lib/gameService.ts` (game end logic)
- **Untracked Files**: `deploy_timer_functions.sql`, `TIMER_SYSTEM_ROLLBACK.md`

## Recovery Path:
1. Deploy `deploy_timer_functions.sql` to fix timer desync
2. If issues occur, run `DROP FUNCTION get_room_with_timers(TEXT)` 
3. System automatically uses existing client fallback
4. No data loss or game functionality impact

## Previous Documentation:
- `TIMER_SYSTEM_BACKUP.md`: Complete backup of original system
- `NEW_TIMER_SYSTEM.md`: Detailed implementation guide
- `server-timer-functions-simple.sql`: Original function definitions