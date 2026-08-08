-- X MCP purchasable credits (SOL → credits via PLATFORM_WALLET payments)

CREATE TABLE IF NOT EXISTS public.x_mcp_credits (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance BIGINT NOT NULL DEFAULT 0 CHECK (balance >= 0),
  lifetime_purchased BIGINT NOT NULL DEFAULT 0,
  lifetime_spent BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.x_mcp_credit_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('purchase', 'spend', 'adjust', 'bonus')),
  amount BIGINT NOT NULL,
  balance_after BIGINT,
  sol_lamports BIGINT,
  tx_signature TEXT,
  description TEXT,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS x_mcp_credit_ledger_tx_sig_uidx
  ON public.x_mcp_credit_ledger (tx_signature)
  WHERE tx_signature IS NOT NULL;

CREATE INDEX IF NOT EXISTS x_mcp_credit_ledger_user_created_idx
  ON public.x_mcp_credit_ledger (user_id, created_at DESC);

ALTER TABLE public.x_mcp_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.x_mcp_credit_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS x_mcp_credits_owner ON public.x_mcp_credits;
CREATE POLICY x_mcp_credits_owner ON public.x_mcp_credits
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS x_mcp_credit_ledger_owner ON public.x_mcp_credit_ledger;
CREATE POLICY x_mcp_credit_ledger_owner ON public.x_mcp_credit_ledger
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Service role bypasses RLS for purchase confirmation from the API.
