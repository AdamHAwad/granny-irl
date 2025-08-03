-- Check the exact column names in the rooms table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'rooms'
ORDER BY ordinal_position;