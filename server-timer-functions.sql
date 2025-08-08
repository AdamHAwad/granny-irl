-- Server-Authoritative Timer System for Granny IRL
-- This replaces client-side timer calculations with server-calculated remaining times
-- Eliminates +25s desync issues caused by client clock drift and network timing

-- Function to get room with server-calculated timer values
CREATE OR REPLACE FUNCTION get_room_with_timers(p_room_id TEXT)
RETURNS JSONB AS $$
DECLARE
    room_record RECORD;
    current_time BIGINT;
    headstart_remaining BIGINT;
    active_remaining BIGINT;
    escape_remaining BIGINT;
    result JSONB;
BEGIN
    -- Get current server time in milliseconds (same as JavaScript Date.now())
    current_time := EXTRACT(EPOCH FROM NOW() AT TIME ZONE 'UTC') * 1000;
    
    -- Fetch room data
    SELECT * INTO room_record 
    FROM rooms 
    WHERE id = p_room_id;
    
    IF NOT FOUND THEN
        RETURN NULL;
    END IF;
    
    -- Initialize remaining times to NULL
    headstart_remaining := NULL;
    active_remaining := NULL;
    escape_remaining := NULL;
    
    -- Calculate headstart timer (if in headstart phase)
    IF room_record.status = 'headstart' AND room_record.headstart_started_at IS NOT NULL THEN
        headstart_remaining := GREATEST(0, 
            (room_record.headstart_started_at + 
             (room_record.settings->>'headstartMinutes')::NUMERIC * 60 * 1000) 
            - current_time
        );
    END IF;
    
    -- Calculate active timer (if in active phase)
    IF room_record.status = 'active' AND room_record.game_started_at IS NOT NULL THEN
        active_remaining := GREATEST(0, 
            (room_record.game_started_at + 
             (room_record.settings->>'roundLengthMinutes')::NUMERIC * 60 * 1000) 
            - current_time
        );
    END IF;
    
    -- Calculate escape timer (if escape area is revealed and timer started)
    IF room_record.status = 'active' AND room_record.escape_timer_started_at IS NOT NULL THEN
        escape_remaining := GREATEST(0, 
            (room_record.escape_timer_started_at + (10 * 60 * 1000)) -- 10 minutes
            - current_time
        );
    END IF;
    
    -- Convert room record to JSONB and add calculated timers
    result := to_jsonb(room_record);
    
    -- Add server-calculated timer values
    result := result || jsonb_build_object(
        'server_time', current_time,
        'headstart_remaining_ms', headstart_remaining,
        'active_remaining_ms', active_remaining,
        'escape_remaining_ms', escape_remaining,
        'timer_calculated_at', current_time
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to update room timers (called periodically)
CREATE OR REPLACE FUNCTION update_room_timers()
RETURNS INTEGER AS $$
DECLARE
    room_count INTEGER := 0;
    room_record RECORD;
    current_time BIGINT;
BEGIN
    -- Get current server time
    current_time := EXTRACT(EPOCH FROM NOW() AT TIME ZONE 'UTC') * 1000;
    
    -- Update all active rooms with current timer values
    FOR room_record IN 
        SELECT id, status, headstart_started_at, game_started_at, escape_timer_started_at, settings
        FROM rooms 
        WHERE status IN ('headstart', 'active')
    LOOP
        -- Update room with server-calculated timers
        UPDATE rooms 
        SET 
            server_time = current_time,
            headstart_remaining_ms = CASE 
                WHEN room_record.status = 'headstart' AND room_record.headstart_started_at IS NOT NULL THEN
                    GREATEST(0, 
                        (room_record.headstart_started_at + 
                         (room_record.settings->>'headstartMinutes')::NUMERIC * 60 * 1000) 
                        - current_time
                    )
                ELSE NULL
            END,
            active_remaining_ms = CASE 
                WHEN room_record.status = 'active' AND room_record.game_started_at IS NOT NULL THEN
                    GREATEST(0, 
                        (room_record.game_started_at + 
                         (room_record.settings->>'roundLengthMinutes')::NUMERIC * 60 * 1000) 
                        - current_time
                    )
                ELSE NULL
            END,
            escape_remaining_ms = CASE 
                WHEN room_record.status = 'active' AND room_record.escape_timer_started_at IS NOT NULL THEN
                    GREATEST(0, 
                        (room_record.escape_timer_started_at + (10 * 60 * 1000)) -- 10 minutes
                        - current_time
                    )
                ELSE NULL
            END,
            timer_updated_at = current_time
        WHERE id = room_record.id;
        
        room_count := room_count + 1;
    END LOOP;
    
    RETURN room_count;
END;
$$ LANGUAGE plpgsql;

-- Add new columns to rooms table for server-calculated timers
ALTER TABLE rooms 
ADD COLUMN IF NOT EXISTS server_time BIGINT,
ADD COLUMN IF NOT EXISTS headstart_remaining_ms BIGINT,
ADD COLUMN IF NOT EXISTS active_remaining_ms BIGINT,
ADD COLUMN IF NOT EXISTS escape_remaining_ms BIGINT,
ADD COLUMN IF NOT EXISTS timer_updated_at BIGINT;

-- Create index for efficient timer queries
CREATE INDEX IF NOT EXISTS idx_rooms_timer_status ON rooms(status) WHERE status IN ('headstart', 'active');

-- USAGE INSTRUCTIONS:
-- 1. Run this SQL in Supabase SQL Editor to create the functions and add columns
-- 2. Set up a periodic job (every 1 second) to call update_room_timers()
-- 3. Update gameService.ts to use get_room_with_timers() instead of regular room queries
-- 4. Clients will receive server-calculated remaining times, eliminating desync

-- Example usage:
-- SELECT get_room_with_timers('ABC123');
-- SELECT update_room_timers();