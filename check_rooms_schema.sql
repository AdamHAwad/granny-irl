-- Check current schema of rooms table
-- Run this in Supabase SQL Editor to see all columns

SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM 
    information_schema.columns 
WHERE 
    table_name = 'rooms'
ORDER BY 
    ordinal_position;