-- ============================================================
-- Rich Post Media & Composer v2
-- Adds link previews, YouTube embeds, X Spaces embeds,
-- post badges, and pinned X Space feed to community_posts
-- ============================================================

-- Link preview fields
ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS link_url        TEXT,
  ADD COLUMN IF NOT EXISTS link_title      TEXT,
  ADD COLUMN IF NOT EXISTS link_description TEXT,
  ADD COLUMN IF NOT EXISTS link_image_url  TEXT,
  ADD COLUMN IF NOT EXISTS link_favicon_url TEXT,
  ADD COLUMN IF NOT EXISTS link_domain     TEXT;

-- YouTube embed
ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS youtube_url     TEXT,
  ADD COLUMN IF NOT EXISTS youtube_id      TEXT,
  ADD COLUMN IF NOT EXISTS youtube_title   TEXT;

-- X Space embed / join link
ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS x_space_url    TEXT,
  ADD COLUMN IF NOT EXISTS x_space_title  TEXT,
  ADD COLUMN IF NOT EXISTS x_space_live   BOOLEAN DEFAULT FALSE;

-- OGScan LiveKit space embed inside post
ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS embed_space_id TEXT;

-- Post badge (🔥 Alpha | 📊 Analysis | 🚨 Signal | 🧠 Research | 💡 Idea | 🎯 Call | 📰 News)
ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS post_badge TEXT;

-- X post only flag (for X-only feed tab)
ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS is_x_post      BOOLEAN DEFAULT FALSE;

-- Index for X-only feed
CREATE INDEX IF NOT EXISTS idx_community_posts_x_post
  ON public.community_posts (is_x_post, created_at DESC)
  WHERE is_x_post = TRUE;

-- Index for posts with link previews
CREATE INDEX IF NOT EXISTS idx_community_posts_link
  ON public.community_posts (link_url)
  WHERE link_url IS NOT NULL;

-- Index for posts with youtube
CREATE INDEX IF NOT EXISTS idx_community_posts_youtube
  ON public.community_posts (youtube_id)
  WHERE youtube_id IS NOT NULL;

-- Shared X Spaces feed table (users can share X spaces to communities)
CREATE TABLE IF NOT EXISTS public.community_x_spaces (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id    UUID REFERENCES public.communities(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username        TEXT,
  avatar_url      TEXT,
  x_space_url     TEXT NOT NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  is_live         BOOLEAN DEFAULT FALSE,
  listener_count  INTEGER DEFAULT 0,
  started_at      TIMESTAMPTZ,
  ended_at        TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.community_x_spaces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cx_spaces_read"   ON public.community_x_spaces FOR SELECT USING (TRUE);
CREATE POLICY "cx_spaces_insert" ON public.community_x_spaces FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "cx_spaces_update" ON public.community_x_spaces FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "cx_spaces_delete" ON public.community_x_spaces FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_cx_spaces_community ON public.community_x_spaces(community_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cx_spaces_live ON public.community_x_spaces(is_live, created_at DESC);
