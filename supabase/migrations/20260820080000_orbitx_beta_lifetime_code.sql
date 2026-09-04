-- Public /start code: "ORBITX BETA" (normalized ORBITXBETA).
-- First 25 distinct redemptions get lifetime MCP (~100 year grant).
-- duration_seconds was int4; 100 years overflows, so widen first.

ALTER TABLE public.telegram_early_access_codes
  ALTER COLUMN duration_seconds TYPE bigint;

INSERT INTO public.telegram_early_access_codes (code, duration_seconds, max_uses, uses, note)
VALUES (
  'ORBITXBETA',
  3155760000,
  25,
  0,
  'ORBITX BETA lifetime — first 25 supporters'
)
ON CONFLICT (code) DO UPDATE
SET duration_seconds = EXCLUDED.duration_seconds,
    max_uses = EXCLUDED.max_uses,
    note = EXCLUDED.note;
