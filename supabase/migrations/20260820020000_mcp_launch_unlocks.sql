-- Launch MCP gate: first 25 people redeem the shared phrase "Orbitx mcp"
-- for unlimited free access. After that, burn 500 $ORBITX and paste a Solscan
-- tx link. Grants are forever (no expiry).

CREATE TABLE IF NOT EXISTS public.mcp_launch_unlocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL CHECK (source IN ('promo_code', 'burn_500')),
  promo_slot INT UNIQUE,
  telegram_user_id TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  wallet_address TEXT,
  mcp_session_id TEXT,
  tx_signature TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT mcp_launch_unlocks_promo_slot_ck CHECK (
    (source = 'promo_code' AND promo_slot BETWEEN 1 AND 25)
    OR (source = 'burn_500' AND promo_slot IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS mcp_launch_unlocks_telegram_unique
  ON public.mcp_launch_unlocks (telegram_user_id)
  WHERE telegram_user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS mcp_launch_unlocks_user_unique
  ON public.mcp_launch_unlocks (user_id)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS mcp_launch_unlocks_wallet_unique
  ON public.mcp_launch_unlocks (wallet_address)
  WHERE wallet_address IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS mcp_launch_unlocks_session_unique
  ON public.mcp_launch_unlocks (mcp_session_id)
  WHERE mcp_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS mcp_launch_unlocks_promo_source_idx
  ON public.mcp_launch_unlocks (source);

ALTER TABLE public.mcp_launch_unlocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mcp_launch_unlocks_owner ON public.mcp_launch_unlocks;
CREATE POLICY mcp_launch_unlocks_owner ON public.mcp_launch_unlocks
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Service role bypasses RLS for Telegram / MCP redeem + burn confirm.
