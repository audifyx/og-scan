begin;

create extension if not exists pgcrypto;

create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  wallet_address text,
  title text not null default 'New conversation'
    check (char_length(title) between 1 and 120),
  model text not null default 'meta/llama-3.3-70b-instruct'
    check (char_length(model) between 1 and 160),
  archived boolean not null default false,
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'tool', 'system')),
  content text not null check (char_length(content) between 1 and 100000),
  model text check (model is null or char_length(model) between 1 and 160),
  tool_events jsonb not null default '[]'::jsonb
    check (jsonb_typeof(tool_events) = 'array'),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create table if not exists public.ai_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid references public.ai_conversations(id) on delete set null,
  kind text not null check (kind in ('image', 'video')),
  prompt text not null check (char_length(prompt) between 1 and 5000),
  provider text not null default 'grok-imagine'
    check (char_length(provider) between 1 and 80),
  model text not null check (char_length(model) between 1 and 160),
  task_id text unique,
  status text not null default 'queued'
    check (status in ('queued', 'waiting', 'processing', 'success', 'failed')),
  result_urls text[] not null default '{}',
  error text,
  settings jsonb not null default '{}'::jsonb
    check (jsonb_typeof(settings) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists ai_conversations_user_updated_idx
  on public.ai_conversations (user_id, updated_at desc);
create index if not exists ai_messages_conversation_created_idx
  on public.ai_messages (conversation_id, created_at asc);
create index if not exists ai_messages_user_created_idx
  on public.ai_messages (user_id, created_at desc);
create index if not exists ai_generations_user_created_idx
  on public.ai_generations (user_id, created_at desc);
create index if not exists ai_generations_user_status_idx
  on public.ai_generations (user_id, status, updated_at desc);

alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.ai_generations enable row level security;

drop policy if exists ai_conversations_select_own on public.ai_conversations;
create policy ai_conversations_select_own
  on public.ai_conversations
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists ai_messages_select_own on public.ai_messages;
create policy ai_messages_select_own
  on public.ai_messages
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists ai_generations_select_own on public.ai_generations;
create policy ai_generations_select_own
  on public.ai_generations
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.ai_conversations, public.ai_messages, public.ai_generations
  from anon, authenticated;

-- Chat and generation history is written only by the authenticated server API
-- using the service role. Clients receive read-only access to their own rows,
-- preventing forged assistant/tool messages or generation state.
grant select
  on table public.ai_conversations, public.ai_messages, public.ai_generations
  to authenticated;

commit;
