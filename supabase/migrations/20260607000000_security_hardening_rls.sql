-- Security Hardening: Enable RLS on previously unprotected tables
-- Applied 2026-06-07 via Viktor security audit

ALTER TABLE public.blocked_email_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.callout_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reserved_usernames ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_types ENABLE ROW LEVEL SECURITY;

-- blocked_email_domains: read-only lookup (no user writes)
CREATE POLICY "public_read_blocked_email_domains"
  ON public.blocked_email_domains FOR SELECT USING (true);

-- reserved_usernames: read-only lookup (no user writes)
CREATE POLICY "public_read_reserved_usernames"
  ON public.reserved_usernames FOR SELECT USING (true);

-- token_types: read-only lookup (no user writes)
CREATE POLICY "public_read_token_types"
  ON public.token_types FOR SELECT USING (true);

-- callout_analysis: admin-only read (sensitive AI data)
CREATE POLICY "admin_read_callout_analysis"
  ON public.callout_analysis FOR SELECT USING (is_admin(auth.uid()));
