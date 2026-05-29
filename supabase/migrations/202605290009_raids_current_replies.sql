-- Fix: add missing current_replies column to community_raids
-- The column was defined in the app code but missing from the live DB schema
ALTER TABLE community_raids 
  ADD COLUMN IF NOT EXISTS current_replies INTEGER DEFAULT 0;
