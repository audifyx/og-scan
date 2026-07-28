-- ============================================================
-- 008: Social on markets + automated oracle resolution metadata
-- ============================================================

-- ─── Comments on markets ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bet_comments (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bet_id      UUID NOT NULL REFERENCES public.bets(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  body        TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
  like_count  INTEGER NOT NULL DEFAULT 0,
  deleted     BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  edited_at   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_bet_comments_bet ON public.bet_comments(bet_id, created_at DESC);

-- ─── Comment likes ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.comment_likes (
  comment_id  UUID NOT NULL REFERENCES public.bet_comments(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (comment_id, user_id)
);

-- keep like_count in sync
CREATE OR REPLACE FUNCTION public.sync_comment_like_count() RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.bet_comments SET like_count = like_count + 1 WHERE id = NEW.comment_id;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE public.bet_comments SET like_count = GREATEST(0, like_count - 1) WHERE id = OLD.comment_id;
  END IF;
  RETURN NULL;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;
DROP TRIGGER IF EXISTS trg_comment_like_count ON public.comment_likes;
CREATE TRIGGER trg_comment_like_count
  AFTER INSERT OR DELETE ON public.comment_likes
  FOR EACH ROW EXECUTE FUNCTION public.sync_comment_like_count();

-- ─── Follows (social graph) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.follows (
  follower_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  following_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id)
);
CREATE INDEX IF NOT EXISTS idx_follows_following ON public.follows(following_id);

-- ─── Automated resolution metadata on bets ────────────────────
ALTER TABLE public.bets ADD COLUMN IF NOT EXISTS auto_resolve          BOOLEAN     NOT NULL DEFAULT false;
ALTER TABLE public.bets ADD COLUMN IF NOT EXISTS resolution_kind       TEXT        NOT NULL DEFAULT 'manual'
  CHECK (resolution_kind IN ('manual','crypto_price','sports_match'));
ALTER TABLE public.bets ADD COLUMN IF NOT EXISTS resolution_config     JSONB       NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.bets ADD COLUMN IF NOT EXISTS resolution_status     TEXT        NOT NULL DEFAULT 'pending'
  CHECK (resolution_status IN ('pending','resolved','failed','skipped'));
ALTER TABLE public.bets ADD COLUMN IF NOT EXISTS resolves_at           TIMESTAMPTZ;
ALTER TABLE public.bets ADD COLUMN IF NOT EXISTS resolution_checked_at TIMESTAMPTZ;
ALTER TABLE public.bets ADD COLUMN IF NOT EXISTS resolution_note       TEXT;
CREATE INDEX IF NOT EXISTS idx_bets_autoresolve ON public.bets(auto_resolve, resolution_status, resolves_at)
  WHERE auto_resolve = true;

-- ─── Row Level Security ───────────────────────────────────────
ALTER TABLE public.bet_comments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows       ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS comments_public_read ON public.bet_comments;
DROP POLICY IF EXISTS comments_self_insert ON public.bet_comments;
DROP POLICY IF EXISTS comments_self_update ON public.bet_comments;
DROP POLICY IF EXISTS comments_self_delete ON public.bet_comments;
CREATE POLICY comments_public_read ON public.bet_comments FOR SELECT USING (true);
CREATE POLICY comments_self_insert ON public.bet_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY comments_self_update ON public.bet_comments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY comments_self_delete ON public.bet_comments FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS likes_public_read ON public.comment_likes;
DROP POLICY IF EXISTS likes_self_insert ON public.comment_likes;
DROP POLICY IF EXISTS likes_self_delete ON public.comment_likes;
CREATE POLICY likes_public_read ON public.comment_likes FOR SELECT USING (true);
CREATE POLICY likes_self_insert ON public.comment_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY likes_self_delete ON public.comment_likes FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS follows_public_read ON public.follows;
DROP POLICY IF EXISTS follows_self_insert ON public.follows;
DROP POLICY IF EXISTS follows_self_delete ON public.follows;
CREATE POLICY follows_public_read ON public.follows FOR SELECT USING (true);
CREATE POLICY follows_self_insert ON public.follows FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = follower_id AND p.user_id = auth.uid())
);
CREATE POLICY follows_self_delete ON public.follows FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = follower_id AND p.user_id = auth.uid())
);

-- ─── grants ───────────────────────────────────────────────────
GRANT SELECT ON public.bet_comments, public.comment_likes, public.follows TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bet_comments TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.comment_likes, public.follows TO authenticated;
