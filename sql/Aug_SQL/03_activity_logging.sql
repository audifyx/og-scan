-- Activity Logging & Audit Trail for Agents
-- Tracks all agent actions: trades, posts, mints, launches

-- Agent Activity Log
CREATE TABLE IF NOT EXISTS agent_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL, -- 'trade' | 'mint' | 'launch' | 'post' | 'api_call' | 'error'
  action TEXT NOT NULL, -- 'buy' | 'sell' | 'create_nft' | 'launch_token' | 'social_post'
  status TEXT DEFAULT 'pending', -- pending | success | failed | partial
  description TEXT,
  data_json JSONB, -- Store trade details, NFT metadata, post content, etc.
  tx_hash TEXT, -- For blockchain transactions
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Trades Log (detailed)
CREATE TABLE IF NOT EXISTS agent_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  direction TEXT NOT NULL, -- 'buy' | 'sell'
  token_mint TEXT NOT NULL,
  token_symbol TEXT,
  amount_tokens DECIMAL(30, 8) NOT NULL,
  price_per_token DECIMAL(20, 8) NOT NULL,
  total_value_usd DECIMAL(20, 2) NOT NULL,
  slippage_pct DECIMAL(5, 2),
  status TEXT DEFAULT 'pending', -- pending | executed | failed | cancelled
  tx_hash TEXT UNIQUE,
  dex_used TEXT, -- 'jupiter' | 'raydium' | etc.
  execution_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  executed_at TIMESTAMPTZ
);

-- NFT Minting Log
CREATE TABLE IF NOT EXISTS agent_nft_mints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  nft_name TEXT NOT NULL,
  nft_symbol TEXT,
  collection_address TEXT,
  royalty_basis_points INTEGER,
  metadata_uri TEXT,
  status TEXT DEFAULT 'pending', -- pending | minted | failed
  tx_hash TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  minted_at TIMESTAMPTZ
);

-- Token Launch Log
CREATE TABLE IF NOT EXISTS agent_token_launches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  token_name TEXT NOT NULL,
  token_symbol TEXT NOT NULL,
  initial_supply DECIMAL(30, 8) NOT NULL,
  decimals INTEGER DEFAULT 6,
  status TEXT DEFAULT 'pending', -- pending | launched | failed
  token_mint TEXT UNIQUE,
  tx_hash TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  launched_at TIMESTAMPTZ
);

-- Social Posts Log
CREATE TABLE IF NOT EXISTS agent_social_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  platform TEXT NOT NULL, -- 'twitter' | 'discord' | 'telegram' | 'blog'
  content TEXT NOT NULL,
  media_urls TEXT[], -- Array of media URLs
  status TEXT DEFAULT 'pending', -- pending | posted | failed
  post_url TEXT,
  engagement_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  posted_at TIMESTAMPTZ
);

-- API Call Log (for monitoring and debugging)
CREATE TABLE IF NOT EXISTS agent_api_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  api_key_id UUID REFERENCES agent_api_keys(id),
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL, -- GET | POST | PUT | DELETE
  status_code INTEGER,
  request_data JSONB,
  response_data JSONB,
  error_message TEXT,
  response_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_agent_activities_agent_id ON agent_activities(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_activities_type ON agent_activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_agent_activities_created ON agent_activities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_trades_agent_id ON agent_trades(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_trades_wallet ON agent_trades(wallet_address);
CREATE INDEX IF NOT EXISTS idx_agent_trades_created ON agent_trades(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_nft_mints_agent_id ON agent_nft_mints(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_token_launches_agent_id ON agent_token_launches(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_social_posts_agent_id ON agent_social_posts(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_api_calls_agent_id ON agent_api_calls(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_api_calls_created ON agent_api_calls(created_at DESC);

-- Enable RLS
ALTER TABLE agent_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_nft_mints ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_token_launches ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_api_calls ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Activity Logs (users see only their agents' activities)
CREATE POLICY agent_activities_select ON agent_activities FOR SELECT
  USING (agent_id IN (SELECT id FROM agents WHERE user_id = auth.uid()));

CREATE POLICY agent_activities_insert ON agent_activities FOR INSERT
  WITH CHECK (agent_id IN (SELECT id FROM agents WHERE user_id = auth.uid()));

-- RLS Policies - Trades
CREATE POLICY agent_trades_select ON agent_trades FOR SELECT
  USING (agent_id IN (SELECT id FROM agents WHERE user_id = auth.uid()));

CREATE POLICY agent_trades_insert ON agent_trades FOR INSERT
  WITH CHECK (agent_id IN (SELECT id FROM agents WHERE user_id = auth.uid()));

-- RLS Policies - NFT Mints
CREATE POLICY agent_nft_mints_select ON agent_nft_mints FOR SELECT
  USING (agent_id IN (SELECT id FROM agents WHERE user_id = auth.uid()));

CREATE POLICY agent_nft_mints_insert ON agent_nft_mints FOR INSERT
  WITH CHECK (agent_id IN (SELECT id FROM agents WHERE user_id = auth.uid()));

-- RLS Policies - Token Launches
CREATE POLICY agent_token_launches_select ON agent_token_launches FOR SELECT
  USING (agent_id IN (SELECT id FROM agents WHERE user_id = auth.uid()));

CREATE POLICY agent_token_launches_insert ON agent_token_launches FOR INSERT
  WITH CHECK (agent_id IN (SELECT id FROM agents WHERE user_id = auth.uid()));

-- RLS Policies - Social Posts
CREATE POLICY agent_social_posts_select ON agent_social_posts FOR SELECT
  USING (agent_id IN (SELECT id FROM agents WHERE user_id = auth.uid()));

CREATE POLICY agent_social_posts_insert ON agent_social_posts FOR INSERT
  WITH CHECK (agent_id IN (SELECT id FROM agents WHERE user_id = auth.uid()));

-- RLS Policies - API Calls
CREATE POLICY agent_api_calls_select ON agent_api_calls FOR SELECT
  USING (agent_id IN (SELECT id FROM agents WHERE user_id = auth.uid()));

CREATE POLICY agent_api_calls_insert ON agent_api_calls FOR INSERT
  WITH CHECK (agent_id IN (SELECT id FROM agents WHERE user_id = auth.uid()));
