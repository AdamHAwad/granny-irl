-- Fix rooms table to match TypeScript interface
ALTER TABLE rooms 
ADD COLUMN IF NOT EXISTS "createdAt" bigint,
ADD COLUMN IF NOT EXISTS "headstartStartedAt" bigint,
ADD COLUMN IF NOT EXISTS "gameStartedAt" bigint,
ADD COLUMN IF NOT EXISTS "gameEndedAt" bigint;

-- Copy data from snake_case to camelCase columns
UPDATE rooms SET 
  "createdAt" = created_at,
  "headstartStartedAt" = headstart_started_at,
  "gameStartedAt" = game_started_at,
  "gameEndedAt" = game_ended_at;

-- Drop old snake_case columns
ALTER TABLE rooms 
DROP COLUMN IF EXISTS created_at,
DROP COLUMN IF EXISTS headstart_started_at,
DROP COLUMN IF EXISTS game_started_at,
DROP COLUMN IF EXISTS game_ended_at;