-- ============================================================
-- OG BETS - Fundraise Campaigns
-- Contributions go directly to the creator's custom recipient
-- wallet (verified on-chain). The $25 creation fee goes to the
-- platform Treasury. Admin reviews/approves campaigns and can
-- mark complete or cancel. All contributions are on-chain verified.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.fundraises (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  creator_username    TEXT,
  creator_wallet      TEXT,
  recipient_wallet    TEXT NOT NULL,          -- custom wallet funds are raised to
  title               TEXT NOT NULL,
  description         TEXT NOT NULL DEFAULT '',
  target_lamports     BIGINT NOT NULL DEFAULT 0,   -- motivational only
  deadline            TIMESTAMPTZ,
  image_url           TEXT,
  link                TEXT,
  status              TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','awaiting_approval','approved','completed','cancelled')),
  raised_lamports     BIGINT NOT NULL DEFAULT 0,
  contribution_count  INT NOT NULL DEFAULT 0,
  creation_fee_tx     TEXT UNIQUE NOT NULL,
  creation_fee_lamports BIGINT NOT NULL DEFAULT 0,
  admin_note          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fundraises_status_idx ON public.fundraises(status, created_at DESC);
CREATE INDEX IF NOT EXISTS fundraises_creator_idx ON public.fundraises(creator_user_id);

CREATE TABLE IF NOT EXISTS public.fundraise_contributions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id         UUID NOT NULL REFERENCES public.fundraises(id) ON DELETE CASCADE,
  contributor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  contributor_username TEXT,
  contributor_wallet  TEXT NOT NULL,
  lamports            BIGINT NOT NULL CHECK (lamports > 0),
  tx_signature        TEXT UNIQUE NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fr_contrib_campaign_idx ON public.fundraise_contributions(campaign_id, created_at DESC);

ALTER TABLE public.fundraises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fundraise_contributions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fr_public_read ON public.fundraises;
CREATE POLICY fr_public_read ON public.fundraises FOR SELECT USING (true);
DROP POLICY IF EXISTS frc_public_read ON public.fundraise_contributions;
CREATE POLICY frc_public_read ON public.fundraise_contributions FOR SELECT USING (true);
GRANT SELECT ON public.fundraises, public.fundraise_contributions TO anon, authenticated;

-- realtime
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN CREATE PUBLICATION supabase_realtime; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='fundraises') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.fundraises'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='fundraise_contributions') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.fundraise_contributions'; END IF;
END $$;
