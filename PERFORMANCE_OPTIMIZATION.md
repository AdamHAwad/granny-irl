# Granny IRL Performance Optimization Guide

## Critical Performance Issues Identified

### 1. Row Level Security (RLS) Performance ⚠️ CRITICAL
The Supabase Performance Advisor identified that all RLS policies are inefficiently calling `auth.uid()` for every row, causing severe performance degradation.

**Issue**: `auth.uid()` is re-evaluated for each row in queries
**Impact**: "I was caught" and debug operations take forever
**Solution**: Replace `auth.uid()` with `(select auth.uid())` in all RLS policies

### 2. Inefficient Database Operations
- Every operation fetches the entire room object
- Updates require reading first, then writing
- No batching of updates
- Real-time subscriptions trigger too frequently

## Required Database Optimizations

### Step 1: Fix RLS Policies (CRITICAL - DO THIS FIRST!)
Run the SQL script `fix_rls_performance.sql` in Supabase SQL Editor:

```sql
-- This script fixes all RLS policies to use (select auth.uid())
-- Run the entire fix_rls_performance.sql file
```

### Step 2: Add Indexes
```sql
-- Already included in fix_rls_performance.sql
CREATE INDEX IF NOT EXISTS idx_rooms_id ON public.rooms(id);
CREATE INDEX IF NOT EXISTS idx_rooms_status ON public.rooms(status);
CREATE INDEX IF NOT EXISTS idx_rooms_host_uid ON public.rooms(host_uid);
CREATE INDEX IF NOT EXISTS idx_game_results_room_id ON public.game_results(room_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_uid ON public.user_profiles(uid);
```

### Step 3: Create Optimized RPC Functions
```sql
-- Function to update a specific player without fetching entire room
CREATE OR REPLACE FUNCTION update_player_field(
  p_room_id TEXT,
  p_player_uid TEXT,
  p_field TEXT,
  p_value JSONB
) RETURNS void AS $$
BEGIN
  UPDATE rooms
  SET players = jsonb_set(
    players,
    array[p_player_uid, p_field],
    p_value,
    true
  )
  WHERE id = p_room_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to eliminate player efficiently
CREATE OR REPLACE FUNCTION eliminate_player_fast(
  p_room_id TEXT,
  p_player_uid TEXT,
  p_eliminated_by TEXT DEFAULT NULL
) RETURNS void AS $$
DECLARE
  v_update JSONB;
BEGIN
  v_update := jsonb_build_object(
    'isAlive', false,
    'eliminatedAt', (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
  );
  
  IF p_eliminated_by IS NOT NULL THEN
    v_update := v_update || jsonb_build_object('eliminatedBy', p_eliminated_by);
  END IF;
  
  UPDATE rooms
  SET players = players || jsonb_build_object(p_player_uid, players->p_player_uid || v_update)
  WHERE id = p_room_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Code Optimizations Implemented

### 1. Optimized Player Elimination
Instead of:
```typescript
// OLD: Fetch entire room, modify, update entire room
const { data: room } = await supabase.from('rooms').select('*').eq('id', roomCode).single();
const updatedPlayers = { ...room.players };
updatedPlayers[playerUid].isAlive = false;
await supabase.from('rooms').update({ players: updatedPlayers }).eq('id', roomCode);
```

Use:
```typescript
// NEW: Direct RPC call to update specific player
await supabase.rpc('eliminate_player_fast', {
  p_room_id: roomCode,
  p_player_uid: playerUid,
  p_eliminated_by: eliminatedBy
});
```

### 2. Batched Location Updates
- Queue location updates and batch them every second
- Reduces database calls from N per second to 1 per second
- Implemented in `optimizedGameService.ts`

### 3. Reduced Real-time Subscription Load
- Only subscribe to specific fields needed
- Debounce rapid updates
- Use more efficient change detection

## Quick Performance Wins

1. **Immediate Fix (5 min)**: Run `fix_rls_performance.sql` - This alone should fix most slowness
2. **Add RPC Functions (10 min)**: Create the optimized database functions
3. **Update Code (30 min)**: Replace heavy operations with optimized versions

## Monitoring Performance

After implementing fixes:
1. Check Supabase Dashboard > Database > Query Performance
2. Monitor API response times
3. Test "I was caught" button - should be instant

## Expected Results

- **Before**: 2-5 second delays on operations
- **After RLS Fix**: <100ms response times
- **After Full Optimization**: <50ms response times

## Emergency Rollback

If issues occur:
1. RLS policies can be reverted by running the original policies
2. Code changes are backward compatible
3. RPC functions can be dropped without breaking existing code