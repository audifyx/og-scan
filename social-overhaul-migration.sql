-- OrbitX Social overhaul — impressions, bookmarks, mutes/blocks, quote posts.
--
-- PRIVACY: post_impressions stores ONLY a one-way SHA-256 hash of the
-- anonymous per-browser visitor id (the orbitx_vid cookie/localStorage id,
-- or the hashed signed-in identity from statsIdentity.ts). The server
-- re-hashes the incoming vid with a fixed "orbitx-social-impression:"
-- salt before storing, so the stored value cannot be joined back to the
-- stats vid or to any account. NO raw IPs, NO user-agent strings,
-- NO raw user ids in this table. One viewer counts once per post per day.
--
-- user_bookmarks / user_mutes / user_blocks store the app's own user ids
-- (like follows does) — that is the user's own data, not analytics.
--
-- Safe to run repeatedly (IF NOT EXISTS / OR REPLACE / DROP POLICY IF EXISTS).
-- RLS: enabled with NO policies on post_impressions (service-role only,
-- via web/api/_social.js). Own-rows-only policies on the three user tables
-- so the Supabase client can also read them directly if needed.
-- PostgREST picks up new tables/functions automatically (schema reload on DDL).

-- ── 1. Post impressions / views ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.post_impressions (
  post_id UUID NOT NULL REFERENCES public.social_messages(id) ON DELETE CASCADE,
  viewer_hash TEXT NOT NULL,
  view_date DATE NOT NULL DEFAULT (CURRENT_DATE AT TIME ZONE 'America/New_York'),
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, viewer_hash, view_date)
);

CREATE INDEX IF NOT EXISTS post_impressions_post_idx
  ON public.post_impressions (post_id, viewed_at DESC);
CREATE INDEX IF NOT EXISTS post_impressions_viewed_idx
  ON public.post_impressions (viewed_at DESC);

ALTER TABLE public.post_impressions ENABLE ROW LEVEL SECURITY;
-- No policies: anon/authenticated get nothing; service role bypasses RLS.

-- ── 2. Synced bookmarks ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_bookmarks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  post_id UUID NOT NULL REFERENCES public.social_messages(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, post_id)
);

CREATE INDEX IF NOT EXISTS user_bookmarks_user_idx
  ON public.user_bookmarks (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS user_bookmarks_post_idx
  ON public.user_bookmarks (post_id);

ALTER TABLE public.user_bookmarks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_bookmarks_own_select ON public.user_bookmarks;
CREATE POLICY user_bookmarks_own_select ON public.user_bookmarks
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS user_bookmarks_own_insert ON public.user_bookmarks;
CREATE POLICY user_bookmarks_own_insert ON public.user_bookmarks
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS user_bookmarks_own_delete ON public.user_bookmarks;
CREATE POLICY user_bookmarks_own_delete ON public.user_bookmarks
  FOR DELETE USING (auth.uid() = user_id);

-- ── 3. Mute list ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_mutes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  muter_id UUID NOT NULL,
  muted_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (muter_id, muted_user_id),
  CHECK (muter_id <> muted_user_id)
);

CREATE INDEX IF NOT EXISTS user_mutes_muter_idx
  ON public.user_mutes (muter_id, created_at DESC);

ALTER TABLE public.user_mutes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_mutes_own_select ON public.user_mutes;
CREATE POLICY user_mutes_own_select ON public.user_mutes
  FOR SELECT USING (auth.uid() = muter_id);
DROP POLICY IF EXISTS user_mutes_own_insert ON public.user_mutes;
CREATE POLICY user_mutes_own_insert ON public.user_mutes
  FOR INSERT WITH CHECK (auth.uid() = muter_id);
DROP POLICY IF EXISTS user_mutes_own_delete ON public.user_mutes;
CREATE POLICY user_mutes_own_delete ON public.user_mutes
  FOR DELETE USING (auth.uid() = muter_id);

-- ── 4. Block list ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_blocks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  blocker_id UUID NOT NULL,
  blocked_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (blocker_id, blocked_user_id),
  CHECK (blocker_id <> blocked_user_id)
);

CREATE INDEX IF NOT EXISTS user_blocks_blocker_idx
  ON public.user_blocks (blocker_id, created_at DESC);

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_blocks_own_select ON public.user_blocks;
CREATE POLICY user_blocks_own_select ON public.user_blocks
  FOR SELECT USING (auth.uid() = blocker_id);
DROP POLICY IF EXISTS user_blocks_own_insert ON public.user_blocks;
CREATE POLICY user_blocks_own_insert ON public.user_blocks
  FOR INSERT WITH CHECK (auth.uid() = blocker_id);
DROP POLICY IF EXISTS user_blocks_own_delete ON public.user_blocks;
CREATE POLICY user_blocks_own_delete ON public.user_blocks
  FOR DELETE USING (auth.uid() = blocker_id);

-- ── 5. Quote posts ───────────────────────────────────────────────────────
-- social_messages already has repost_of (repost) and reply_to (reply).
-- quoted_post_id is the third relation: a post that embeds another post
-- with added commentary (like X quote posts). Nullable, self-referencing.
ALTER TABLE public.social_messages
  ADD COLUMN IF NOT EXISTS quoted_post_id UUID
  REFERENCES public.social_messages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS social_messages_quoted_idx
  ON public.social_messages (quoted_post_id);

