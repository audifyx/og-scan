-- Token Gating Schema for Agent Access Control
-- Tracks user token holdings and buy history to verify $10 threshold access

-- Token Requirements
CREATE TABLE IF NOT EXISTS token_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_ca TEXT UNIQUE NOT NULL, -- Contract Address
  token_symbol TEXT,
  min_value_usd DECIMAL(20, 2) NOT NULL DEFAULT 10.00,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert the required token
INSERT INTO token_requirements (token_ca, token_symbol, min_value_usd)
VALUES ('13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9', 'ORBITX', 10.00)
ON CONFLICT (token_ca) DO NOTHING;

-- User Token Holdings (snapshot/cache)
CREATE TABLE IF NOT EXISTS user_token_holdings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  wallet_address TEXT NOT NULL,
  token_ca TEXT NOT NULL REFERENCES token_requirements(token_ca),
  amount DECIMAL(30, 8) NOT NULL,
  value_usd DECIMAL(20, 2) NOT NULL,
  last_verified_at TIMESTAMPTZ DEFAULT NOW(),
  verified_from_chain BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT user_token_holdings_unique UNIQUE (user_id, wallet_address, token_ca)
);

-- User Trading History (aggregated buy transactions)
CREATE TABLE IF NOT EXISTS user_buy_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  wallet_address TEXT NOT NULL,
  token_ca TEXT NOT NULL REFERENCES token_requirements(token_ca),
  tx_hash TEXT UNIQUE NOT NULL,
  amount DECIMAL(30, 8) NOT NULL,
  price_usd_per_token DECIMAL(20, 8) NOT NULL,
  total_value_usd DECIMAL(20, 2) NOT NULL,
  tx_timestamp TIMESTAMPTZ NOT NULL,
  verified_from_chain BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT buy_history_unique_tx UNIQUE (user_id, wallet_address, tx_hash)
);

-- User Access Verification (cached verification results)
CREATE TABLE IF NOT EXISTS user_access_verification (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  wallet_address TEXT NOT NULL,
  meets_token_requirement BOOLEAN DEFAULT FALSE,
  current_holding_usd DECIMAL(20, 2) DEFAULT 0,
  cumulative_buy_value_usd DECIMAL(20, 2) DEFAULT 0,
  verified_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours'),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_token_holdings_user_id ON user_token_holdings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_token_holdings_wallet ON user_token_holdings(wallet_address);
CREATE INDEX IF NOT EXISTS idx_user_token_holdings_token ON user_token_holdings(token_ca);
CREATE INDEX IF NOT EXISTS idx_user_buy_history_user_id ON user_buy_history(user_id);
CREATE INDEX IF NOT EXISTS idx_user_buy_history_wallet ON user_buy_history(wallet_address);
CREATE INDEX IF NOT EXISTS idx_user_buy_history_token ON user_buy_history(token_ca);
CREATE INDEX IF NOT EXISTS idx_access_verification_user_id ON user_access_verification(user_id);
CREATE INDEX IF NOT EXISTS idx_access_verification_expires ON user_access_verification(expires_at);

-- Enable RLS
ALTER TABLE token_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_token_holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_buy_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_access_verification ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Token Requirements (public read)
CREATE POLICY token_requirements_select ON token_requirements FOR SELECT
  USING (TRUE);

-- RLS Policies - User Token Holdings
CREATE POLICY user_token_holdings_select ON user_token_holdings FOR SELECT
  USING (auth.uid() = user_id OR auth.role() = 'authenticated');

CREATE POLICY user_token_holdings_insert ON user_token_holdings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies - User Buy History
CREATE POLICY user_buy_history_select ON user_buy_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY user_buy_history_insert ON user_buy_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies - Access Verification
CREATE POLICY access_verification_select ON user_access_verification FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY access_verification_insert ON user_access_verification FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY access_verification_update ON user_access_verification FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
