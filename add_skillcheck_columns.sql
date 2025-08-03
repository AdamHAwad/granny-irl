-- Add skillcheck columns to rooms table
-- Run this in Supabase SQL Editor

-- Add skillchecks column (JSONB array to store skillcheck objects)
ALTER TABLE rooms 
ADD COLUMN IF NOT EXISTS skillchecks JSONB DEFAULT NULL;

-- Add skillcheckTimeExtensions column (integer for additional seconds)
ALTER TABLE rooms 
ADD COLUMN IF NOT EXISTS skillcheckTimeExtensions INTEGER DEFAULT NULL;

-- Verify columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'rooms' 
AND column_name IN ('skillchecks', 'skillcheckTimeExtensions');