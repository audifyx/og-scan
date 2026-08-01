-- MCP OAuth codes + access tokens for Claude/ChatGPT Authenticate flow

CREATE TABLE IF NOT EXISTS agent_mcp_oauth_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL,
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  wallet_address TEXT,
  redirect_uri TEXT NOT NULL,
  client_id TEXT,
  code_challenge TEXT,
  code_challenge_method TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_mcp_oauth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL,
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  wallet_address TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mcp_oauth_codes_hash ON agent_mcp_oauth_codes(code_hash);
CREATE INDEX IF NOT EXISTS idx_mcp_oauth_tokens_hash ON agent_mcp_oauth_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_mcp_oauth_tokens_user ON agent_mcp_oauth_tokens(user_id);

ALTER TABLE agent_mcp_oauth_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_mcp_oauth_tokens ENABLE ROW LEVEL SECURITY;
