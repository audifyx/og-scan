-- Pending MCP trade intents (chat confirm / auto-buy $ORBITX)

CREATE TABLE IF NOT EXISTS public.agent_trade_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mint TEXT NOT NULL,
  amount_sol NUMERIC NOT NULL,
  confirm_mode TEXT NOT NULL DEFAULT 'sign' CHECK (confirm_mode IN ('sign', 'auto')),
  slippage NUMERIC NOT NULL DEFAULT 10,
  pool TEXT NOT NULL DEFAULT 'auto',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'opened', 'done', 'expired', 'cancelled')),
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 minutes')
);

CREATE INDEX IF NOT EXISTS agent_trade_intents_user_pending_idx
  ON public.agent_trade_intents (user_id, created_at DESC)
  WHERE status = 'pending';

ALTER TABLE public.agent_trade_intents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agent_trade_intents_owner ON public.agent_trade_intents;
CREATE POLICY agent_trade_intents_owner ON public.agent_trade_intents
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

ALTER TABLE public.agent_settings
  ADD COLUMN IF NOT EXISTS chat_trade_auto BOOLEAN DEFAULT FALSE;
