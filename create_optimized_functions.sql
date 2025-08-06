-- Optimized Database Functions for Granny IRL
-- These functions allow updating specific fields without fetching entire records

-- Function to eliminate a player efficiently
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update player location efficiently
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to complete skillcheck efficiently
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark player as escaped efficiently
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION eliminate_player_fast TO authenticated;
GRANT EXECUTE ON FUNCTION update_player_location_fast TO authenticated;
GRANT EXECUTE ON FUNCTION complete_skillcheck_fast TO authenticated;
GRANT EXECUTE ON FUNCTION mark_player_escaped_fast TO authenticated;