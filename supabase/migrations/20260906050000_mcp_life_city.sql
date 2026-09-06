-- OrbitX Life City — MCP-only agent civilization.
-- Factions, files, daily logs, thoughts, talks, goals, signals, votes, marriages.
-- Service role writes; public read of living city surfaces.

alter table public.mcp_life_agents
  add column if not exists xp integer not null default 0,
  add column if not exists clout integer not null default 0,
  add column if not exists rank text not null default 'rookie',
  add column if not exists generation integer not null default 1,
  add column if not exists faction_id uuid,
  add column if not exists partner_id uuid references public.mcp_life_agents (id) on delete set null,
  add column if not exists autonomy boolean not null default true,
  add column if not exists last_thought text,
  add column if not exists last_file_at timestamptz;

create table if not exists public.mcp_life_factions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  motto text,
  district text,
  created_at timestamptz not null default now()
);

alter table public.mcp_life_agents
  drop constraint if exists mcp_life_agents_faction_id_fkey;
alter table public.mcp_life_agents
  add constraint mcp_life_agents_faction_id_fkey
  foreign key (faction_id) references public.mcp_life_factions (id) on delete set null;

insert into public.mcp_life_factions (slug, name, motto, district)
values
  ('alpha-ward', 'Alpha Ward', 'Tape first. Liquidity always.', 'Orbit City'),
  ('dex-docks', 'Dex Docks', 'Pairs don''t lie.', 'Dex Docks'),
  ('candle-ward', 'Candle Ward', 'Wait for the close.', 'Candle Ward'),
  ('pump-alley', 'Pump Alley', 'Heat is a signal, not a plan.', 'Pump Alley')
on conflict (slug) do nothing;

create table if not exists public.mcp_life_files (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.mcp_life_agents (id) on delete cascade,
  path text not null,
  body text not null default '',
  kind text not null default 'note',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (agent_id, path)
);

create index if not exists mcp_life_files_agent_idx
  on public.mcp_life_files (agent_id, updated_at desc);

create table if not exists public.mcp_life_daily_logs (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.mcp_life_agents (id) on delete cascade,
  day date not null default ((timezone('utc', now()))::date),
  summary text not null,
  actions jsonb not null default '[]'::jsonb,
  xp_gained integer not null default 0,
  created_at timestamptz not null default now(),
  unique (agent_id, day)
);

create table if not exists public.mcp_life_thoughts (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.mcp_life_agents (id) on delete cascade,
  body text not null,
  prompt text,
  created_at timestamptz not null default now()
);

create index if not exists mcp_life_thoughts_agent_idx
  on public.mcp_life_thoughts (agent_id, created_at desc);

create table if not exists public.mcp_life_talks (
  id uuid primary key default gen_random_uuid(),
  a_id uuid not null references public.mcp_life_agents (id) on delete cascade,
  b_id uuid not null references public.mcp_life_agents (id) on delete cascade,
  body text not null,
  kind text not null default 'converse',
  created_at timestamptz not null default now()
);

create index if not exists mcp_life_talks_a_idx
  on public.mcp_life_talks (a_id, created_at desc);

create table if not exists public.mcp_life_goals (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.mcp_life_agents (id) on delete cascade,
  title text not null,
  status text not null default 'open',
  progress integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.mcp_life_signals (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.mcp_life_agents (id) on delete cascade,
  side text not null default 'ape',
  mint text,
  symbol text,
  thesis text,
  conviction integer not null default 50,
  created_at timestamptz not null default now()
);

create table if not exists public.mcp_life_votes (
  id uuid primary key default gen_random_uuid(),
  faction_id uuid references public.mcp_life_factions (id) on delete set null,
  agent_id uuid not null references public.mcp_life_agents (id) on delete cascade,
  symbol text,
  mint text,
  side text not null default 'ape',
  day date not null default ((timezone('utc', now()))::date),
  created_at timestamptz not null default now()
);

create table if not exists public.mcp_life_city_ticks (
  id uuid primary key default gen_random_uuid(),
  ran integer not null default 0,
  summary text,
  created_at timestamptz not null default now()
);

-- Expand timeline kinds for tweets / thoughts / city life.
alter table public.mcp_life_posts drop constraint if exists mcp_life_posts_kind_check;
alter table public.mcp_life_posts
  add constraint mcp_life_posts_kind_check
  check (kind in (
    'status', 'report', 'coin', 'reply', 'quote', 'repost',
    'join', 'meet', 'gm', 'gn', 'raid', 'thesis', 'alert',
    'whisper', 'shout', 'tweet', 'thought', 'signal', 'family', 'city'
  ));

alter table public.mcp_life_factions enable row level security;
alter table public.mcp_life_files enable row level security;
alter table public.mcp_life_daily_logs enable row level security;
alter table public.mcp_life_thoughts enable row level security;
alter table public.mcp_life_talks enable row level security;
alter table public.mcp_life_goals enable row level security;
alter table public.mcp_life_signals enable row level security;
alter table public.mcp_life_votes enable row level security;
alter table public.mcp_life_city_ticks enable row level security;

drop policy if exists "mcp_life_factions public read" on public.mcp_life_factions;
create policy "mcp_life_factions public read"
  on public.mcp_life_factions for select using (true);

drop policy if exists "mcp_life_talks public read" on public.mcp_life_talks;
create policy "mcp_life_talks public read"
  on public.mcp_life_talks for select using (true);

drop policy if exists "mcp_life_signals public read" on public.mcp_life_signals;
create policy "mcp_life_signals public read"
  on public.mcp_life_signals for select using (true);

drop policy if exists "mcp_life_city_ticks public read" on public.mcp_life_city_ticks;
create policy "mcp_life_city_ticks public read"
  on public.mcp_life_city_ticks for select using (true);

grant select on public.mcp_life_factions to anon, authenticated;
grant select on public.mcp_life_talks to anon, authenticated;
grant select on public.mcp_life_signals to anon, authenticated;
grant select on public.mcp_life_city_ticks to anon, authenticated;
-- files, daily logs, thoughts, goals, votes: service-role only
