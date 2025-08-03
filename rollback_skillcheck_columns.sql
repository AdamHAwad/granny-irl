-- Rollback script - Remove skillcheck columns if needed
-- Only run this if you need to undo the changes

ALTER TABLE rooms 
DROP COLUMN IF EXISTS skillchecks;

ALTER TABLE rooms 
DROP COLUMN IF EXISTS skillcheckTimeExtensions;