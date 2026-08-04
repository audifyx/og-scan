-- X MCP Agent — persona, knowledge, scheduled/draft queue
-- Apply in Supabase SQL editor (or via supabase db push).

CREATE TABLE IF NOT EXISTS x_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'X Agent',
  persona TEXT NOT NULL DEFAULT '',
  voice_notes TEXT DEFAULT '',
  model TEXT NOT NULL DEFAULT 'meta/llama-3.3-70b-instruct',
  mode TEXT NOT NULL DEFAULT 'approve' CHECK (mode IN ('auto', 'approve')),
  enabled BOOLEAN NOT NULL DEFAULT false,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  posting_windows JSONB NOT NULL DEFAULT '[]'::jsonb,
  topics TEXT[] NOT NULL DEFAULT '{}',
  max_posts_per_day INT NOT NULL DEFAULT 5,
  require_x_connected BOOLEAN NOT NULL DEFAULT true,
  last_auto_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS x_agents_user_id_idx ON x_agents(user_id);
CREATE INDEX IF NOT EXISTS x_agents_enabled_idx ON x_agents(enabled) WHERE enabled = true;

CREATE TABLE IF NOT EXISTS x_agent_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES x_agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Note',
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS x_agent_knowledge_agent_id_idx ON x_agent_knowledge(agent_id);

CREATE TABLE IF NOT EXISTS x_agent_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES x_agents(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'post' CHECK (kind IN ('post', 'quote', 'reply', 'dm')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'scheduled', 'posted', 'failed', 'cancelled')),
  scheduled_for TIMESTAMPTZ,
  posted_tweet_id TEXT,
  error TEXT,
  source TEXT NOT NULL DEFAULT 'ui' CHECK (source IN ('ui', 'mcp', 'agent')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS x_agent_queue_user_status_idx ON x_agent_queue(user_id, status);
CREATE INDEX IF NOT EXISTS x_agent_queue_due_idx ON x_agent_queue(scheduled_for)
  WHERE status IN ('scheduled', 'approved');

ALTER TABLE x_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE x_agent_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE x_agent_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS x_agents_owner ON x_agents;
CREATE POLICY x_agents_owner ON x_agents
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS x_agent_knowledge_owner ON x_agent_knowledge;
CREATE POLICY x_agent_knowledge_owner ON x_agent_knowledge
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS x_agent_queue_owner ON x_agent_queue;
CREATE POLICY x_agent_queue_owner ON x_agent_queue
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
