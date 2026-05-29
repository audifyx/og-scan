-- ============================================================
-- X (Twitter) cross-post support
-- Adds Twitter OAuth token storage to profiles
-- and tweet_id/tweet_url tracking on community_posts
-- ============================================================

-- Twitter OAuth 2.0 tokens per user (for cross-posting with tweet.write scope)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS twitter_access_token  TEXT,
  ADD COLUMN IF NOT EXISTS twitter_refresh_token TEXT,
  ADD COLUMN IF NOT EXISTS twitter_token_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS twitter_id            TEXT,
  ADD COLUMN IF NOT EXISTS twitter_username      TEXT,
  ADD COLUMN IF NOT EXISTS twitter_name          TEXT,
  ADD COLUMN IF NOT EXISTS twitter_avatar        TEXT;

-- Track whether a community post was cross-posted to X
ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS tweet_id  TEXT,
  ADD COLUMN IF NOT EXISTS tweet_url TEXT;

-- Index for looking up posts by tweet_id (e.g. sync likes back from X)
CREATE INDEX IF NOT EXISTS idx_community_posts_tweet_id
  ON public.community_posts (tweet_id)
  WHERE tweet_id IS NOT NULL;
