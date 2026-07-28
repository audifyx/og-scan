-- ============================================================
-- 012: 50% off all fees — game match rake 5% -> 2.5%.
-- (Placement-fee tiers and the $25->$12.50 fundraise fee are in app code.)
-- ============================================================
ALTER TABLE public.game_matches ALTER COLUMN rake_bps SET DEFAULT 250;
-- Apply the discount to matches that haven't paid out yet.
UPDATE public.game_matches SET rake_bps = 250 WHERE status IN ('open','reserved','live','pending') AND rake_bps = 500;

-- Legacy matches table (if present) kept consistent.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='matches' AND column_name='rake_bps') THEN
    EXECUTE 'ALTER TABLE public.matches ALTER COLUMN rake_bps SET DEFAULT 250';
  END IF;
END $$;
