-- Add escape timer column to rooms table
-- This tracks when the 10-minute escape timer started after escape area is revealed

ALTER TABLE rooms 
ADD COLUMN escape_timer_started_at BIGINT;

-- Add comment to document the column
COMMENT ON COLUMN rooms.escape_timer_started_at IS 'Timestamp when 10-minute escape timer started (after escape area revealed)';