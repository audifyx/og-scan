-- ============================================================
-- OG BETS — stateful games (Mines, Crash). Server-authoritative
-- round state. These tables are service-role only (RLS on, no
-- policies, no grants) — all access is mediated by API routes so
-- hidden info (mine layout, crash point) is never exposed early.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.mines_games (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wager            BIGINT NOT NULL,
  mines            INT NOT NULL,
  mine_positions   INT[] NOT NULL,
  revealed         INT[] NOT NULL DEFAULT '{}',
  status           TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','busted','cashed')),
  multiplier       NUMERIC(14,4) NOT NULL DEFAULT 1,
  payout           BIGINT NOT NULL DEFAULT 0,
  server_seed_hash TEXT, client_seed TEXT, nonce BIGINT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at         TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS mines_games_user_idx ON public.mines_games(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.crash_games (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wager              BIGINT NOT NULL,
  crash_point        NUMERIC(14,4) NOT NULL,
  auto_cashout       NUMERIC(14,4),
  status             TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','cashed','busted')),
  cashout_multiplier NUMERIC(14,4),
  payout             BIGINT NOT NULL DEFAULT 0,
  started_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  server_seed_hash   TEXT, client_seed TEXT, nonce BIGINT,
  ended_at           TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS crash_games_user_idx ON public.crash_games(user_id, started_at DESC);

ALTER TABLE public.mines_games ENABLE ROW LEVEL SECURITY;  -- service-role only
ALTER TABLE public.crash_games ENABLE ROW LEVEL SECURITY;  -- service-role only
