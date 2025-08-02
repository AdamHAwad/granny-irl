-- Add missing columns to rooms table
ALTER TABLE rooms 
ADD COLUMN IF NOT EXISTS created_at bigint NOT NULL DEFAULT extract(epoch from now()) * 1000,
ADD COLUMN IF NOT EXISTS headstart_started_at bigint,
ADD COLUMN IF NOT EXISTS game_started_at bigint,
ADD COLUMN IF NOT EXISTS game_ended_at bigint;

-- Update the constraint to include the new timestamp columns
ALTER TABLE rooms ALTER COLUMN created_at SET DEFAULT extract(epoch from now()) * 1000;