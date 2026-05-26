-- ====================================================================
-- OGScan Spaces Advanced v2 — Page Customization + X Integration
-- ====================================================================

-- 1. Add page_accent to user_profiles (accent color for public page)
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS page_accent TEXT DEFAULT 'violet'
    CHECK (page_accent IN ('violet','sky','emerald','amber','rose','cyan','pink','indigo'));

-- 2. Add twitter_handle to user_profiles if missing (some installs may not have it)
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS twitter_handle TEXT;

-- 3. Add website_url alias (some code uses website, some uses website_url)
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS website_url TEXT;

-- 4. Add display_name if missing
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS display_name TEXT;

-- 5. X Space Cards — user-surfaced X Spaces shown in OGScan feed
CREATE TABLE IF NOT EXISTS x_space_cards (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username        TEXT,
  title           TEXT NOT NULL DEFAULT 'X Space',
  x_space_url     TEXT NOT NULL,
  x_handle        TEXT,
  scheduled_for   TIMESTAMPTZ,
  is_live         BOOLEAN NOT NULL DEFAULT true,
  listener_count  INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for feed queries
CREATE INDEX IF NOT EXISTS x_space_cards_user_id_idx ON x_space_cards(user_id);
CREATE INDEX IF NOT EXISTS x_space_cards_is_live_idx ON x_space_cards(is_live);
CREATE INDEX IF NOT EXISTS x_space_cards_created_at_idx ON x_space_cards(created_at DESC);

-- RLS for x_space_cards
ALTER TABLE x_space_cards ENABLE ROW LEVEL SECURITY;

-- Anyone can read
CREATE POLICY IF NOT EXISTS "x_space_cards_select_all"
  ON x_space_cards FOR SELECT USING (true);

-- Only owner can insert
CREATE POLICY IF NOT EXISTS "x_space_cards_insert_own"
  ON x_space_cards FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Only owner can update
CREATE POLICY IF NOT EXISTS "x_space_cards_update_own"
  ON x_space_cards FOR UPDATE
  USING (auth.uid() = user_id);

-- Only owner can delete
CREATE POLICY IF NOT EXISTS "x_space_cards_delete_own"
  ON x_space_cards FOR DELETE
  USING (auth.uid() = user_id);

-- 6. Add peak_listeners and duration_seconds to spaces if not there
ALTER TABLE spaces
  ADD COLUMN IF NOT EXISTS peak_listeners INTEGER DEFAULT 0;

ALTER TABLE spaces
  ADD COLUMN IF NOT EXISTS duration_seconds INTEGER;

-- 7. Add recording_url to spaces if not there
ALTER TABLE spaces
  ADD COLUMN IF NOT EXISTS recording_url TEXT;

-- 8. Add category to spaces if not there
ALTER TABLE spaces
  ADD COLUMN IF NOT EXISTS category TEXT;

-- 9. Add pinned_tweet_url to spaces if not there
ALTER TABLE spaces
  ADD COLUMN IF NOT EXISTS pinned_tweet_url TEXT;

-- ====================================================================
-- GRANT anon/service_role access to x_space_cards
-- ====================================================================
GRANT SELECT ON x_space_cards TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON x_space_cards TO authenticated;