-- ── 6. Post analytics (counts only — never returns viewer hashes) ────────
CREATE OR REPLACE FUNCTION public.social_post_analytics(p_post_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_post public.social_messages%ROWTYPE;
  v_out JSONB;
BEGIN
  SELECT * INTO v_post FROM public.social_messages WHERE id = p_post_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'post_not_found');
  END IF;

  SELECT jsonb_build_object(
    'ok', true,
    'post_id', p_post_id,
    'author_user_id', v_post.user_id,
    'username', v_post.username,
    'created_at', v_post.created_at,
    'views', (SELECT count(*) FROM public.post_impressions WHERE post_id = p_post_id),
    'unique_viewers', (SELECT count(DISTINCT viewer_hash) FROM public.post_impressions WHERE post_id = p_post_id),
    'likes', COALESCE(v_post.likes_count, 0),
    'replies', (SELECT count(*) FROM public.social_messages WHERE reply_to = p_post_id),
    'reposts', (SELECT count(*) FROM public.social_messages WHERE repost_of = p_post_id),
    'quotes', (SELECT count(*) FROM public.social_messages WHERE quoted_post_id = p_post_id),
    'bookmarks', (SELECT count(*) FROM public.user_bookmarks WHERE post_id = p_post_id),
    'daily', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('day', d, 'views', v, 'viewers', u) ORDER BY d)
      FROM (
        SELECT view_date AS d, count(*) AS v, count(DISTINCT viewer_hash) AS u
        FROM public.post_impressions
        WHERE post_id = p_post_id AND view_date >= CURRENT_DATE - 13
        GROUP BY view_date
      ) s
    ), '[]'::jsonb)
  ) INTO v_out;
  RETURN v_out;
END;
$$;

-- ── 7. Profile analytics (counts only — never returns viewer hashes) ─────
CREATE OR REPLACE FUNCTION public.social_profile_analytics(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_out JSONB;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.social_messages WHERE user_id = p_user_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_posts');
  END IF;

  SELECT jsonb_build_object(
    'ok', true,
    'user_id', p_user_id,
    'post_count', (SELECT count(*) FROM public.social_messages WHERE user_id = p_user_id AND reply_to IS NULL),
    'total_views', (
      SELECT count(*) FROM public.post_impressions i
      JOIN public.social_messages m ON m.id = i.post_id
      WHERE m.user_id = p_user_id
    ),
    'reach', (
      SELECT count(DISTINCT i.viewer_hash) FROM public.post_impressions i
      JOIN public.social_messages m ON m.id = i.post_id
      WHERE m.user_id = p_user_id
    ),
    'total_likes', (SELECT COALESCE(SUM(likes_count), 0) FROM public.social_messages WHERE user_id = p_user_id),
    'total_replies', (
      SELECT count(*) FROM public.social_messages r
      JOIN public.social_messages m ON m.id = r.reply_to
      WHERE m.user_id = p_user_id
    ),
    'total_reposts', (
      SELECT count(*) FROM public.social_messages r
      JOIN public.social_messages m ON m.id = r.repost_of
      WHERE m.user_id = p_user_id
    ),
    'total_quotes', (
      SELECT count(*) FROM public.social_messages r
      JOIN public.social_messages m ON m.id = r.quoted_post_id
      WHERE m.user_id = p_user_id
    ),
    'total_bookmarks', (
      SELECT count(*) FROM public.user_bookmarks b
      JOIN public.social_messages m ON m.id = b.post_id
      WHERE m.user_id = p_user_id
    ),
    'followers', (SELECT count(*) FROM public.follows WHERE followee_id = p_user_id),
    'following', (SELECT count(*) FROM public.follows WHERE follower_id = p_user_id),
    'engagement', (
      SELECT COALESCE(SUM(likes_count), 0)
        + (SELECT count(*) FROM public.social_messages r JOIN public.social_messages m ON m.id = r.reply_to WHERE m.user_id = p_user_id)
        + (SELECT count(*) FROM public.social_messages r JOIN public.social_messages m ON m.id = r.repost_of WHERE m.user_id = p_user_id)
        + (SELECT count(*) FROM public.social_messages r JOIN public.social_messages m ON m.id = r.quoted_post_id WHERE m.user_id = p_user_id)
      FROM public.social_messages WHERE user_id = p_user_id
    ),
    'daily', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('day', d, 'views', v, 'viewers', u) ORDER BY d)
      FROM (
        SELECT i.view_date AS d, count(*) AS v, count(DISTINCT i.viewer_hash) AS u
        FROM public.post_impressions i
        JOIN public.social_messages m ON m.id = i.post_id
        WHERE m.user_id = p_user_id AND i.view_date >= CURRENT_DATE - 13
        GROUP BY i.view_date
      ) s
    ), '[]'::jsonb),
    'top_posts', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
          'id', t.id, 'content', LEFT(COALESCE(t.content, ''), 120),
          'created_at', t.created_at,
          'views', COALESCE(t.views, 0),
          'likes', COALESCE(t.likes, 0),
          'replies', t.replies,
          'reposts', t.reposts
        ) ORDER BY COALESCE(t.views, 0) DESC)
      FROM (
        SELECT m.id, m.content, m.created_at, m.likes_count AS likes,
          COALESCE(v.views, 0) AS views,
          (SELECT count(*) FROM public.social_messages WHERE reply_to = m.id) AS replies,
          (SELECT count(*) FROM public.social_messages WHERE repost_of = m.id) AS reposts
        FROM (
          SELECT m2.id, m2.content, m2.created_at, m2.likes_count
          FROM public.social_messages m2 WHERE m2.user_id = p_user_id AND m2.reply_to IS NULL
          ORDER BY m2.created_at DESC LIMIT 50
        ) m
        LEFT JOIN (SELECT post_id, count(*) AS views FROM public.post_impressions GROUP BY post_id) v
          ON v.post_id = m.id
        ORDER BY COALESCE(v.views, 0) DESC LIMIT 10
      ) t
    ), '[]'::jsonb)
  ) INTO v_out;
  RETURN v_out;
END;
$$;
