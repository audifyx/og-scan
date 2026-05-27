-- ============================================================
-- Migration: Add recurrence columns to spaces table
-- ============================================================

ALTER TABLE spaces
  ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE spaces
  ADD COLUMN IF NOT EXISTS recurrence_type TEXT DEFAULT NULL
    CHECK (recurrence_type IN ('daily', 'weekly', 'biweekly', 'monthly') OR recurrence_type IS NULL);
