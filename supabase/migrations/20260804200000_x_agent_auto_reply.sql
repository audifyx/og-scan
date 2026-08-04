-- X agent auto-reply: mentions, DMs, group DMs + dedupe log

ALTER TABLE x_agents
  ADD COLUMN IF NOT EXISTS auto_reply_mentions BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_reply_dms BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_reply_group_dms BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS max_replies_per_day INT NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS last_mention_since_id TEXT,
  ADD COLUMN IF NOT EXISTS last_dm_since_id TEXT,
  ADD COLUMN IF NOT EXISTS last_reply_poll_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS x_agent_handled (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES x_agents(id) ON DELETE CASCADE,
  source_kind TEXT NOT NULL CHECK (source_kind IN ('mention', 'dm', 'group_dm')),
  source_id TEXT NOT NULL,
  queue_id UUID REFERENCES x_agent_queue(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, source_kind, source_id)
);

CREATE INDEX IF NOT EXISTS x_agent_handled_user_idx ON x_agent_handled(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS x_agents_auto_reply_idx ON x_agents(enabled)
  WHERE enabled = true AND (auto_reply_mentions OR auto_reply_dms OR auto_reply_group_dms);

ALTER TABLE x_agent_handled ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS x_agent_handled_owner ON x_agent_handled;
CREATE POLICY x_agent_handled_owner ON x_agent_handled
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
