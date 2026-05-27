-- ============================================================
-- Phases 4 & 5 Migration
-- Feature 18: White-Label Spaces (brand config)
-- Feature 19: Developer API + App Marketplace
-- Feature 13: AI Space Assistant (transcripts, show notes, keyword alerts)
-- Feature 14: AI Host Copilot (coaching reports)
-- Feature 17: Multi-Platform Simulcast (platform connections)
-- Feature 20: Enterprise Mode (audit logs, team seats, SSO config, retention)
-- ============================================================

-- ─── WHITE-LABEL BRAND CONFIG ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS white_label_config (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  brand_name      text,
  logo_url        text,
  primary_color   text DEFAULT '#7C3AED',
  accent_color    text DEFAULT '#3B82F6',
  custom_domain   text,
  tagline         text,
  font            text DEFAULT 'Inter',
  remove_branding boolean DEFAULT false,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
ALTER TABLE white_label_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_rw" ON white_label_config USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- ─── DEVELOPER API KEYS ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS api_keys (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name            text NOT NULL,
  key             text NOT NULL UNIQUE,
  prefix          text NOT NULL,
  scopes          text[] DEFAULT ARRAY['read'],
  is_sandbox      boolean DEFAULT false,
  requests_today  integer DEFAULT 0,
  requests_total  integer DEFAULT 0,
  last_used       timestamptz,
  created_at      timestamptz DEFAULT now()
);
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_rw_api_keys" ON api_keys USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_api_keys_owner ON api_keys(owner_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key ON api_keys(key);

-- ─── WEBHOOK ENDPOINTS ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  url          text NOT NULL,
  events       text[] NOT NULL DEFAULT '{}',
  is_active    boolean DEFAULT true,
  secret       text NOT NULL,
  success_rate numeric(5,2) DEFAULT 100,
  last_fired   timestamptz,
  created_at   timestamptz DEFAULT now()
);
ALTER TABLE webhook_endpoints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_rw_webhooks" ON webhook_endpoints USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_webhook_owner ON webhook_endpoints(owner_id);

-- ─── SPACE TRANSCRIPTS ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS space_transcripts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id     text NOT NULL,
  owner_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  segments     jsonb DEFAULT '[]'::jsonb,
  raw_text     text,
  word_count   integer DEFAULT 0,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);
ALTER TABLE space_transcripts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_rw_transcripts" ON space_transcripts USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_transcripts_space ON space_transcripts(space_id);
CREATE INDEX IF NOT EXISTS idx_transcripts_owner ON space_transcripts(owner_id);

-- ─── SPACE SHOW NOTES ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS space_show_notes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id      text NOT NULL,
  owner_id      uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  summary       text,
  key_points    text[] DEFAULT '{}',
  chapters      jsonb DEFAULT '[]'::jsonb,
  topics        text[] DEFAULT '{}',
  resources     text[] DEFAULT '{}',
  guest_bios    text[] DEFAULT '{}',
  is_published  boolean DEFAULT false,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);
ALTER TABLE space_show_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_rw_show_notes" ON space_show_notes USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_show_notes_space ON space_show_notes(space_id);

-- ─── KEYWORD ALERTS ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS keyword_alerts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  keyword         text NOT NULL,
  is_active       boolean DEFAULT true,
  triggers_today  integer DEFAULT 0,
  triggers_total  integer DEFAULT 0,
  created_at      timestamptz DEFAULT now()
);
ALTER TABLE keyword_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_rw_keyword_alerts" ON keyword_alerts USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- ─── AI COACHING REPORTS ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS host_coaching_reports (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id        text NOT NULL,
  owner_id        uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  overall_score   integer CHECK (overall_score BETWEEN 0 AND 100),
  best_moment     jsonb,
  metrics         jsonb DEFAULT '[]'::jsonb,
  strengths       text[] DEFAULT '{}',
  suggestions     text[] DEFAULT '{}',
  created_at      timestamptz DEFAULT now()
);
ALTER TABLE host_coaching_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_rw_coaching" ON host_coaching_reports USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_coaching_space ON host_coaching_reports(space_id);

-- ─── SIMULCAST PLATFORM CONNECTIONS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS simulcast_platforms (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  platform        text NOT NULL CHECK (platform IN ('youtube','x','linkedin','twitch','custom')),
  stream_key      text,
  rtmp_url        text,
  is_active       boolean DEFAULT true,
  is_connected    boolean DEFAULT false,
  total_views     integer DEFAULT 0,
  total_streams   integer DEFAULT 0,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  UNIQUE(owner_id, platform)
);
ALTER TABLE simulcast_platforms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_rw_simulcast" ON simulcast_platforms USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- ─── ENTERPRISE AUDIT LOGS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS enterprise_audit_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  actor        text NOT NULL,
  action       text NOT NULL,
  resource     text,
  ip_address   text,
  metadata     jsonb DEFAULT '{}'::jsonb,
  status       text DEFAULT 'success' CHECK (status IN ('success','warning','error')),
  created_at   timestamptz DEFAULT now()
);
ALTER TABLE enterprise_audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_read_audit" ON enterprise_audit_logs USING (org_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_audit_org ON enterprise_audit_logs(org_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON enterprise_audit_logs(created_at DESC);

-- ─── ENTERPRISE TEAM SEATS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS enterprise_team_seats (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  user_id      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  email        text NOT NULL,
  role         text DEFAULT 'member' CHECK (role IN ('admin','member','viewer')),
  status       text DEFAULT 'pending' CHECK (status IN ('active','pending','suspended')),
  invited_at   timestamptz DEFAULT now(),
  joined_at    timestamptz,
  last_active  timestamptz,
  UNIQUE(org_id, email)
);
ALTER TABLE enterprise_team_seats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_rw_seats" ON enterprise_team_seats USING (org_id = auth.uid()) WITH CHECK (org_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_seats_org ON enterprise_team_seats(org_id);

-- ─── ENTERPRISE SSO CONFIG ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS enterprise_sso_config (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  is_enabled      boolean DEFAULT false,
  metadata_url    text,
  x509_cert       text,
  acs_url         text DEFAULT 'https://ogscan.fun/auth/saml/callback',
  entity_id       text DEFAULT 'https://ogscan.fun',
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
ALTER TABLE enterprise_sso_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_rw_sso" ON enterprise_sso_config USING (org_id = auth.uid()) WITH CHECK (org_id = auth.uid());

-- ─── ENTERPRISE RETENTION POLICY ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS enterprise_retention_policy (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  recordings      text DEFAULT '1 year',
  chat_transcripts text DEFAULT '90 days',
  audit_logs      text DEFAULT '7 years',
  user_data       text DEFAULT 'Indefinite',
  hipaa_mode      boolean DEFAULT false,
  encrypted_spaces boolean DEFAULT false,
  zero_metadata   boolean DEFAULT false,
  updated_at      timestamptz DEFAULT now()
);
ALTER TABLE enterprise_retention_policy ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_rw_retention" ON enterprise_retention_policy USING (org_id = auth.uid()) WITH CHECK (org_id = auth.uid());

-- ─── MARKETPLACE APP INSTALLS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS marketplace_installs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  app_id      text NOT NULL,
  app_name    text NOT NULL,
  installed_at timestamptz DEFAULT now(),
  UNIQUE(owner_id, app_id)
);
ALTER TABLE marketplace_installs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_rw_installs" ON marketplace_installs USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
