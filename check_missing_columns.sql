-- Check which columns exist in the rooms table
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'rooms' 
AND column_name IN ('escapearea', 'allskillcheckscompleted', 'escape_timer_started_at')
ORDER BY column_name;

-- Add only missing columns (run the ones that don't appear in the results above)

-- If allskillcheckscompleted doesn't exist:
-- ALTER TABLE rooms ADD COLUMN allSkillchecksCompleted BOOLEAN DEFAULT false;

-- If escape_timer_started_at doesn't exist:
-- ALTER TABLE rooms ADD COLUMN escape_timer_started_at BIGINT;