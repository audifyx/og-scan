-- ============================================================
-- OG BETS — Games / Casino layer (balance ledger model)
-- On-site balance in lamports. Deposits verified on-chain credit
-- balance; withdrawals are admin-processed payouts. All games are
-- server-authoritative and provably fair. Additive only — does not
-- touch existing betting tables.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─── balances ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.game_balances (
  user_id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance         BIGINT NOT NULL DEFAULT 0 CHECK (balance >= 0),
  total_deposited BIGINT NOT NULL DEFAULT 0,
  total_withdrawn BIGINT NOT NULL DEFAULT 0,
  total_wagered   BIGINT NOT NULL DEFAULT 0,
  total_won       BIGINT NOT NULL DEFAULT 0,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── ledger (audit of every balance change) ───────────────────
CREATE TABLE IF NOT EXISTS public.game_ledger (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL CHECK (kind IN ('deposit','withdraw','wager','win','refund','rake')),
  amount        BIGINT NOT NULL,            -- signed (debit negative, credit positive)
  balance_after BIGINT NOT NULL,
  ref           TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS game_ledger_user_idx ON public.game_ledger(user_id, created_at DESC);

-- ─── deposits (verified on-chain transfer → credit) ───────────
CREATE TABLE IF NOT EXISTS public.game_deposits (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet       TEXT NOT NULL,
  tx_signature TEXT UNIQUE NOT NULL,
  lamports     BIGINT NOT NULL CHECK (lamports > 0),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── withdrawals (cashout requests; admin pays from treasury) ─
CREATE TABLE IF NOT EXISTS public.game_withdrawals (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet       TEXT NOT NULL,
  lamports     BIGINT NOT NULL CHECK (lamports > 0),
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','rejected')),
  payout_tx    TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS game_withdrawals_status_idx ON public.game_withdrawals(status, created_at DESC);

-- ─── provably-fair seeds (Stake-style, server-only) ───────────
CREATE TABLE IF NOT EXISTS public.game_seeds (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  server_seed      TEXT NOT NULL,
  server_seed_hash TEXT NOT NULL,
  client_seed      TEXT NOT NULL,
  nonce            BIGINT NOT NULL DEFAULT 0,
  active           BOOLEAN NOT NULL DEFAULT true,
  revealed_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS one_active_seed_per_user ON public.game_seeds(user_id) WHERE active;

-- ─── single-player rounds (history / live feed) ───────────────
CREATE TABLE IF NOT EXISTS public.game_rounds (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username         TEXT,
  game             TEXT NOT NULL,
  wager            BIGINT NOT NULL,
  multiplier       NUMERIC(14,4) NOT NULL DEFAULT 0,
  payout           BIGINT NOT NULL DEFAULT 0,
  win              BOOLEAN NOT NULL DEFAULT false,
  params           JSONB NOT NULL DEFAULT '{}',
  result           JSONB NOT NULL DEFAULT '{}',
  server_seed_hash TEXT,
  server_seed      TEXT,
  client_seed      TEXT,
  nonce            BIGINT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS game_rounds_user_idx ON public.game_rounds(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS game_rounds_feed_idx ON public.game_rounds(created_at DESC);

-- ─── multiplayer jackpot rounds ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.jackpot_rounds (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status           TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','locked','resolved')),
  pot              BIGINT NOT NULL DEFAULT 0,
  rake_bps         INT NOT NULL DEFAULT 500,   -- 5% house rake
  player_count     INT NOT NULL DEFAULT 0,
  winner_user_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  winner_username  TEXT,
  winner_wallet    TEXT,
  winning_ticket   NUMERIC,
  server_seed      TEXT,            -- null until resolved (revealed)
  server_seed_hash TEXT NOT NULL,
  resolve_at       TIMESTAMPTZ,     -- countdown end; set once 2+ players
  resolved_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS jackpot_rounds_status_idx ON public.jackpot_rounds(status, created_at DESC);
-- at most one joinable round at a time
CREATE UNIQUE INDEX IF NOT EXISTS one_open_jackpot ON public.jackpot_rounds (status) WHERE status = 'open';

-- secret seeds for jackpot (service-role only, never exposed pre-resolve)
CREATE TABLE IF NOT EXISTS public.jackpot_seeds (
  round_id    UUID PRIMARY KEY REFERENCES public.jackpot_rounds(id) ON DELETE CASCADE,
  server_seed TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.jackpot_entries (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id   UUID NOT NULL REFERENCES public.jackpot_rounds(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username   TEXT,
  wallet     TEXT,
  amount     BIGINT NOT NULL CHECK (amount > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS jackpot_entries_round_idx ON public.jackpot_entries(round_id, created_at);

-- ─── atomic balance functions ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.game_debit(p_user UUID, p_amount BIGINT, p_kind TEXT, p_ref TEXT DEFAULT NULL)
RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE new_bal BIGINT;
BEGIN
  IF p_amount <= 0 THEN RAISE EXCEPTION 'amount must be positive'; END IF;
  UPDATE public.game_balances
    SET balance = balance - p_amount,
        total_wagered   = total_wagered   + CASE WHEN p_kind = 'wager'    THEN p_amount ELSE 0 END,
        total_withdrawn = total_withdrawn + CASE WHEN p_kind = 'withdraw' THEN p_amount ELSE 0 END,
        updated_at = now()
    WHERE user_id = p_user AND balance >= p_amount
    RETURNING balance INTO new_bal;
  IF new_bal IS NULL THEN RAISE EXCEPTION 'INSUFFICIENT_FUNDS'; END IF;
  INSERT INTO public.game_ledger(user_id, kind, amount, balance_after, ref)
    VALUES (p_user, p_kind, -p_amount, new_bal, p_ref);
  RETURN new_bal;
END; $$;

CREATE OR REPLACE FUNCTION public.game_credit(p_user UUID, p_amount BIGINT, p_kind TEXT, p_ref TEXT DEFAULT NULL)
RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE new_bal BIGINT;
BEGIN
  IF p_amount <= 0 THEN
    RETURN COALESCE((SELECT balance FROM public.game_balances WHERE user_id = p_user), 0);
  END IF;
  INSERT INTO public.game_balances(user_id, balance, total_deposited, total_won)
    VALUES (p_user, p_amount,
            CASE WHEN p_kind = 'deposit' THEN p_amount ELSE 0 END,
            CASE WHEN p_kind = 'win'     THEN p_amount ELSE 0 END)
    ON CONFLICT (user_id) DO UPDATE
      SET balance = public.game_balances.balance + p_amount,
          total_deposited = public.game_balances.total_deposited + CASE WHEN p_kind = 'deposit' THEN p_amount ELSE 0 END,
          total_won       = public.game_balances.total_won       + CASE WHEN p_kind = 'win'     THEN p_amount ELSE 0 END,
          updated_at = now()
    RETURNING balance INTO new_bal;
  INSERT INTO public.game_ledger(user_id, kind, amount, balance_after, ref)
    VALUES (p_user, p_kind, p_amount, new_bal, p_ref);
  RETURN new_bal;
END; $$;

-- finalize a jackpot atomically (guards against double-resolve)
CREATE OR REPLACE FUNCTION public.jackpot_finalize(
  p_round UUID, p_winner UUID, p_winner_username TEXT, p_winner_wallet TEXT,
  p_ticket NUMERIC, p_payout BIGINT, p_server_seed TEXT
) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE updated INT;
BEGIN
  UPDATE public.jackpot_rounds
    SET status = 'resolved', winner_user_id = p_winner, winner_username = p_winner_username,
        winner_wallet = p_winner_wallet, winning_ticket = p_ticket,
        server_seed = p_server_seed, resolved_at = now()
    WHERE id = p_round AND status IN ('open','locked');
  GET DIAGNOSTICS updated = ROW_COUNT;
  IF updated = 0 THEN RETURN false; END IF;
  IF p_payout > 0 THEN
    PERFORM public.game_credit(p_winner, p_payout, 'win', 'jackpot:' || p_round::text);
  END IF;
  RETURN true;
END; $$;

-- ─── RLS ──────────────────────────────────────────────────────
ALTER TABLE public.game_balances    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_ledger      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_deposits    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_seeds       ENABLE ROW LEVEL SECURITY;  -- no policies => service-role only
ALTER TABLE public.game_rounds      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jackpot_rounds   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jackpot_seeds    ENABLE ROW LEVEL SECURITY;  -- no policies => service-role only
ALTER TABLE public.jackpot_entries  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gb_owner_read ON public.game_balances;
CREATE POLICY gb_owner_read ON public.game_balances FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS gl_owner_read ON public.game_ledger;
CREATE POLICY gl_owner_read ON public.game_ledger FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS gd_owner_read ON public.game_deposits;
CREATE POLICY gd_owner_read ON public.game_deposits FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS gw_owner_read ON public.game_withdrawals;
CREATE POLICY gw_owner_read ON public.game_withdrawals FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS gr_public_read ON public.game_rounds;
CREATE POLICY gr_public_read ON public.game_rounds FOR SELECT USING (true);

DROP POLICY IF EXISTS jr_public_read ON public.jackpot_rounds;
CREATE POLICY jr_public_read ON public.jackpot_rounds FOR SELECT USING (true);

DROP POLICY IF EXISTS je_public_read ON public.jackpot_entries;
CREATE POLICY je_public_read ON public.jackpot_entries FOR SELECT USING (true);

-- ─── grants ───────────────────────────────────────────────────
GRANT SELECT ON public.game_balances, public.game_ledger, public.game_deposits, public.game_withdrawals,
                public.game_rounds, public.jackpot_rounds, public.jackpot_entries TO authenticated;
GRANT SELECT ON public.game_rounds, public.jackpot_rounds, public.jackpot_entries TO anon;

-- ─── realtime ─────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['jackpot_rounds','jackpot_entries','game_rounds'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
