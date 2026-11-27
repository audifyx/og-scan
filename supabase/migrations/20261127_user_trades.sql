-- "Solve everything" batch — backend half (2026-11-27).
--
-- Closes the gap the referrals build documented: NO table recorded in-app
-- user swaps with per-user volume, so a DB volume ranking was impossible.
-- Also adds the limit-order tracking table for the Jupiter Trigger v1
-- order-placement path (user signs every tx in-app; the backend never
-- holds keys, never signs, never submits a user transaction).
--
-- NAMING: public.trades already exists (agent/bot trades: agent_id, qty,
-- price_usd — 0 rows). This table is deliberately named user_trades so it
-- cannot collide with it.
--
-- RLS / WRITE-PATH DECISION (same pattern as referrals):
--   * user_trades / user_limit_orders allow INSERT + SELECT only for the
--     owning user (auth.uid() = user_id). No UPDATE/DELETE for clients.
--   * The platform API (/trades record, /limit-orders confirm) verifies
--     the caller's Supabase JWT AND that profiles.wallet_address matches
--     the submitted wallet, then inserts with the service-role key.
--     A caller can never record trades for someone else's wallet.
--   * Aggregates are exposed ONLY through the user_trade_volume view
--     (username / avatar / totals — no per-trade detail, no emails) and
--     the referral_leaderboard_view from 20261127_referrals.sql.

-- ------------------------------------------------------------ user_trades
CREATE TABLE IF NOT EXISTS public.user_trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  wallet_address text NOT NULL,
  mint text NOT NULL,
  symbol text,
  side text NOT NULL CHECK (side IN ('buy', 'sell')),
  token_amount numeric NOT NULL CHECK (token_amount > 0),
  sol_amount numeric CHECK (sol_amount IS NULL OR sol_amount >= 0),
  usd_amount numeric NOT NULL CHECK (usd_amount >= 0),
  fee_usd numeric NOT NULL DEFAULT 0 CHECK (fee_usd >= 0),
  tx_signature text NOT NULL,
  source text NOT NULL DEFAULT 'app' CHECK (source IN ('app', 'web')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_trades_tx_signature_unique UNIQUE (tx_signature)
);

CREATE INDEX IF NOT EXISTS user_trades_wallet_created_idx
  ON public.user_trades (wallet_address, created_at DESC);
CREATE INDEX IF NOT EXISTS user_trades_user_created_idx
  ON public.user_trades (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS user_trades_mint_idx
  ON public.user_trades (mint);

ALTER TABLE public.user_trades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_trades_insert_own ON public.user_trades;
CREATE POLICY user_trades_insert_own ON public.user_trades
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS user_trades_select_own ON public.user_trades;
CREATE POLICY user_trades_select_own ON public.user_trades
  FOR SELECT USING (auth.uid() = user_id);

-- No UPDATE / DELETE policies: clients cannot mutate recorded trades.

-- ------------------------------------------------------- user_trade_volume
-- Per-wallet volume, 30d + all-time, with public profile fields only.
-- Runs with the owner's privileges (security_invoker off by default), so
-- it can read the RLS-gated user_trades table and expose ONLY aggregates.
CREATE OR REPLACE VIEW public.user_trade_volume AS
SELECT
  t.wallet_address,
  t.user_id,
  p.username,
  p.display_name,
  p.avatar_url,
  COUNT(*) FILTER (WHERE t.created_at >= now() - interval '30 days') AS trade_count_30d,
  COALESCE(SUM(t.usd_amount) FILTER (WHERE t.created_at >= now() - interval '30 days'), 0) AS volume_usd_30d,
  COUNT(*) AS trade_count_all,
  COALESCE(SUM(t.usd_amount), 0) AS volume_usd_all,
  MAX(t.created_at) AS last_trade_at
FROM public.user_trades t
LEFT JOIN public.profiles p ON p.user_id = t.user_id
GROUP BY t.wallet_address, t.user_id, p.username, p.display_name, p.avatar_url;

GRANT SELECT ON public.user_trade_volume TO anon, authenticated;

-- ------------------------------------------------------- user_limit_orders
-- Tracks Jupiter Trigger v1 orders the user created in-app, so the app can
-- show "my orders" with filled/cancelled status. The backend NEVER creates
-- or cancels an order by itself: create/cancel return an UNSIGNED tx that
-- the user signs on-device; confirm/confirm-cancel only record what the
-- user already submitted on-chain.
CREATE TABLE IF NOT EXISTS public.user_limit_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  wallet_address text NOT NULL,
  order_account text,
  tx_signature text NOT NULL,
  input_mint text NOT NULL,
  output_mint text NOT NULL,
  making_amount numeric NOT NULL CHECK (making_amount > 0),
  taking_amount numeric NOT NULL CHECK (taking_amount > 0),
  target_price_usd numeric,
  direction text NOT NULL CHECK (direction IN ('buy', 'sell')),
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'filled', 'cancelled', 'expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_limit_orders_tx_signature_unique UNIQUE (tx_signature),
  CONSTRAINT user_limit_orders_order_account_unique UNIQUE (order_account)
);

CREATE INDEX IF NOT EXISTS user_limit_orders_wallet_status_idx
  ON public.user_limit_orders (wallet_address, status);
CREATE INDEX IF NOT EXISTS user_limit_orders_user_idx
  ON public.user_limit_orders (user_id, created_at DESC);

ALTER TABLE public.user_limit_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_limit_orders_insert_own ON public.user_limit_orders;
CREATE POLICY user_limit_orders_insert_own ON public.user_limit_orders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS user_limit_orders_select_own ON public.user_limit_orders;
CREATE POLICY user_limit_orders_select_own ON public.user_limit_orders
  FOR SELECT USING (auth.uid() = user_id);

-- No UPDATE / DELETE policies: status changes go through the service-role
-- API only (confirm-cancel + the list endpoint's Jupiter reconciliation).
