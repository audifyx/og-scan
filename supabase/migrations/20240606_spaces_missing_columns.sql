-- ============================================================
-- Migration: Add all missing columns to spaces table
-- Fixes schema cache errors for: status, token_gated, rsvp_count, reminder_sent
-- ============================================================

-- status: used by admin panel to filter/update live/ended spaces
ALTER TABLE spaces
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'upcoming'
    CHECK (status IN ('upcoming', 'live', 'ended') OR status IS NULL);

-- Back-fill status from existing is_live / ended_at values
UPDATE spaces
  SET status =
    CASE
      WHEN is_live = true THEN 'live'
      WHEN ended_at IS NOT NULL THEN 'ended'
      ELSE 'upcoming'
    END
  WHERE status IS NULL OR status = 'upcoming';

-- token_gated: used by SpaceScheduler to show token-gate badge
ALTER TABLE spaces
  ADD COLUMN IF NOT EXISTS token_gated BOOLEAN NOT NULL DEFAULT false;

-- Back-fill: if token_gate_ca is set, mark as token_gated
UPDATE spaces
  SET token_gated = true
  WHERE token_gate_ca IS NOT NULL AND token_gate_ca != '';

-- rsvp_count: used by SpaceScheduler for RSVP display
ALTER TABLE spaces
  ADD COLUMN IF NOT EXISTS rsvp_count INTEGER NOT NULL DEFAULT 0;

-- reminder_sent: used by SpaceScheduler to track if reminder was dispatched
ALTER TABLE spaces
  ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN NOT NULL DEFAULT false;
