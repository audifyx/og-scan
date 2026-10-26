-- OrbitX OS layout sync (2026-10-25) — one row per account holding the
-- whole desktop: icon positions, folders, settings, installed store apps,
-- desk widgets, theme packs, do-not-disturb, price alerts.
-- Device-local state is deliberately excluded: lock PIN and notifications
-- never leave the device.
-- Idempotent: safe to run twice.

CREATE TABLE IF NOT EXISTS public.os_layouts (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  layout jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.os_layouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS os_layouts_owner ON public.os_layouts;
CREATE POLICY os_layouts_owner ON public.os_layouts
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
