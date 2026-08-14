begin;

create table if not exists public.ai_tool_confirmations (
  event_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  message_id uuid not null references public.ai_messages(id) on delete cascade,
  tool_name text not null check (char_length(tool_name) between 1 and 160),
  arguments jsonb not null default '{}'::jsonb
    check (jsonb_typeof(arguments) = 'object'),
  status text not null default 'pending'
    check (status in ('pending', 'executing', 'completed', 'failed')),
  result jsonb,
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_tool_confirmations_user_status_idx
  on public.ai_tool_confirmations (user_id, status, expires_at);
create index if not exists ai_tool_confirmations_conversation_idx
  on public.ai_tool_confirmations (conversation_id, created_at desc);

alter table public.ai_tool_confirmations enable row level security;

-- Confirmation arguments and results are server-only. The first-party API
-- resolves the authenticated user and atomically consumes pending rows.
revoke all on table public.ai_tool_confirmations from anon, authenticated;

commit;
