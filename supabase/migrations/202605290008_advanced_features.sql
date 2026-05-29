-- ============================================================
-- OG Scan Advanced Features Migration
-- 1. Alpha call track record on community_posts
-- 2. Price alerts
-- 3. Wallet alerts
-- 4. OG Smart Money wallets (curated)
-- 5. Direct messages
-- 6. OG Reputation score on profiles
-- ============================================================

-- ── 1. Alpha call track record ──────────────────────────────
ALTER TABLE community_posts
  ADD COLUMN IF NOT EXISTS token_price_at_post   NUMERIC,
  ADD COLUMN IF NOT EXISTS token_24h_return       NUMERIC,
  ADD COLUMN IF NOT EXISTS token_7d_return        NUMERIC,
  ADD COLUMN IF NOT EXISTS alpha_tracked_at       TIMESTAMPTZ;

-- ── 2. Price Alerts ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS price_alerts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_ca      TEXT NOT NULL,
  token_symbol  TEXT,
  token_name    TEXT,
  target_price  NUMERIC NOT NULL,
  direction     TEXT NOT NULL CHECK (direction IN ('above', 'below')),
  is_active     BOOLEAN DEFAULT TRUE,
  fired_at      TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE price_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "price_alerts_select" ON price_alerts
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "price_alerts_insert" ON price_alerts
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "price_alerts_update" ON price_alerts
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "price_alerts_delete" ON price_alerts
  FOR DELETE USING (auth.uid() = user_id);

-- ── 3. Wallet Alerts ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wallet_alerts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_address  TEXT NOT NULL,
  label           TEXT,           -- user-given nickname
  is_active       BOOLEAN DEFAULT TRUE,
  last_activity   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, wallet_address)
);

ALTER TABLE wallet_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wallet_alerts_select" ON wallet_alerts
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "wallet_alerts_insert" ON wallet_alerts
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "wallet_alerts_update" ON wallet_alerts
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "wallet_alerts_delete" ON wallet_alerts
  FOR DELETE USING (auth.uid() = user_id);

-- Wallet alert events log
CREATE TABLE IF NOT EXISTS wallet_alert_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_address  TEXT NOT NULL,
  tx_signature    TEXT,
  tx_type         TEXT,           -- 'buy' | 'sell' | 'transfer' | 'swap'
  token_ca        TEXT,
  token_symbol    TEXT,
  amount_usd      NUMERIC,
  raw_data        JSONB,
  seen            BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE wallet_alert_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wallet_alert_events_select" ON wallet_alert_events
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "wallet_alert_events_insert" ON wallet_alert_events
  FOR INSERT WITH CHECK (TRUE);  -- edge function uses service role

-- ── 4. Smart Money Wallets ──────────────────────────────────
CREATE TABLE IF NOT EXISTS og_smart_wallets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  address         TEXT NOT NULL UNIQUE,
  label           TEXT NOT NULL,          -- "Ansem", "Murad", "Insider #12"
  tier            TEXT DEFAULT 'alpha'
                  CHECK (tier IN ('whale', 'kol', 'alpha', 'insider', 'dev')),
  description     TEXT,
  twitter_handle  TEXT,
  avatar_url      TEXT,
  win_rate        NUMERIC,                -- % profitable calls
  avg_return      NUMERIC,               -- avg % return
  is_active       BOOLEAN DEFAULT TRUE,
  last_tx_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Public read, admin write
ALTER TABLE og_smart_wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "smart_wallets_read" ON og_smart_wallets FOR SELECT USING (TRUE);

