-- ════════════════════════════════════════════════════════════════════
-- OrbitX DEX — Ads, Boosts, Listings & Saved Filters
-- File: dex-ads-boosts-listings.sql
-- DO NOT APPLY AUTOMATICALLY. Apply manually in the Supabase SQL editor
-- (or `supabase db push` after copying into supabase/migrations/) and
-- verify with the queries at the end of this file.
--
-- What this creates
--   dex_boosts         paid token boosts (DexScreener-style tiers)
--   dex_listings       curated token listings awaiting admin approval
--   dex_ads            ad creatives (token / section / global targets)
--   dex_ad_placements  one row per placement slot an ad occupies
--   dex_saved_filters  per-user saved DEX filter presets
--   public.is_admin()  SECURITY DEFINER helper used by every write policy
--
-- ADMIN-CHECK ASSUMPTION (read before applying)
--   The app gates the admin desk client-side on the owner email + desk
--   unlock (web/src/hooks/useAdmin.tsx), and the client reads/writes an
--   `admin_roles` table (roles "owner" / "admin" / "user", see
--   web/src/components/admin/sections/UserManagement.tsx). BUT no
--   migration in supabase/migrations/ creates `admin_roles` and no
--   is_admin() SQL helper exists anywhere in the repo.
--   This file therefore creates `public.admin_roles` IF NOT EXISTS
--   (id uuid pk, user_id uuid unique, role text, created_at) and defines
--   public.is_admin() as: auth.uid() has a row in admin_roles with
--   role IN ('owner','admin').
--   If admin_roles already exists in the live DB with a different shape,
--   the CREATE TABLE IF NOT EXISTS is a no-op and is_admin() still works
--   as long as the columns user_id + role exist. If the live DB instead
--   gates admins some other way (e.g. an owner-email allowlist in
--   app_metadata), replace the body of is_admin() before applying.
--   RLS on admin_roles itself: only admins can read/write it (anons get
--   nothing), so a non-admin cannot self-promote through the anon key.
--
-- RLS summary
--   dex_boosts / dex_listings / dex_ads / dex_ad_placements:
--     - anon + authenticated may SELECT only rows that are currently
--       ACTIVE and inside their start/end window (public storefront read).
--     - INSERT / UPDATE / DELETE require is_admin().
--   dex_saved_filters:
--     - users SELECT / INSERT / UPDATE / DELETE only their own rows
--       (user_id = auth.uid()); admins may SELECT all rows.
-- ════════════════════════════════════════════════════════════════════

-- ── Admin roles (idempotent; the table is referenced by client code but
--    has no migration in the repo — see the assumption note above). ──
CREATE TABLE IF NOT EXISTS public.admin_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  role text NOT NULL CHECK (role IN ('owner', 'admin', 'support')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_roles ENABLE ROW LEVEL SECURITY;

-- NOTE (coordinator fix 2026-11-03): the previous version of this policy
-- checked admin_roles from inside a policy ON admin_roles itself
-- (EXISTS (SELECT ... FROM public.admin_roles ...)). Postgres raises
-- "infinite recursion detected in policy" at runtime for that pattern.
-- This version calls the SECURITY DEFINER is_admin() instead, which
-- bypasses RLS and cannot recurse.
-- BOOTSTRAP: no one can pass this policy until a first owner row exists.
-- Insert the first owner row once via the Supabase SQL editor (the
-- postgres role bypasses RLS): INSERT INTO public.admin_roles
-- (user_id, role) VALUES ('<owner auth user id>', 'owner');
DROP POLICY IF EXISTS admin_roles_admin_all ON public.admin_roles;
CREATE POLICY admin_roles_admin_all ON public.admin_roles
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── is_admin() helper ────────────────────────────────────────────────
-- SECURITY DEFINER so the RLS policies below can read admin_roles even
-- though anon/authenticated cannot SELECT it directly. STABLE, and it
-- returns false (not an error) when nobody is signed in.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_roles
    WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
  );
$$;

-- ── Shared enums ─────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE public.dex_boost_tier AS ENUM ('standard', 'premium', 'turbo');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.dex_ad_placement AS ENUM ('home-top', 'home-feed', 'trending', 'token-detail');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.dex_ad_target_type AS ENUM ('token', 'section', 'global');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── dex_boosts ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dex_boosts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mint text NOT NULL,
  tier public.dex_boost_tier NOT NULL DEFAULT 'standard',
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'expired', 'cancelled')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One active boost per token at a time (a token re-boosts after expiry).
CREATE UNIQUE INDEX IF NOT EXISTS dex_boosts_one_active_per_mint
  ON public.dex_boosts (mint) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS dex_boosts_mint_status_idx
  ON public.dex_boosts (mint, status, ends_at);
