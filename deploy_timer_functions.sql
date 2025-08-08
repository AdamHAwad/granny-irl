-- Deploy Server-Authoritative Timer Functions for Granny IRL
-- This will fix the +25 second timer desync issue by calculating timers server-side

-- Drop existing function first to avoid return type conflicts
DROP FUNCTION IF EXISTS get_room_with_timers(TEXT);

-- Create the main timer function that returns room data with server-calculated timers
CREATE OR REPLACE FUNCTION get_room_with_timers(p_room_id TEXT)
RETURNS TABLE (
  id TEXT,
  host_uid TEXT,
  players JSONB,
  settings JSONB,
  status TEXT,
  created_at BIGINT,
  headstart_started_at BIGINT,
  game_started_at BIGINT,
  game_ended_at BIGINT,
  skillchecks JSONB,
  skillcheckcenterlocation JSONB,
  escapearea JSONB,
  allskillcheckscompleted BOOLEAN,
  escape_timer_started_at BIGINT,
  -- NEW: Server-calculated timer fields
  headstart_remaining_ms BIGINT,
  active_remaining_ms BIGINT,
  escape_remaining_ms BIGINT
) AS $$
DECLARE
  room_record RECORD;
  current_time_ms BIGINT;
  headstart_end_ms BIGINT;
  game_end_ms BIGINT;
  escape_end_ms BIGINT;
BEGIN
  -- Get current server time in milliseconds
  current_time_ms := floor(EXTRACT(EPOCH FROM NOW()) * 1000);
  
  -- Get room data
  SELECT * INTO room_record FROM rooms WHERE rooms.id = p_room_id;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- Calculate headstart remaining time
  headstart_remaining_ms := 0;
  IF room_record.status = 'headstart' AND room_record.headstart_started_at IS NOT NULL THEN
    headstart_end_ms := room_record.headstart_started_at + 
                       ((room_record.settings->>'headstartMinutes')::FLOAT * 60 * 1000)::BIGINT;
    headstart_remaining_ms := GREATEST(0, headstart_end_ms - current_time_ms);
  END IF;
  
  -- Calculate active game remaining time
  active_remaining_ms := 0;
  IF room_record.status = 'active' AND room_record.game_started_at IS NOT NULL THEN
    game_end_ms := room_record.game_started_at + 
                  ((room_record.settings->>'roundLengthMinutes')::FLOAT * 60 * 1000)::BIGINT;
    active_remaining_ms := GREATEST(0, game_end_ms - current_time_ms);
  END IF;
  
  -- Calculate escape timer remaining time
  escape_remaining_ms := 0;
  IF room_record.status = 'active' AND room_record.escape_timer_started_at IS NOT NULL THEN
    escape_end_ms := room_record.escape_timer_started_at + (10 * 60 * 1000); -- 10 minutes
    escape_remaining_ms := GREATEST(0, escape_end_ms - current_time_ms);
  END IF;
  
  -- Return room data with calculated timers
  RETURN QUERY SELECT 
    room_record.id,
    room_record.host_uid,
    room_record.players,
    room_record.settings,
    room_record.status,
    room_record.created_at,
    room_record.headstart_started_at,
    room_record.game_started_at,
    room_record.game_ended_at,
    room_record.skillchecks,
    room_record.skillcheckcenterlocation,
    room_record.escapearea,
    room_record.allskillcheckscompleted,
    room_record.escape_timer_started_at,
    headstart_remaining_ms,
    active_remaining_ms,
    escape_remaining_ms;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_room_with_timers TO authenticated;

-- Create an index to optimize the room lookup
CREATE INDEX IF NOT EXISTS idx_rooms_id_status ON rooms(id, status);

-- Revoke public access for security
REVOKE ALL ON FUNCTION get_room_with_timers FROM PUBLIC;