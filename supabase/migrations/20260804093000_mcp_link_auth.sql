-- MCP link-auth sessions — Grok clickable OrbitX auth links.

CREATE TABLE IF NOT EXISTS mcp_link_sessions (
  code TEXT PRIMARY KEY,
  mcp_kind TEXT NOT NULL DEFAULT 'x' CHECK (mcp_kind IN ('x', 'agent')),
  mcp_session_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'expired')),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id UUID,
  wallet_address TEXT,
  access_token_hash TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS mcp_link_sessions_status_idx
  ON mcp_link_sessions(status, expires_at);

CREATE INDEX IF NOT EXISTS mcp_link_sessions_session_idx
  ON mcp_link_sessions(mcp_session_id)
  WHERE mcp_session_id IS NOT NULL AND status = 'completed';

ALTER TABLE mcp_link_sessions ENABLE ROW LEVEL SECURITY;
