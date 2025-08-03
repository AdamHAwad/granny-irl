-- Add escape area and completion tracking columns to rooms table
-- These support the new escape-based win condition system

ALTER TABLE rooms 
ADD COLUMN escapeArea JSONB,
ADD COLUMN allSkillchecksCompleted BOOLEAN DEFAULT false;

-- Update players column to support hasEscaped and escapedAt fields
-- Note: This doesn't change the column structure since players is already JSONB
-- The new fields (hasEscaped, escapedAt) will be added to player objects dynamically

-- Add comments to document the new columns
COMMENT ON COLUMN rooms.escapeArea IS 'Escape area revealed after timer expires or all skillchecks complete (EscapeArea object)';
COMMENT ON COLUMN rooms.allSkillchecksCompleted IS 'Whether all skillchecks have been completed by players';