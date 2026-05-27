-- ============================================================
-- Migration: Add missing scheduler columns to spaces table
-- Fixes: "Could not find the 'recurrence_type' column of 'spaces'"
-- ============================================================

-- Add is_recurring flag (default false = not a recurring space)
ALTER TABLE spaces
  ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN NOT NULL DEFAULT false;

-- Add recurrence_type (e.g. 'weekly', 'daily', 'monthly' — nullable for one-off spaces)
ALTER TABLE spaces
  ADD COLUMN IF NOT EXISTS recurrence_type TEXT
    CHECK (recurrence_type IN ('daily', 'weekly', 'biweekly', 'monthly') OR recurrence_type IS NULL);

-- Add rsvp_count shortcut column (maintained by trigger or app logic)
ALTER TABLE spaces
  ADD COLUMN IF NOT EXISTS rsvp_count INTEGER NOT NULL DEFAULT 0;

-- Add reminder_sent flag (so scheduler knows not to double-send)
ALTER TABLE spaces
  ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN NOT NULL DEFAULT false;

-- Add token_gated alias (SpaceScheduler uses token_gated, Spaces.tsx uses token_gate_ca)
ALTER TABLE spaces
  ADD COLUMN IF NOT EXISTS token_gated BOOLEAN NOT NULL DEFAULT false;

-- Indexes for scheduler queries
CREATE INDEX IF NOT EXISTS spaces_is_recurring_idx ON spaces(is_recurring) WHERE is_recurring = true;
CREATE INDEX IF NOT EXISTS spaces_scheduled_for_idx ON spaces(scheduled_for) WHERE scheduled_for IS NOT NULL;
CREATE INDEX IF NOT EXISTS spaces_host_id_scheduled_idx ON spaces(host_id, scheduled_for);
