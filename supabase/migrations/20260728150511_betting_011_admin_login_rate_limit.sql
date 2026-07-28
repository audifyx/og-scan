-- ============================================================
-- 011: Brute-force protection for the admin login.
-- Server-only table (service role); locked down from anon/auth.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.admin_login_attempts (
  ip            TEXT PRIMARY KEY,
  attempts      INTEGER NOT NULL DEFAULT 0,
  window_start  TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_until  TIMESTAMPTZ,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_login_attempts ENABLE ROW LEVEL SECURITY;
-- No policies: only the service role (which bypasses RLS) may touch this.
REVOKE ALL ON public.admin_login_attempts FROM anon, authenticated;
