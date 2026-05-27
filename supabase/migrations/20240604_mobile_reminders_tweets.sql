-- ============================================================
-- Migration: Mobile App, Reminders, Auto-Tweet, Podcasts, Clip Export
-- Feature 16 + Push/Email Reminders + Auto-Tweet + Podcast Publisher + Clip Video Export
-- ============================================================

-- ─── Notification / Reminder Settings ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notification_settings (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  push_enabled    boolean NOT NULL DEFAULT false,
  email_enabled   boolean NOT NULL DEFAULT true,
  email_address   text,
  remind_15min_default boolean NOT NULL DEFAULT true,
  remind_1hour_default boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own notification settings" ON notification_settings
  USING (auth.uid() = user_id);

-- ─── Per-Space Reminder Prefs ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS space_reminder_prefs (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  space_id        uuid NOT NULL,
  remind_15min    boolean NOT NULL DEFAULT true,
  remind_1hour    boolean NOT NULL DEFAULT true,
  via_push        boolean NOT NULL DEFAULT false,
  via_email       boolean NOT NULL DEFAULT true,
  sent_15min      boolean NOT NULL DEFAULT false,
  sent_1hour      boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, space_id)
);
ALTER TABLE space_reminder_prefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own reminders" ON space_reminder_prefs
  USING (auth.uid() = user_id);

-- ─── Auto-Tweet Settings & Logs ──────────────────────────────────────────────

-- Add auto_tweet columns to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS auto_tweet_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS tweet_template_id  text;

-- Auto-tweet send log
CREATE TABLE IF NOT EXISTS auto_tweet_logs (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  space_id        uuid,
  space_title     text,
  tweet_content   text NOT NULL,
  sent_at         timestamptz NOT NULL DEFAULT now(),
  status          text NOT NULL DEFAULT 'manual' CHECK (status IN ('sent','failed','manual')),
  tweet_url       text
);
ALTER TABLE auto_tweet_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own tweet logs" ON auto_tweet_logs
  USING (auth.uid() = user_id);

-- ─── Podcast Submissions ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS podcast_submissions (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  show_id         uuid NOT NULL,
  platform        text NOT NULL CHECK (platform IN ('spotify','apple')),
  status          text NOT NULL DEFAULT 'not_submitted'
                    CHECK (status IN ('not_submitted','pending','approved','rejected')),
  submitted_at    timestamptz,
  podcast_url     text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (show_id, platform)
);
ALTER TABLE podcast_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own podcast submissions" ON podcast_submissions
  USING (auth.uid() = user_id);

-- ─── Mobile Beta Waitlist ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS mobile_beta_waitlist (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email           text NOT NULL,
  platform        text NOT NULL DEFAULT 'both' CHECK (platform IN ('ios','android','both')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (email)
);
ALTER TABLE mobile_beta_waitlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can join beta waitlist" ON mobile_beta_waitlist
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Users view own waitlist entry" ON mobile_beta_waitlist
  FOR SELECT USING (true);

-- ─── Clip Video Export Requests ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS clip_video_exports (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  clip_id         uuid NOT NULL,
  aspect_ratio    text NOT NULL DEFAULT '16:9' CHECK (aspect_ratio IN ('16:9','9:16','1:1')),
  bg_style        text NOT NULL DEFAULT 'waveform',
  gradient_start  text,
  gradient_end    text,
  caption         text,
  show_branding   boolean NOT NULL DEFAULT true,
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','done','failed')),
  output_url      text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE clip_video_exports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own exports" ON clip_video_exports
  USING (auth.uid() = user_id);

-- ─── Indexes ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_space_reminder_prefs_user ON space_reminder_prefs(user_id);
CREATE INDEX IF NOT EXISTS idx_space_reminder_prefs_space ON space_reminder_prefs(space_id);
CREATE INDEX IF NOT EXISTS idx_auto_tweet_logs_user ON auto_tweet_logs(user_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_podcast_submissions_show ON podcast_submissions(show_id);
CREATE INDEX IF NOT EXISTS idx_clip_video_exports_user ON clip_video_exports(user_id, created_at DESC);
