-- ogdex_launches: tokens launched through the OrbitX Launchpad / OG DEX.
-- Written by the API (web/api/ogdex/_routes/_launch.js) and read by the
-- launches feed (web/api/ogdex/_routes/_launches.js) + orbitx_get_launches
-- MCP tool. This table was never created — orbitx_get_launches returned a
-- DB error ("missing ogdex_launches table") until this migration.
CREATE TABLE IF NOT EXISTS public.ogdex_launches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mint text NOT NULL,
  symbol text,
  name text,
  icon text,
  description text,
  creator_wallet text,
  pay_currency text NOT NULL DEFAULT 'sol',
  fee_usd numeric NOT NULL DEFAULT 0,
  payment_tx text NOT NULL UNIQUE,
  launch_tx text,
  links jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'listed',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ogdex_launches_status_created_idx
  ON public.ogdex_launches (status, created_at DESC);
CREATE INDEX IF NOT EXISTS ogdex_launches_mint_idx
  ON public.ogdex_launches (mint);

ALTER TABLE public.ogdex_launches ENABLE ROW LEVEL SECURITY;

-- The launches feed is public; the API writes with the service-role key
-- (bypasses RLS), so only a public read policy is needed.
DROP POLICY IF EXISTS "ogdex_launches_public_select" ON public.ogdex_launches;
CREATE POLICY "ogdex_launches_public_select" ON public.ogdex_launches
  FOR SELECT TO anon, authenticated USING (true);
