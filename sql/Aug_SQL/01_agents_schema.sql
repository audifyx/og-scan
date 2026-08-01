-- Agent System Schema
-- Tables for managing AI agents, API keys, and user authentication

-- Agents table
CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active', -- active | paused | disabled
  wallet_address TEXT,
  phantom_connected BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT agents_user_id_name_unique UNIQUE (user_id, name)
);

-- API Keys for agents
CREATE TABLE IF NOT EXISTS agent_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  key_hash TEXT NOT NULL UNIQUE, -- SHA-256 hash of the actual key
  name TEXT NOT NULL,
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT agent_api_keys_agent_id_name_unique UNIQUE (agent_id, name)
);

-- Agent Settings & Configuration
CREATE TABLE IF NOT EXISTS agent_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  trading_enabled BOOLEAN DEFAULT TRUE,
  nft_minting_enabled BOOLEAN DEFAULT TRUE,
  token_launch_enabled BOOLEAN DEFAULT TRUE,
  social_posting_enabled BOOLEAN DEFAULT TRUE,
  max_trade_size_usd DECIMAL(20, 2) DEFAULT 1000,
  max_daily_volume_usd DECIMAL(20, 2) DEFAULT 10000,
  auto_stop_loss_pct DECIMAL(5, 2),
  auto_take_profit_pct DECIMAL(5, 2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (agent_id)
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_agents_user_id ON agents(user_id);
CREATE INDEX IF NOT EXISTS idx_agents_wallet ON agents(wallet_address);
CREATE INDEX IF NOT EXISTS idx_agent_api_keys_agent_id ON agent_api_keys(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_api_keys_hash ON agent_api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_agent_settings_agent_id ON agent_settings(agent_id);

-- Enable RLS (Row Level Security)
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only see their own agents
CREATE POLICY agents_select_own ON agents FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY agents_insert_own ON agents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY agents_update_own ON agents FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY agents_delete_own ON agents FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for API Keys (through agents)
CREATE POLICY agent_api_keys_select ON agent_api_keys FOR SELECT
  USING (agent_id IN (SELECT id FROM agents WHERE user_id = auth.uid()));

CREATE POLICY agent_api_keys_insert ON agent_api_keys FOR INSERT
  WITH CHECK (agent_id IN (SELECT id FROM agents WHERE user_id = auth.uid()));

CREATE POLICY agent_api_keys_update ON agent_api_keys FOR UPDATE
  USING (agent_id IN (SELECT id FROM agents WHERE user_id = auth.uid()))
  WITH CHECK (agent_id IN (SELECT id FROM agents WHERE user_id = auth.uid()));

CREATE POLICY agent_api_keys_delete ON agent_api_keys FOR DELETE
  USING (agent_id IN (SELECT id FROM agents WHERE user_id = auth.uid()));

-- RLS Policies for Settings
CREATE POLICY agent_settings_select ON agent_settings FOR SELECT
  USING (agent_id IN (SELECT id FROM agents WHERE user_id = auth.uid()));

CREATE POLICY agent_settings_insert ON agent_settings FOR INSERT
  WITH CHECK (agent_id IN (SELECT id FROM agents WHERE user_id = auth.uid()));

CREATE POLICY agent_settings_update ON agent_settings FOR UPDATE
  USING (agent_id IN (SELECT id FROM agents WHERE user_id = auth.uid()))
  WITH CHECK (agent_id IN (SELECT id FROM agents WHERE user_id = auth.uid()));
