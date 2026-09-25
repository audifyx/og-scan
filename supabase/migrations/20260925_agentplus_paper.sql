-- AgentPlus paper trading portfolios (SIMULATED — zero real money).
-- One row per agent: 10,000 paper USDC starting cash, positions as JSONB.
CREATE TABLE IF NOT EXISTS ap_agent_portfolios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  agent_id uuid NOT NULL UNIQUE REFERENCES ap_agents(id) ON DELETE CASCADE,
  cash numeric NOT NULL DEFAULT 10000,
  positions jsonb NOT NULL DEFAULT '[]'::jsonb,
  realized_pnl numeric NOT NULL DEFAULT 0,
  trade_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ap_agent_portfolios_user ON ap_agent_portfolios(user_id);
