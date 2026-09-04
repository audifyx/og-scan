-- OrbitX owner command center: presence, events, ledger, burns, audit, daily rollups.
-- RLS: authenticated may write their own presence/events. All owner analytics
-- are read via service-role APIs (web/api/orbitx-owner.js). No client can
-- SELECT other users' financial rows.

CREATE TABLE IF NOT EXISTS public.ox_admin_presence (
  user_id uuid PRIMARY KEY,
  username text,
  avatar_url text,
  wallet_address text,
  status text NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'away', 'offline')),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  last_heartbeat_at timestamptz NOT NULL DEFAULT now(),
  current_path text,
  current_app text,
  device text,
  user_agent text,
  session_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ox_admin_presence_status_idx ON public.ox_admin_presence (status, last_heartbeat_at DESC);
CREATE INDEX IF NOT EXISTS ox_admin_presence_seen_idx ON public.ox_admin_presence (last_seen_at DESC);
CREATE INDEX IF NOT EXISTS ox_admin_presence_wallet_idx ON public.ox_admin_presence (wallet_address);

CREATE TABLE IF NOT EXISTS public.ox_admin_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  user_id uuid,
  wallet_address text,
  application text,
  title text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  tx_signature text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ox_admin_events_created_idx ON public.ox_admin_events (created_at DESC);
CREATE INDEX IF NOT EXISTS ox_admin_events_type_idx ON public.ox_admin_events (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS ox_admin_events_user_idx ON public.ox_admin_events (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.ox_admin_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chain text NOT NULL DEFAULT 'solana',
  tx_signature text,
  user_id uuid,
  wallet_address text,
  application text,
  tx_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'reverted', 'partial')),
  input_amount numeric,
  output_amount numeric,
  value_usd numeric,
  fee_bps int NOT NULL DEFAULT 120,
  fee_usd_calc numeric,
  fee_usd_actual numeric,
  fee_cap_applied boolean NOT NULL DEFAULT false,
  orbitx_bought numeric,
  orbitx_burned numeric,
  burn_signature text,
  error text,
  verified_onchain boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ox_admin_ledger_sig_uidx
  ON public.ox_admin_ledger (tx_signature) WHERE tx_signature IS NOT NULL;
CREATE INDEX IF NOT EXISTS ox_admin_ledger_created_idx ON public.ox_admin_ledger (created_at DESC);
CREATE INDEX IF NOT EXISTS ox_admin_ledger_user_idx ON public.ox_admin_ledger (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ox_admin_ledger_status_idx ON public.ox_admin_ledger (status, created_at DESC);
CREATE INDEX IF NOT EXISTS ox_admin_ledger_app_idx ON public.ox_admin_ledger (application, created_at DESC);

CREATE TABLE IF NOT EXISTS public.ox_admin_burns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  wallet_address text,
  application text,
  tokens_burned numeric NOT NULL,
  value_usd numeric,
  tx_signature text NOT NULL,
  mint text NOT NULL DEFAULT '13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9',
  verified_onchain boolean NOT NULL DEFAULT false,
  source text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ox_admin_burns_sig_uidx ON public.ox_admin_burns (tx_signature);
CREATE INDEX IF NOT EXISTS ox_admin_burns_created_idx ON public.ox_admin_burns (created_at DESC);
CREATE INDEX IF NOT EXISTS ox_admin_burns_user_idx ON public.ox_admin_burns (user_id);

CREATE TABLE IF NOT EXISTS public.ox_admin_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid,
  admin_email text,
  action text NOT NULL,
  target_type text,
  target_id text,
  ip text,
  before jsonb,
  after jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ox_admin_audit_created_idx ON public.ox_admin_audit (created_at DESC);

CREATE TABLE IF NOT EXISTS public.ox_admin_daily (
  day date PRIMARY KEY,
  users_new int NOT NULL DEFAULT 0,
  dau int NOT NULL DEFAULT 0,
  tx_count int NOT NULL DEFAULT 0,
  volume_usd numeric NOT NULL DEFAULT 0,
  fees_usd numeric NOT NULL DEFAULT 0,
  burns_tokens numeric NOT NULL DEFAULT 0,
  online_peak int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ox_admin_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ox_admin_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ox_admin_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ox_admin_burns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ox_admin_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ox_admin_daily ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ox_admin_presence_own ON public.ox_admin_presence;
CREATE POLICY ox_admin_presence_own ON public.ox_admin_presence
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS ox_admin_events_insert_own ON public.ox_admin_events;
CREATE POLICY ox_admin_events_insert_own ON public.ox_admin_events
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS ox_admin_events_select_own ON public.ox_admin_events;
CREATE POLICY ox_admin_events_select_own ON public.ox_admin_events
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

REVOKE ALL ON public.ox_admin_ledger FROM anon, authenticated;
REVOKE ALL ON public.ox_admin_burns FROM anon, authenticated;
REVOKE ALL ON public.ox_admin_audit FROM anon, authenticated;
REVOKE ALL ON public.ox_admin_daily FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.ox_admin_presence TO authenticated;
GRANT SELECT, INSERT ON public.ox_admin_events TO authenticated;
GRANT ALL ON public.ox_admin_presence TO service_role;
GRANT ALL ON public.ox_admin_events TO service_role;
GRANT ALL ON public.ox_admin_ledger TO service_role;
GRANT ALL ON public.ox_admin_burns TO service_role;
GRANT ALL ON public.ox_admin_audit TO service_role;
GRANT ALL ON public.ox_admin_daily TO service_role;

COMMENT ON TABLE public.ox_admin_ledger IS 'Verified OrbitX platform txs. completed only after on-chain confirmation.';
COMMENT ON TABLE public.ox_admin_burns IS 'OrbitX burns counted only after verifyOrbitxBurn / on-chain confirmation.';
COMMENT ON TABLE public.ox_admin_audit IS 'Owner command audit. Immutable from the admin UI (no UPDATE/DELETE grants to authenticated).';
COMMENT ON TABLE public.ox_admin_presence IS 'Heartbeat presence. ONLINE = heartbeat < 60s; AWAY = 60s–5m; OFFLINE = else.';
