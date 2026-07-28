-- ============================================================
-- 014: Site settings — maintenance mode toggle.
-- Single-row table. Public read (so middleware can gate the site);
-- updates only via service role (admin API).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.site_settings (
  id          SMALLINT PRIMARY KEY DEFAULT 1,
  maintenance BOOLEAN NOT NULL DEFAULT false,
  message     TEXT NOT NULL DEFAULT 'Hello community, we are currently working on updating the platform. The site will be back soon.',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT site_settings_single_row CHECK (id = 1)
);
INSERT INTO public.site_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS site_settings_public_read ON public.site_settings;
CREATE POLICY site_settings_public_read ON public.site_settings FOR SELECT USING (true);
GRANT SELECT ON public.site_settings TO anon, authenticated;
