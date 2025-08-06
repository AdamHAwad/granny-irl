-- Fix Security Issues from Supabase Security Advisor
-- This script addresses:
-- 1. Function Search Path Mutable warnings
-- 2. Auth configuration improvements

-- Fix Function Search Path Mutable warnings
-- Set explicit search_path for all SECURITY DEFINER functions

-- Fix eliminate_player_fast function
CREATE OR REPLACE FUNCTION eliminate_player_fast(
  p_room_id TEXT,
  p_player_uid TEXT,
  p_eliminated_by TEXT DEFAULT NULL
) RETURNS void AS $$
DECLARE
  v_update JSONB;
BEGIN
  -- Build the update object
  v_update := jsonb_build_object(
    'isAlive', false,
    'eliminatedAt', (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
  );
  
  -- Add eliminatedBy if provided
  IF p_eliminated_by IS NOT NULL THEN
    v_update := v_update || jsonb_build_object('eliminatedBy', p_eliminated_by);
  END IF;
  
  -- Update only the specific player
  UPDATE rooms
  SET players = players || jsonb_build_object(p_player_uid, players->p_player_uid || v_update)
  WHERE id = p_room_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

-- Fix update_player_location_fast function
CREATE OR REPLACE FUNCTION update_player_location_fast(
  p_room_id TEXT,
  p_player_uid TEXT,
  p_latitude FLOAT,
  p_longitude FLOAT,
  p_accuracy FLOAT DEFAULT NULL
) RETURNS void AS $$
DECLARE
  v_location JSONB;
BEGIN
  -- Build location object
  v_location := jsonb_build_object(
    'latitude', p_latitude,
    'longitude', p_longitude
  );
  
  IF p_accuracy IS NOT NULL THEN
    v_location := v_location || jsonb_build_object('accuracy', p_accuracy);
  END IF;
  
  -- Update player location and timestamp
  UPDATE rooms
  SET players = players || jsonb_build_object(
    p_player_uid, 
    players->p_player_uid || jsonb_build_object(
      'location', v_location,
      'lastLocationUpdate', (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
    )
  )
  WHERE id = p_room_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

-- Fix complete_skillcheck_fast function
CREATE OR REPLACE FUNCTION complete_skillcheck_fast(
  p_room_id TEXT,
  p_skillcheck_id TEXT,
  p_player_uid TEXT
) RETURNS void AS $$
BEGIN
  -- Update the specific skillcheck in the array
  UPDATE rooms
  SET skillchecks = (
    SELECT jsonb_agg(
      CASE 
        WHEN (elem->>'id') = p_skillcheck_id THEN
          elem || jsonb_build_object(
            'isCompleted', true,
            'completedAt', (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
            'completedBy', (elem->'completedBy') || to_jsonb(p_player_uid)
          )
        ELSE elem
      END
    )
    FROM jsonb_array_elements(COALESCE(skillchecks, '[]'::jsonb)) AS elem
  )
  WHERE id = p_room_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

-- Fix mark_player_escaped_fast function
CREATE OR REPLACE FUNCTION mark_player_escaped_fast(
  p_room_id TEXT,
  p_player_uid TEXT
) RETURNS void AS $$
BEGIN
  -- Update player escape status
  UPDATE rooms
  SET 
    players = players || jsonb_build_object(
      p_player_uid, 
      players->p_player_uid || jsonb_build_object(
        'hasEscaped', true,
        'escapedAt', (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
      )
    ),
    escapearea = escapearea || jsonb_build_object(
      'escapedPlayers', 
      COALESCE(escapearea->'escapedPlayers', '[]'::jsonb) || to_jsonb(p_player_uid)
    )
  WHERE id = p_room_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

-- Fix any other SECURITY DEFINER functions from optimizedGameService.ts
-- Fix update_player_in_room function if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'update_player_in_room' 
    AND pronamespace = 'public'::regnamespace
  ) THEN
    CREATE OR REPLACE FUNCTION update_player_in_room(
      room_id TEXT,
      player_uid TEXT,
      player_data JSONB
    ) RETURNS void AS $func$
    BEGIN
      UPDATE rooms
      SET players = jsonb_set(
        players,
        array[player_uid],
        players->player_uid || player_data,
        true
      )
      WHERE id = room_id;
    END;
    $func$ LANGUAGE plpgsql SECURITY DEFINER
    SET search_path = public, pg_temp;
  END IF;
END $$;

-- Fix batch_update_player_locations function if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'batch_update_player_locations' 
    AND pronamespace = 'public'::regnamespace
  ) THEN
    CREATE OR REPLACE FUNCTION batch_update_player_locations(
      room_id TEXT,
      player_updates JSONB
    ) RETURNS void AS $func$
    DECLARE
      player_uid TEXT;
      player_data JSONB;
    BEGIN
      -- Update each player's location in a single query
      FOR player_uid, player_data IN SELECT * FROM jsonb_each(player_updates)
      LOOP
        UPDATE rooms
        SET players = jsonb_set(
          players,
          array[player_uid],
          players->player_uid || player_data,
          true
        )
        WHERE id = room_id;
      END LOOP;
    END;
    $func$ LANGUAGE plpgsql SECURITY DEFINER
    SET search_path = public, pg_temp;
  END IF;
END $$;

-- Additional Security Recommendations:

-- 1. For Auth OTP Long Expiry warning:
-- This needs to be configured in your Supabase Dashboard:
-- Go to Authentication > Settings > Auth Providers
-- Reduce OTP expiry time from default (3600 seconds) to something like 300 seconds (5 minutes)

-- 2. For Leaked Password Protection Disabled warning:
-- This also needs to be configured in your Supabase Dashboard:
-- Go to Authentication > Settings > Security
-- Enable "Leaked password protection"

-- 3. Additional security hardening for functions
-- Revoke unnecessary permissions and re-grant only to authenticated users
REVOKE ALL ON FUNCTION eliminate_player_fast FROM PUBLIC;
REVOKE ALL ON FUNCTION update_player_location_fast FROM PUBLIC;
REVOKE ALL ON FUNCTION complete_skillcheck_fast FROM PUBLIC;
REVOKE ALL ON FUNCTION mark_player_escaped_fast FROM PUBLIC;

GRANT EXECUTE ON FUNCTION eliminate_player_fast TO authenticated;
GRANT EXECUTE ON FUNCTION update_player_location_fast TO authenticated;
GRANT EXECUTE ON FUNCTION complete_skillcheck_fast TO authenticated;
GRANT EXECUTE ON FUNCTION mark_player_escaped_fast TO authenticated;

-- Create a function to handle the "I was caught" action more efficiently
-- This should help with the refresh issue
CREATE OR REPLACE FUNCTION handle_player_caught(
  p_room_id TEXT,
  p_survivor_uid TEXT,
  p_killer_uid TEXT
) RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_room_status TEXT;
  v_is_alive BOOLEAN;
BEGIN
  -- Start transaction with explicit lock to prevent race conditions
  LOCK TABLE rooms IN ROW EXCLUSIVE MODE;
  
  -- Check room status and player state in one query
  SELECT status, (players->p_survivor_uid->>'isAlive')::boolean
  INTO v_room_status, v_is_alive
  FROM rooms
  WHERE id = p_room_id;
  
  -- Validate conditions
  IF v_room_status != 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Room is not active');
  END IF;
  
  IF NOT v_is_alive THEN
    RETURN jsonb_build_object('success', false, 'error', 'Player already eliminated');
  END IF;
  
  -- Eliminate the player
  UPDATE rooms
  SET players = players || jsonb_build_object(
    p_survivor_uid, 
    players->p_survivor_uid || jsonb_build_object(
      'isAlive', false,
      'eliminatedAt', (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
      'eliminatedBy', p_killer_uid
    )
  )
  WHERE id = p_room_id;
  
  -- Return success
  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

GRANT EXECUTE ON FUNCTION handle_player_caught TO authenticated;

-- Add index on rooms.players for JSONB operations
CREATE INDEX IF NOT EXISTS idx_rooms_players_gin ON public.rooms USING gin(players);

-- Note: Run VACUUM ANALYZE separately after this script completes
-- VACUUM ANALYZE public.rooms;