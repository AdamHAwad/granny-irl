-- Delete all rooms for a fresh start
DELETE FROM rooms;

-- Also delete all game results
DELETE FROM game_results;

-- Reset any sequences if needed (PostgreSQL auto-generates IDs)
-- This ensures a completely clean slate