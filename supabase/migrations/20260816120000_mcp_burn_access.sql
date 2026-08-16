-- Temporary MCP access granted by burning $ORBITX.
-- 1 day = 100 tokens, 1 week = 1,000 tokens. Access expires at expires_at.

CREATE TABLE IF NOT EXISTS public.mcp_burn_access (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_address TEXT,
  package_id TEXT NOT NULL CHECK (package_id IN ('day', 'week')),
  tokens_burned NUMERIC(30, 8) NOT NULL CHECK (tokens_burned > 0),
  expires_at TIMESTAMPTZ NOT NULL,
  last_tx_signature TEXT,
  lifetime_tokens_burned NUMERIC(30, 8) NOT NULL DEFAULT 0 CHECK (lifetime_tokens_burned >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.mcp_burn_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_address TEXT,
  package_id TEXT NOT NULL CHECK (package_id IN ('day', 'week')),
  tokens_burned NUMERIC(30, 8) NOT NULL CHECK (tokens_burned > 0),
  duration_seconds INT NOT NULL CHECK (duration_seconds > 0),
  expires_at TIMESTAMPTZ NOT NULL,
  tx_signature TEXT NOT NULL,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS mcp_burn_ledger_tx_sig_uidx
  ON public.mcp_burn_ledger (tx_signature);

CREATE INDEX IF NOT EXISTS mcp_burn_access_expires_idx
  ON public.mcp_burn_access (expires_at);

CREATE INDEX IF NOT EXISTS mcp_burn_ledger_user_created_idx
  ON public.mcp_burn_ledger (user_id, created_at DESC);

ALTER TABLE public.mcp_burn_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_burn_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mcp_burn_access_owner ON public.mcp_burn_access;
CREATE POLICY mcp_burn_access_owner ON public.mcp_burn_access
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS mcp_burn_ledger_owner ON public.mcp_burn_ledger;
CREATE POLICY mcp_burn_ledger_owner ON public.mcp_burn_ledger
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Service role bypasses RLS for burn confirmation from the API.
