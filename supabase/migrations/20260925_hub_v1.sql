-- OrbitX AI Hub v1: safety/quote context on pendings, watchlist, address labels
ALTER TABLE hub_pending ADD COLUMN IF NOT EXISTS safety jsonb;
ALTER TABLE hub_pending ADD COLUMN IF NOT EXISTS quote jsonb;

-- Watchlist: tokens the user follows ("add BONK to my watchlist").
-- Feeds the morning brief; the model can attach alerts to watchlist mints.
CREATE TABLE IF NOT EXISTS hub_watchlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  mint text NOT NULL,
  chain text NOT NULL DEFAULT 'solana',
  label text,
  added_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, mint)
);
CREATE INDEX IF NOT EXISTS hub_watchlist_user_idx ON hub_watchlist (user_id, added_at DESC);

-- Address book: user labels for wallets ("label this wallet 'Binance cold'").
-- Labels surface in dossiers, alerts, and whale tracking.
CREATE TABLE IF NOT EXISTS hub_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  address text NOT NULL,
  label text NOT NULL,
  chain text NOT NULL DEFAULT 'solana',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, address)
);
CREATE INDEX IF NOT EXISTS hub_labels_user_idx ON hub_labels (user_id, created_at DESC);
