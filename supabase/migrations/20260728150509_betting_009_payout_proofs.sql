-- ============================================================
-- 009: On-chain payout proofs
-- Records whether a winner's payout transaction was verified
-- on-chain (treasury -> winner wallet for >= the owed amount).
-- ============================================================
ALTER TABLE public.user_bets ADD COLUMN IF NOT EXISTS payout_verified     BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.user_bets ADD COLUMN IF NOT EXISTS payout_verified_at  TIMESTAMPTZ;

-- index for the public "recent payouts" feed on the treasury page
CREATE INDEX IF NOT EXISTS idx_user_bets_paid
  ON public.user_bets(claimed_at DESC)
  WHERE claimed = true;
