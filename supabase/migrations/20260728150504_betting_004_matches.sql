-- ============================================================
-- SOLNO — 1v1 duels. Works like bets: each player deposits an
-- equal stake on-chain to the treasury; winner takes the pot
-- (minus house rake). Payouts are manual (admin-paid), like bets.
-- The platform never banks the games.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.game_matches (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game              TEXT NOT NULL,                 -- 'coinflip' | 'dice'
  wager             BIGINT NOT NULL CHECK (wager > 0),
  rake_bps          INT NOT NULL DEFAULT 500,
  status            TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','cancelled')),

  creator_user_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  creator_username  TEXT,
  creator_wallet    TEXT NOT NULL,
  creator_side      TEXT,                          -- coinflip side chosen by creator
  creator_tx        TEXT NOT NULL,

  opponent_user_id  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  opponent_username TEXT,
  opponent_wallet   TEXT,
  opponent_tx       TEXT,

  pot               BIGINT NOT NULL DEFAULT 0,
  result            JSONB NOT NULL DEFAULT '{}',
  winner_user_id    UUID,
  winner_username   TEXT,
  winner_wallet     TEXT,
  winner_side       TEXT,

  -- manual payout (winner takes pot minus rake; cancelled = refund to creator)
  payout_amount     BIGINT NOT NULL DEFAULT 0,
  payout_to_user    UUID,
  payout_to_wallet  TEXT,
  payout_kind       TEXT,                          -- 'win' | 'refund'
  paid              BOOLEAN NOT NULL DEFAULT false,
  payout_tx         TEXT,
  paid_at           TIMESTAMPTZ,

  server_seed       TEXT,                          -- null until resolved (revealed)
  server_seed_hash  TEXT NOT NULL,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at       TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS game_matches_status_idx ON public.game_matches(status, created_at DESC);
CREATE INDEX IF NOT EXISTS game_matches_creator_idx ON public.game_matches(creator_user_id);
CREATE INDEX IF NOT EXISTS game_matches_opponent_idx ON public.game_matches(opponent_user_id);
CREATE INDEX IF NOT EXISTS game_matches_unpaid_idx ON public.game_matches(paid, payout_amount) WHERE payout_amount > 0 AND paid = false;
CREATE UNIQUE INDEX IF NOT EXISTS game_matches_creator_tx ON public.game_matches(creator_tx);
CREATE UNIQUE INDEX IF NOT EXISTS game_matches_opponent_tx ON public.game_matches(opponent_tx) WHERE opponent_tx IS NOT NULL;

-- server seeds kept secret (service-role only) until a match resolves
CREATE TABLE IF NOT EXISTS public.game_match_seeds (
  match_id    UUID PRIMARY KEY REFERENCES public.game_matches(id) ON DELETE CASCADE,
  server_seed TEXT NOT NULL
);

ALTER TABLE public.game_matches     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_match_seeds ENABLE ROW LEVEL SECURITY;  -- service-role only

DROP POLICY IF EXISTS gm_public_read ON public.game_matches;
CREATE POLICY gm_public_read ON public.game_matches FOR SELECT USING (true);

GRANT SELECT ON public.game_matches TO anon, authenticated;

-- realtime for the live lobby
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='game_matches'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.game_matches';
  END IF;
END $$;

-- reservation (prevents a joiner from paying then losing the slot in a race)
ALTER TABLE public.game_matches ADD COLUMN IF NOT EXISTS reserved_by UUID;
ALTER TABLE public.game_matches ADD COLUMN IF NOT EXISTS reserved_at TIMESTAMPTZ;
