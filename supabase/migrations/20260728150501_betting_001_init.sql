-- ============================================================
-- OG BETS — consolidated database schema (single source of truth)
-- Reflects the live production schema. Manual-treasury betting model.
-- Replaces the old incremental migrations 001-009.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── profiles ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username          TEXT UNIQUE,
  display_name      TEXT,
  wallet            TEXT UNIQUE,
  twitter           TEXT,
  avatar_url        TEXT,
  bio               TEXT DEFAULT '',
  wins              INTEGER NOT NULL DEFAULT 0,
  losses            INTEGER NOT NULL DEFAULT 0,
  total_wagered_sol NUMERIC(18,9) NOT NULL DEFAULT 0,
  total_won_sol     NUMERIC(18,9) NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── bets ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bets (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  on_chain_id              TEXT UNIQUE,
  creator_id               UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  opponent_id              UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  title                    TEXT NOT NULL,
  description              TEXT DEFAULT '',
  amount_sol               NUMERIC(18,9) DEFAULT 0,
  status                   TEXT NOT NULL DEFAULT 'open'
                             CHECK (status IN ('open','active','locked','matched','resolved','cancelled','expired')),
  winner_id                UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  category                 TEXT DEFAULT 'general',
  expires_at               TIMESTAMPTZ,
  resolved_at              TIMESTAMPTZ,
  tx_create                TEXT,
  tx_join                  TEXT,
  tx_resolve               TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  amount_lamports          BIGINT NOT NULL DEFAULT 0,
  bet_id                   INTEGER NOT NULL DEFAULT 0,
  on_chain_pubkey          TEXT NOT NULL DEFAULT '',
  featured                 BOOLEAN NOT NULL DEFAULT false,
  max_participants         INTEGER NOT NULL DEFAULT 15,
  currency                 TEXT NOT NULL DEFAULT 'SOL',
  is_private               BOOLEAN NOT NULL DEFAULT false,
  creator_fee_pct          NUMERIC(5,2) NOT NULL DEFAULT 0,
  platform_fees_collected  BIGINT NOT NULL DEFAULT 0,
  winning_outcome_index    INTEGER,
  outcomes                 TEXT[] NOT NULL DEFAULT ARRAY['Yes','No'],
  outcome_pools            BIGINT[] NOT NULL DEFAULT ARRAY[0,0]::bigint[],
  yes_label                TEXT NOT NULL DEFAULT 'Yes',
  no_label                 TEXT NOT NULL DEFAULT 'No',
  yes_pool                 BIGINT NOT NULL DEFAULT 0,
  no_pool                  BIGINT NOT NULL DEFAULT 0,
  bet_count                INTEGER NOT NULL DEFAULT 0,
  creator_type             TEXT NOT NULL DEFAULT 'user',
  creator_wallet           TEXT NOT NULL DEFAULT '',
  expiry                   TIMESTAMPTZ,
  total_pool               BIGINT NOT NULL DEFAULT 0,
  min_stake                BIGINT NOT NULL DEFAULT 100000000,
  treasury_wallet          TEXT
);
CREATE INDEX IF NOT EXISTS bets_status_idx   ON public.bets(status);
CREATE INDEX IF NOT EXISTS bets_creator_idx  ON public.bets(creator_id);
CREATE INDEX IF NOT EXISTS bets_opponent_idx ON public.bets(opponent_id);
CREATE INDEX IF NOT EXISTS bets_created_idx  ON public.bets(created_at DESC);

-- ─── user_bets (one verified SOL deposit per wager) ───────────
CREATE TABLE IF NOT EXISTS public.user_bets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bet_id        UUID NOT NULL REFERENCES public.bets(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_wallet   TEXT NOT NULL,
  side          TEXT NOT NULL DEFAULT 'yes' CHECK (side IN ('yes','no')),
  outcome_index INTEGER NOT NULL DEFAULT 0,
  amount        BIGINT NOT NULL CHECK (amount > 0),
  fee_paid      BIGINT DEFAULT 0,
  tx_signature  TEXT,
  payout        BIGINT,
  claimed       BOOLEAN NOT NULL DEFAULT false,
  claim_tx      TEXT,
  claimed_at    TIMESTAMPTZ,
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','confirmed','won','lost','refunded','claimed')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_user_bets_tx_signature ON public.user_bets(tx_signature) WHERE tx_signature IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_bets_bet ON public.user_bets(bet_id);
CREATE INDEX IF NOT EXISTS idx_user_bets_won_unclaimed ON public.user_bets(bet_id, status, claimed) WHERE status = 'won' AND claimed = false;

-- ─── notifications ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  title      TEXT NOT NULL,
  body       TEXT DEFAULT '',
  data       JSONB DEFAULT '{}',
  read       BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notif_user_read_idx ON public.notifications(user_id, read);

-- ─── leaderboard view ─────────────────────────────────────────
CREATE OR REPLACE VIEW public.leaderboard AS
  SELECT id, username, wallet, avatar_url, wins, losses, total_wagered_sol, total_won_sol,
    CASE WHEN (wins + losses) > 0 THEN round(wins::numeric / (wins + losses)::numeric * 100, 1) ELSE 0 END AS win_rate_pct,
    (total_won_sol - total_wagered_sol) AS net_profit_sol,
    row_number() OVER (ORDER BY wins DESC, total_won_sol DESC) AS rank
  FROM public.profiles p;

-- ─── functions ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, username, wallet, avatar_url)
  VALUES (NEW.id,
          COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1)),
          NEW.raw_user_meta_data->>'wallet',
          NEW.raw_user_meta_data->>'avatar_url')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END; $$;

