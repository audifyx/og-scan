-- Telegram bot early-access codes + timed access.
-- Also relax MCP burn package_id checks so hour / day / week / month grants persist.

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT con.conrelid::regclass AS tbl, con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname IN ('mcp_burn_access', 'mcp_burn_ledger', 'mcp_burn_wallet_access')
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ~* 'package_id'
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT IF EXISTS %I', r.tbl, r.conname);
  END LOOP;

  FOR r IN
    SELECT con.conrelid::regclass AS tbl, con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname IN ('mcp_burn_access', 'mcp_burn_ledger', 'mcp_burn_wallet_access')
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ~* 'tokens_burned'
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT IF EXISTS %I', r.tbl, r.conname);
  END LOOP;
END $$;

ALTER TABLE public.mcp_burn_access DROP CONSTRAINT IF EXISTS mcp_burn_access_tokens_burned_nonneg;
ALTER TABLE public.mcp_burn_ledger DROP CONSTRAINT IF EXISTS mcp_burn_ledger_tokens_burned_nonneg;
ALTER TABLE public.mcp_burn_wallet_access DROP CONSTRAINT IF EXISTS mcp_burn_wallet_access_tokens_burned_nonneg;

ALTER TABLE public.mcp_burn_access
  ADD CONSTRAINT mcp_burn_access_tokens_burned_nonneg CHECK (tokens_burned >= 0);
ALTER TABLE public.mcp_burn_ledger
  ADD CONSTRAINT mcp_burn_ledger_tokens_burned_nonneg CHECK (tokens_burned >= 0);
ALTER TABLE public.mcp_burn_wallet_access
  ADD CONSTRAINT mcp_burn_wallet_access_tokens_burned_nonneg CHECK (tokens_burned >= 0);

CREATE TABLE IF NOT EXISTS public.telegram_early_access_codes (
  code text PRIMARY KEY,
  duration_seconds int NOT NULL DEFAULT 604800 CHECK (duration_seconds > 0),
  max_uses int,
  uses int NOT NULL DEFAULT 0 CHECK (uses >= 0),
  expires_at timestamptz,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.telegram_early_access_codes IS
  'Redeemable codes for official @theorbitxmcpbot. Service role only.';

CREATE TABLE IF NOT EXISTS public.telegram_bot_access (
  telegram_user_id text PRIMARY KEY,
  user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  wallet_address text,
  source text NOT NULL CHECK (source IN ('code', 'burn')),
  code text,
  package_id text,
  tx_signature text,
  expires_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.telegram_bot_access IS
  'Official-bot timed access from an early-access code or a verified $ORBITX burn.';

CREATE INDEX IF NOT EXISTS telegram_bot_access_expires_idx
  ON public.telegram_bot_access (expires_at);
CREATE INDEX IF NOT EXISTS telegram_bot_access_user_idx
  ON public.telegram_bot_access (user_id);
CREATE INDEX IF NOT EXISTS telegram_bot_access_sig_idx
  ON public.telegram_bot_access (tx_signature);

ALTER TABLE public.telegram_early_access_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_bot_access ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.telegram_early_access_codes FROM anon, authenticated;
REVOKE ALL ON public.telegram_bot_access FROM anon, authenticated;

GRANT ALL ON public.telegram_early_access_codes TO service_role;
GRANT ALL ON public.telegram_bot_access TO service_role;
