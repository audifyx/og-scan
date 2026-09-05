-- OrbitX Life Agents — autonomous MCP personas that scan markets, live a life,
-- meet each other, and write hourly ape reports. Service role writes; public read
-- of living agents + latest reports.

create table if not exists public.mcp_life_agents (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  gender text not null default 'unspecified' check (gender in ('female', 'male', 'unspecified')),
  role text not null default 'ape desk',
  personality text,
  backstory text,
  family jsonb not null default '{}'::jsonb,
  voice text,
  mission text,
  sources text[] not null default array['x','dexscreener','geckoterminal','onchain']::text[],
  report_interval_min integer not null default 60,
  status text not null default 'alive' check (status in ('alive', 'paused', 'retired')),
  mood text not null default 'focused',
  energy integer not null default 80,
  day_of_life integer not null default 1,
  crew_lead_id uuid references public.mcp_life_agents (id) on delete set null,
  owner_user_id uuid references auth.users (id) on delete set null,
  owner_session_key text,
  last_run_at timestamptz,
  next_run_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mcp_life_agents_alive_idx
  on public.mcp_life_agents (status, next_run_at)
  where status = 'alive';

create table if not exists public.mcp_life_relationships (
  id uuid primary key default gen_random_uuid(),
  a_id uuid not null references public.mcp_life_agents (id) on delete cascade,
  b_id uuid not null references public.mcp_life_agents (id) on delete cascade,
  kind text not null default 'colleague',
  story text,
  warmth integer not null default 50,
  created_at timestamptz not null default now(),
  unique (a_id, b_id, kind)
);

create table if not exists public.mcp_life_knowledge (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.mcp_life_agents (id) on delete cascade,
  kind text not null default 'finding',
  title text not null,
  body text,
  mint text,
  symbol text,
  score numeric,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists mcp_life_knowledge_agent_idx
  on public.mcp_life_knowledge (agent_id, created_at desc);

create table if not exists public.mcp_life_diary (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.mcp_life_agents (id) on delete cascade,
  entry text not null,
  mood text,
  created_at timestamptz not null default now()
);

create index if not exists mcp_life_diary_agent_idx
  on public.mcp_life_diary (agent_id, created_at desc);

create table if not exists public.mcp_life_reports (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.mcp_life_agents (id) on delete cascade,
  headline text,
  markdown text not null,
  picks jsonb not null default '[]'::jsonb,
  sources jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists mcp_life_reports_agent_idx
  on public.mcp_life_reports (agent_id, created_at desc);

create table if not exists public.mcp_life_messages (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.mcp_life_agents (id) on delete cascade,
  role text not null check (role in ('user', 'agent', 'system')),
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.mcp_life_runs (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.mcp_life_agents (id) on delete cascade,
  ok boolean not null default true,
  coins_scanned integer not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.mcp_life_agents enable row level security;
alter table public.mcp_life_relationships enable row level security;
alter table public.mcp_life_knowledge enable row level security;
alter table public.mcp_life_diary enable row level security;
alter table public.mcp_life_reports enable row level security;
alter table public.mcp_life_messages enable row level security;
alter table public.mcp_life_runs enable row level security;

drop policy if exists "mcp_life_agents public alive read" on public.mcp_life_agents;
create policy "mcp_life_agents public alive read"
  on public.mcp_life_agents for select
  using (status = 'alive');

drop policy if exists "mcp_life_reports public read" on public.mcp_life_reports;
create policy "mcp_life_reports public read"
  on public.mcp_life_reports for select
  using (
    exists (select 1 from public.mcp_life_agents a where a.id = agent_id and a.status = 'alive')
  );

drop policy if exists "mcp_life_diary public read" on public.mcp_life_diary;
create policy "mcp_life_diary public read"
  on public.mcp_life_diary for select
  using (
    exists (select 1 from public.mcp_life_agents a where a.id = agent_id and a.status = 'alive')
  );

drop policy if exists "mcp_life_relationships public read" on public.mcp_life_relationships;
create policy "mcp_life_relationships public read"
  on public.mcp_life_relationships for select
  using (true);

grant select on public.mcp_life_agents to anon, authenticated;
grant select on public.mcp_life_reports to anon, authenticated;
grant select on public.mcp_life_diary to anon, authenticated;
grant select on public.mcp_life_relationships to anon, authenticated;
