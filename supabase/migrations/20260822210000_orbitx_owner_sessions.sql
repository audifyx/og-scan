-- Owner desk: session duration + lifetime online time.
-- Presence stays one row per user. Sessions are append/upsert per browser tab session_id.
-- Service role writes via /api/orbitx-presence. Authenticated clients cannot read others.

ALTER TABLE public.ox_admin_presence
  ADD COLUMN IF NOT EXISTS session_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS total_online_ms bigint NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.ox_admin_presence.session_started_at IS
  'Start of the current browser session (new session_id or heartbeat gap > 5min).';
COMMENT ON COLUMN public.ox_admin_presence.total_online_ms IS
  'Accumulated online time from heartbeats. Gaps over 5 minutes are not credited.';

CREATE TABLE IF NOT EXISTS public.ox_admin_sessions (
  session_id text PRIMARY KEY,
  user_id uuid NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  last_heartbeat_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  duration_ms bigint NOT NULL DEFAULT 0,
  current_path text,
  current_app text,
  device text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ox_admin_sessions_user_idx
  ON public.ox_admin_sessions (user_id, last_heartbeat_at DESC);
CREATE INDEX IF NOT EXISTS ox_admin_sessions_hb_idx
  ON public.ox_admin_sessions (last_heartbeat_at DESC);

ALTER TABLE public.ox_admin_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ox_admin_sessions FROM anon, authenticated;
GRANT ALL ON public.ox_admin_sessions TO service_role;

COMMENT ON TABLE public.ox_admin_sessions IS
  'Per-session online time for the owner desk. Source is heartbeats, not estimates.';
