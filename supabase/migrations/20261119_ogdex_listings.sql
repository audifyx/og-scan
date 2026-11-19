-- ogdex_listings: tokens submitted for listing on the OrbitX DEX.
-- Written by the listings route (web/api/ogdex/_routes/_listings.js),
-- the admin quick-add (web/api/ogdex/_routes/_admin.js), and the MCP
-- listing request (orbitx-hub.js); read by the listings feed + the
-- orbitx_dex_listings MCP tool. This table never existed — the feed fell
-- back to the hardcoded official ORBITX token with a "missing table" error.
CREATE TABLE IF NOT EXISTS public.ogdex_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_address text NOT NULL,
  chain text NOT NULL DEFAULT 'solana',
  project_name text,
  symbol text,
  logo_url text,
  banner_url text,
  description text,
  links jsonb NOT NULL DEFAULT '{}'::jsonb,
  contact text,
  payment_tx text,
  tier text NOT NULL DEFAULT 'standard',
  status text NOT NULL DEFAULT 'pending',
  featured boolean NOT NULL DEFAULT false,
  featured_rank integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  views integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ogdex_listings_status_featured_idx
  ON public.ogdex_listings (status, featured DESC, featured_rank DESC, approved_at DESC);
CREATE INDEX IF NOT EXISTS ogdex_listings_contract_idx
  ON public.ogdex_listings (contract_address);

ALTER TABLE public.ogdex_listings ENABLE ROW LEVEL SECURITY;

-- The public feed only ever shows approved listings; the API/admin write
-- with the service-role key (bypasses RLS).
DROP POLICY IF EXISTS "ogdex_listings_public_select" ON public.ogdex_listings;
CREATE POLICY "ogdex_listings_public_select" ON public.ogdex_listings
  FOR SELECT TO anon, authenticated USING (status = 'approved');
