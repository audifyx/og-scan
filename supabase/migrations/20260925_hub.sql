-- OrbitX AI Hub (chat + tool use) storage
-- Threads: one chat conversation per user.
CREATE TABLE IF NOT EXISTS hub_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hub_threads_user_idx ON hub_threads (user_id, updated_at DESC);

-- Messages: user + assistant turns inside a thread (tool_calls recorded as JSON).
CREATE TABLE IF NOT EXISTS hub_messages (
  id bigserial PRIMARY KEY,
  thread_id uuid NOT NULL REFERENCES hub_threads (id) ON DELETE CASCADE,
  role text NOT NULL,
  content text,
  tool_calls jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hub_messages_thread_idx ON hub_messages (thread_id, id);

-- Pending confirmations: gated (money-moving / publishing) tool calls awaiting user approval.
CREATE TABLE IF NOT EXISTS hub_pending (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  thread_id uuid REFERENCES hub_threads (id) ON DELETE CASCADE,
  tool_name text NOT NULL,
  args jsonb,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hub_pending_user_idx ON hub_pending (user_id, status, created_at DESC);