CREATE INDEX IF NOT EXISTS dex_boosts_active_window_idx
  ON public.dex_boosts (starts_at, ends_at)
  WHERE status = 'active';

ALTER TABLE public.dex_boosts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dex_boosts_public_active ON public.dex_boosts;
CREATE POLICY dex_boosts_public_active ON public.dex_boosts
  FOR SELECT TO anon, authenticated
  USING (
    status = 'active'
    AND starts_at <= now()
    AND (ends_at IS NULL OR ends_at > now())
  );

DROP POLICY IF EXISTS dex_boosts_admin_write ON public.dex_boosts;
CREATE POLICY dex_boosts_admin_write ON public.dex_boosts
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── dex_listings ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dex_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mint text NOT NULL UNIQUE,
  symbol text,
  name text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  listed_at timestamptz,
  source text NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'submission', 'import')),
  submitted_by uuid,
  reviewed_by uuid,
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dex_listings_mint_status_idx
  ON public.dex_listings (mint, status);
CREATE INDEX IF NOT EXISTS dex_listings_status_created_idx
  ON public.dex_listings (status, created_at DESC);

ALTER TABLE public.dex_listings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dex_listings_public_approved ON public.dex_listings;
CREATE POLICY dex_listings_public_approved ON public.dex_listings
  FOR SELECT TO anon, authenticated
  USING (status = 'approved');

