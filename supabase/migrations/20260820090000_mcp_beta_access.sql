-- MCP / Telegram beta supporter flag on profiles.
-- Set by @theorbitxmcpbot after ORBITX BETA redeem (or timed burn) + /login.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS mcp_beta_access boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.mcp_beta_access IS
  'True after Telegram MCP beta redeem + wallet auth. Profile badge reads beta access.';
