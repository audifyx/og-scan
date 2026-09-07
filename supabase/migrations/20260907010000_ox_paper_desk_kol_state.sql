create table if not exists public.ox_paper_agents (
  id text primary key,
  name text not null,
  style text not null,
  color text,
  sol_start numeric not null default 10000,
  updated_at timestamptz not null default now()
);

alter table public.ox_paper_agents enable row level security;

drop policy if exists "ox_paper_agents public read" on public.ox_paper_agents;
create policy "ox_paper_agents public read" on public.ox_paper_agents for select using (true);

create table if not exists public.ox_paper_fills (
  id uuid primary key default gen_random_uuid(),
  agent_id text not null references public.ox_paper_agents(id) on delete cascade,
  hour_bucket bigint not null,
  mint text,
  symbol text,
  side text not null default 'buy',
  sol_amount numeric,
  pnl_sol numeric,
  move_pct numeric,
  thesis text,
  created_at timestamptz not null default now(),
  unique (agent_id, hour_bucket)
);

alter table public.ox_paper_fills enable row level security;

drop policy if exists "ox_paper_fills public read" on public.ox_paper_fills;
create policy "ox_paper_fills public read" on public.ox_paper_fills for select using (true);

create table if not exists public.ox_chain_kol_state (
  address text primary key,
  name text,
  twitter text,
  status text,
  hits integer not null default 0,
  last_type text,
  last_token text,
  last_mint text,
  last_usd numeric,
  last_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.ox_chain_kol_state enable row level security;

drop policy if exists "ox_chain_kol_state public read" on public.ox_chain_kol_state;
create policy "ox_chain_kol_state public read" on public.ox_chain_kol_state for select using (true);

revoke all on public.ox_paper_agents from anon, authenticated;
revoke all on public.ox_paper_fills from anon, authenticated;
revoke all on public.ox_chain_kol_state from anon, authenticated;
grant select on public.ox_paper_agents to anon, authenticated;
grant select on public.ox_paper_fills to anon, authenticated;
grant select on public.ox_chain_kol_state to anon, authenticated;

create index if not exists ox_paper_fills_hour_idx on public.ox_paper_fills (hour_bucket desc);
create index if not exists ox_chain_kol_state_updated_idx on public.ox_chain_kol_state (updated_at desc);