-- Pool/count maintenance — operates on native bigint[] (1-based arrays)
CREATE OR REPLACE FUNCTION public.update_bet_pools_v2() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE pools bigint[]; pos int;
BEGIN
  pos := COALESCE(NEW.outcome_index, 0) + 1;
  SELECT outcome_pools INTO pools FROM public.bets WHERE id = NEW.bet_id;
  IF pools IS NULL THEN pools := ARRAY[]::bigint[]; END IF;
  WHILE COALESCE(array_length(pools, 1), 0) < pos LOOP pools := array_append(pools, 0::bigint); END LOOP;
  pools[pos] := COALESCE(pools[pos], 0) + NEW.amount;
  UPDATE public.bets SET
    outcome_pools = pools,
    total_pool = COALESCE(total_pool, 0) + NEW.amount,
    yes_pool   = CASE WHEN NEW.outcome_index = 0 THEN COALESCE(yes_pool, 0) + NEW.amount ELSE yes_pool END,
    no_pool    = CASE WHEN NEW.outcome_index = 1 THEN COALESCE(no_pool, 0) + NEW.amount ELSE no_pool END,
    bet_count  = COALESCE(bet_count, 0) + 1
  WHERE id = NEW.bet_id;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.check_bet_not_full() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE cur int; mx int;
BEGIN
  SELECT bet_count, max_participants INTO cur, mx FROM public.bets WHERE id = NEW.bet_id;
  IF cur IS NOT NULL AND mx IS NOT NULL AND cur >= mx THEN
    RAISE EXCEPTION 'Bet is full (% / % participants)', cur, mx;
  END IF;
  RETURN NEW;
END; $$;

-- ─── triggers ─────────────────────────────────────────────────
DROP TRIGGER IF EXISTS bets_updated_at ON public.bets;
CREATE TRIGGER bets_updated_at BEFORE UPDATE ON public.bets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS on_user_bet_insert ON public.user_bets;
CREATE TRIGGER on_user_bet_insert AFTER INSERT ON public.user_bets FOR EACH ROW EXECUTE FUNCTION public.update_bet_pools_v2();

DROP TRIGGER IF EXISTS enforce_bet_cap ON public.user_bets;
CREATE TRIGGER enforce_bet_cap BEFORE INSERT ON public.user_bets FOR EACH ROW EXECUTE FUNCTION public.check_bet_not_full();

-- ─── Row Level Security ───────────────────────────────────────
ALTER TABLE public.profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bets          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_bets     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_public_read ON public.profiles;
DROP POLICY IF EXISTS profiles_self_insert ON public.profiles;
DROP POLICY IF EXISTS profiles_self_update ON public.profiles;
CREATE POLICY profiles_public_read ON public.profiles FOR SELECT USING (true);
CREATE POLICY profiles_self_insert ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY profiles_self_update ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS bets_public_read ON public.bets;
DROP POLICY IF EXISTS bets_auth_insert ON public.bets;
DROP POLICY IF EXISTS bets_creator_update ON public.bets;
CREATE POLICY bets_public_read ON public.bets FOR SELECT USING (true);
CREATE POLICY bets_auth_insert ON public.bets FOR INSERT WITH CHECK (auth.role() = 'authenticated');
-- bets updates are server-side only (service role); no creator update policy.

DROP POLICY IF EXISTS user_bets_public_read ON public.user_bets;
DROP POLICY IF EXISTS user_bets_self_insert ON public.user_bets;
DROP POLICY IF EXISTS user_bets_creator_update ON public.user_bets;
CREATE POLICY user_bets_public_read ON public.user_bets FOR SELECT USING (true);
CREATE POLICY user_bets_self_insert ON public.user_bets FOR INSERT WITH CHECK (auth.uid() = user_id);
-- user_bets updates are server-side only (service role); no creator update policy.

-- notifications: private to owner (FIXED: references notifications.user_id, not a self-join bug)
DROP POLICY IF EXISTS notif_owner_read   ON public.notifications;
DROP POLICY IF EXISTS notif_owner_update ON public.notifications;
CREATE POLICY notif_owner_read ON public.notifications FOR SELECT USING (
  auth.uid() = (SELECT user_id FROM public.profiles WHERE id = notifications.user_id)
);
CREATE POLICY notif_owner_update ON public.notifications FOR UPDATE USING (
  auth.uid() = (SELECT user_id FROM public.profiles WHERE id = notifications.user_id)
);

-- ─── grants ───────────────────────────────────────────────────
GRANT SELECT ON public.profiles, public.bets, public.user_bets, public.notifications, public.leaderboard TO anon;
GRANT SELECT, INSERT, UPDATE ON public.profiles, public.bets, public.user_bets, public.notifications TO authenticated;
GRANT SELECT ON public.leaderboard TO authenticated;
