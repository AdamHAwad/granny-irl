-- Add the missing allskillcheckscompleted column if it doesn't exist
-- Run this in Supabase SQL Editor

ALTER TABLE rooms ADD COLUMN IF NOT EXISTS allskillcheckscompleted BOOLEAN DEFAULT false;

-- Add comment
COMMENT ON COLUMN rooms.allskillcheckscompleted IS 'Whether all skillchecks have been completed by players';

-- Verify the column was added
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'rooms' 
AND column_name = 'allskillcheckscompleted';