-- Smart money activity feed
CREATE TABLE IF NOT EXISTS smart_wallet_activity (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address  TEXT NOT NULL,
  tx_signature    TEXT UNIQUE,
  tx_type         TEXT,
  token_ca        TEXT,
  token_symbol    TEXT,
  token_name      TEXT,
  amount_sol      NUMERIC,
  amount_usd      NUMERIC,
  price_at_tx     NUMERIC,
  price_now       NUMERIC,
  return_pct      NUMERIC,
  raw_data        JSONB,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE smart_wallet_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "smart_activity_read" ON smart_wallet_activity FOR SELECT USING (TRUE);
CREATE POLICY "smart_activity_insert" ON smart_wallet_activity FOR INSERT WITH CHECK (TRUE);

CREATE INDEX IF NOT EXISTS idx_smart_activity_wallet ON smart_wallet_activity(wallet_address);
CREATE INDEX IF NOT EXISTS idx_smart_activity_token ON smart_wallet_activity(token_ca);
CREATE INDEX IF NOT EXISTS idx_smart_activity_created ON smart_wallet_activity(created_at DESC);

-- Seed a few known smart wallets
INSERT INTO og_smart_wallets (address, label, tier, description, twitter_handle) VALUES
  ('9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', 'OG Alpha 1', 'kol', 'High win-rate Solana trader', NULL),
  ('HVh6wHNBAsQZAqBnRdTZz4TXNB5X2g8XhJT7LbHm2djq', 'OG Alpha 2', 'alpha', 'Early entry meme trader', NULL)
ON CONFLICT (address) DO NOTHING;

-- ── 5. Direct Messages ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS direct_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content         TEXT NOT NULL,
  image_url       TEXT,
  read_at         TIMESTAMPTZ,
  deleted_by_sender    BOOLEAN DEFAULT FALSE,
  deleted_by_receiver  BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;

-- Can see messages you sent or received
CREATE POLICY "dm_select" ON direct_messages
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "dm_insert" ON direct_messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "dm_update" ON direct_messages
  FOR UPDATE USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE INDEX IF NOT EXISTS idx_dm_sender ON direct_messages(sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dm_receiver ON direct_messages(receiver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dm_conversation ON direct_messages(LEAST(sender_id, receiver_id), GREATEST(sender_id, receiver_id), created_at DESC);

-- ── 6. OG Reputation Score ──────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS og_score          INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS og_rank           TEXT DEFAULT 'Newcomer',
  ADD COLUMN IF NOT EXISTS og_score_updated  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS accurate_calls    INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_calls       INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_likes_received INTEGER DEFAULT 0;

-- ── 7. Notifications table ──────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,  -- 'price_alert' | 'wallet_alert' | 'like' | 'reply' | 'mention' | 'dm'
  title       TEXT NOT NULL,
  body        TEXT,
  data        JSONB,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_select" ON notifications
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notifications_insert" ON notifications
  FOR INSERT WITH CHECK (TRUE);  -- edge functions insert via service role
CREATE POLICY "notifications_update" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "notifications_delete" ON notifications
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, read_at) WHERE read_at IS NULL;

-- ── 8. Community Raids 2.0 ──────────────────────────────────
CREATE TABLE IF NOT EXISTS community_raids (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id    UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  created_by      UUID NOT NULL REFERENCES auth.users(id),
  title           TEXT NOT NULL,
  target_url      TEXT NOT NULL,   -- tweet URL to raid
  goal_likes      INTEGER DEFAULT 0,
  goal_reposts    INTEGER DEFAULT 0,
  goal_replies    INTEGER DEFAULT 0,
  current_likes   INTEGER DEFAULT 0,
  current_reposts INTEGER DEFAULT 0,
  current_replies INTEGER DEFAULT 0,
  participants    INTEGER DEFAULT 0,
  status          TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'expired')),
  ends_at         TIMESTAMPTZ,
  tweet_id        TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE community_raids ENABLE ROW LEVEL SECURITY;
CREATE POLICY "raids_read" ON community_raids FOR SELECT USING (TRUE);
CREATE POLICY "raids_insert" ON community_raids
  FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "raids_update" ON community_raids
  FOR UPDATE USING (TRUE);

-- Raid participants
CREATE TABLE IF NOT EXISTS raid_participants (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raid_id     UUID NOT NULL REFERENCES community_raids(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(raid_id, user_id)
);

ALTER TABLE raid_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "raid_participants_read" ON raid_participants FOR SELECT USING (TRUE);
CREATE POLICY "raid_participants_insert" ON raid_participants
  FOR INSERT WITH CHECK (auth.uid() = user_id);
