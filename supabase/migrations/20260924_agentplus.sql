-- AgentPlus: persistent autonomous-agent substrate for the OrbitX MCP.
-- The MCP provides the agent substrate (identity, memory, inbox, append-only
-- log, file workspace, task queue). The mind is whichever LLM drives these
-- tools. All rows are per-user (user_id from OrbitX auth). Service-role
-- access only; RLS enabled with no public policies.

create table if not exists public.ap_agents (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  name text not null,
  role text,
  persona text,
  capabilities jsonb,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  unique (user_id, name)
);
create index if not exists ap_agents_user_status on public.ap_agents (user_id, status);

create table if not exists public.ap_agent_memory (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  agent_id uuid not null references public.ap_agents (id) on delete cascade,
  key text not null,
  value text,
  updated_at timestamptz not null default now(),
  unique (agent_id, key)
);
create index if not exists ap_agent_memory_agent on public.ap_agent_memory (agent_id);

create table if not exists public.ap_agent_messages (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  from_name text not null,
  to_name text not null,
  body text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists ap_agent_messages_inbox on public.ap_agent_messages (user_id, to_name, read);

create table if not exists public.ap_agent_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  agent_id uuid not null references public.ap_agents (id) on delete cascade,
  title text not null,
  kind text not null default 'general',
  instructions text,
  steps jsonb not null default '[]'::jsonb,
  status text not null default 'open',
  created_at timestamptz not null default now()
);
create index if not exists ap_agent_tasks_user_agent on public.ap_agent_tasks (user_id, agent_id, status);

create table if not exists public.ap_agent_files (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  task_id uuid not null references public.ap_agent_tasks (id) on delete cascade,
  path text not null,
  content text not null,
  version int not null default 1,
  sha256 text,
  created_at timestamptz not null default now(),
  unique (task_id, path, version)
);
create index if not exists ap_agent_files_task_path on public.ap_agent_files (task_id, path, version desc);

create table if not exists public.ap_agent_logs (
  id bigserial primary key,
  user_id text not null,
  agent_id uuid references public.ap_agents (id) on delete set null,
  task_id uuid references public.ap_agent_tasks (id) on delete set null,
  kind text not null,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists ap_agent_logs_user_id on public.ap_agent_logs (user_id, id);

alter table public.ap_agents enable row level security;
alter table public.ap_agent_memory enable row level security;
alter table public.ap_agent_messages enable row level security;
alter table public.ap_agent_tasks enable row level security;
alter table public.ap_agent_files enable row level security;
alter table public.ap_agent_logs enable row level security;
