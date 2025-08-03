-- Add skillcheckCenterLocation column to rooms table
-- This stores the pinned location from the map picker for skillcheck generation

ALTER TABLE rooms 
ADD COLUMN skillcheckCenterLocation JSONB;

-- Add a comment to document the column
COMMENT ON COLUMN rooms.skillcheckCenterLocation IS 'Pinned location from map picker for skillcheck generation (PlayerLocation object with latitude/longitude)';