DROP POLICY IF EXISTS dex_listings_admin_write ON public.dex_listings;
CREATE POLICY dex_listings_admin_write ON public.dex_listings
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── dex_ads ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dex_ads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text,
  image_url text,
  link_url text,
  target_type public.dex_ad_target_type NOT NULL DEFAULT 'global',
  target_mint text,
  target_section text,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'paused', 'ended')),
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dex_ads_target_mint_required
    CHECK (target_type <> 'token' OR target_mint IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS dex_ads_status_window_idx
  ON public.dex_ads (status, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS dex_ads_target_mint_idx
  ON public.dex_ads (target_mint) WHERE target_type = 'token';

ALTER TABLE public.dex_ads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dex_ads_public_active ON public.dex_ads;
CREATE POLICY dex_ads_public_active ON public.dex_ads
  FOR SELECT TO anon, authenticated
  USING (
    status = 'active'
    AND starts_at <= now()
    AND (ends_at IS NULL OR ends_at > now())
  );

DROP POLICY IF EXISTS dex_ads_admin_write ON public.dex_ads;
CREATE POLICY dex_ads_admin_write ON public.dex_ads
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── dex_ad_placements ────────────────────────────────────────────────
-- An ad can occupy several placements; a placement slot shows the
-- highest-priority active placement whose window is open and whose ad
-- is itself active. The client (web/src/lib/dexAds.ts) resolves that.
CREATE TABLE IF NOT EXISTS public.dex_ad_placements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id uuid NOT NULL REFERENCES public.dex_ads (id) ON DELETE CASCADE,
  placement public.dex_ad_placement NOT NULL,
  section text,
  priority int NOT NULL DEFAULT 0,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dex_ad_placements_hot_idx
  ON public.dex_ad_placements (placement, active, priority DESC, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS dex_ad_placements_ad_idx
  ON public.dex_ad_placements (ad_id);

ALTER TABLE public.dex_ad_placements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dex_ad_placements_public_active ON public.dex_ad_placements;
CREATE POLICY dex_ad_placements_public_active ON public.dex_ad_placements
  FOR SELECT TO anon, authenticated
  USING (
    active = true
    AND starts_at <= now()
    AND (ends_at IS NULL OR ends_at > now())
  );

DROP POLICY IF EXISTS dex_ad_placements_admin_write ON public.dex_ad_placements;
CREATE POLICY dex_ad_placements_admin_write ON public.dex_ad_placements
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── dex_saved_filters ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dex_saved_filters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dex_saved_filters_user_idx
  ON public.dex_saved_filters (user_id, created_at DESC);

ALTER TABLE public.dex_saved_filters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dex_saved_filters_own_all ON public.dex_saved_filters;
CREATE POLICY dex_saved_filters_own_all ON public.dex_saved_filters
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS dex_saved_filters_admin_read ON public.dex_saved_filters;
CREATE POLICY dex_saved_filters_admin_read ON public.dex_saved_filters
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- ── updated_at maintenance ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.dex_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS dex_boosts_touch ON public.dex_boosts;
CREATE TRIGGER dex_boosts_touch
  BEFORE UPDATE ON public.dex_boosts
  FOR EACH ROW EXECUTE FUNCTION public.dex_touch_updated_at();

DROP TRIGGER IF EXISTS dex_listings_touch ON public.dex_listings;
CREATE TRIGGER dex_listings_touch
  BEFORE UPDATE ON public.dex_listings
  FOR EACH ROW EXECUTE FUNCTION public.dex_touch_updated_at();

DROP TRIGGER IF EXISTS dex_ads_touch ON public.dex_ads;
CREATE TRIGGER dex_ads_touch
  BEFORE UPDATE ON public.dex_ads
  FOR EACH ROW EXECUTE FUNCTION public.dex_touch_updated_at();

DROP TRIGGER IF EXISTS dex_ad_placements_touch ON public.dex_ad_placements;
CREATE TRIGGER dex_ad_placements_touch
  BEFORE UPDATE ON public.dex_ad_placements
  FOR EACH ROW EXECUTE FUNCTION public.dex_touch_updated_at();

DROP TRIGGER IF EXISTS dex_saved_filters_touch ON public.dex_saved_filters;
CREATE TRIGGER dex_saved_filters_touch
  BEFORE UPDATE ON public.dex_saved_filters
  FOR EACH ROW EXECUTE FUNCTION public.dex_touch_updated_at();

-- ════════════════════════════════════════════════════════════════════
-- VERIFICATION QUERIES (run after applying; expect the noted results)
-- ════════════════════════════════════════════════════════════════════
-- -- 1. Tables + RLS on:
-- --    SELECT tablename, rowsecurity FROM pg_tables
-- --    WHERE schemaname = 'public'
-- --      AND (tablename LIKE 'dex\_%' OR tablename = 'admin_roles');
-- --    -- expect 6 rows, rowsecurity = true
-- --
-- -- 2. is_admin() exists and returns false for anon:
-- --    SELECT public.is_admin();  -- expect false (no auth.uid())
-- --
-- -- 3. Public read sees only ACTIVE rows (run as anon / signed-out client):
-- --    SELECT count(*) FROM public.dex_ads;          -- expect 0 until an active ad exists
-- --    SELECT count(*) FROM public.dex_ad_placements;-- expect 0 until an active placement exists
-- --    SELECT count(*) FROM public.dex_boosts;       -- expect 0 until an active boost exists
-- --    SELECT count(*) FROM public.dex_listings;     -- expect 0 until an approved listing exists
-- --
-- -- 4. Write is blocked for non-admins (run as anon or a plain user):
-- --    INSERT INTO public.dex_ads (title) VALUES ('should fail');
-- --    -- expect: ERROR new row violates row-level security policy
-- --
-- -- 5. Hot-path lookup the client runs (placement slot resolution):
-- --    SELECT p.id, p.placement, p.priority, a.title, a.status
-- --    FROM public.dex_ad_placements p
-- --    JOIN public.dex_ads a ON a.id = p.ad_id
-- --    WHERE p.placement = 'home-top'
-- --      AND p.active = true
-- --      AND p.starts_at <= now() AND (p.ends_at IS NULL OR p.ends_at > now())
-- --      AND a.status = 'active'
-- --      AND a.starts_at <= now() AND (a.ends_at IS NULL OR a.ends_at > now())
-- --    ORDER BY p.priority DESC, p.created_at DESC
-- --    LIMIT 1;
-- --
-- -- 6. Active boost for a mint:
-- --    SELECT * FROM public.dex_boosts
-- --    WHERE mint = '<MINT>' AND status = 'active'
-- --      AND starts_at <= now() AND (ends_at IS NULL OR ends_at > now());
-- --
-- -- 7. Saved filters are per-user (run as a signed-in non-admin):
-- --    SELECT * FROM public.dex_saved_filters;  -- expect only own rows
-- ════════════════════════════════════════════════════════════════════
