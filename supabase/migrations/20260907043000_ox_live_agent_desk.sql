-- Real-SOL live agent desk. Service role writes; public may read.
create table if not exists public.ox_live_desk (
  id text primary key default 'main',
  armed boolean not null default false,
  paused boolean not null default false,
  wallet_pubkey text,
  last_agent_id text,
  last_tick_at timestamptz,
  last_error text,
  note text,
  updated_at timestamptz not null default now()
);

alter table public.ox_live_desk enable row level security;

drop policy if exists "ox_live_desk public read" on public.ox_live_desk;
create policy "ox_live_desk public read" on public.ox_live_desk for select using (true);

insert into public.ox_live_desk (id, wallet_pubkey)
values ('main', 'BhdxqXy1C1PMaLBGUABdncqjR68PqB19xPJYcpGcWPJj')
on conflict (id) do nothing;

create table if not exists public.ox_live_positions (
  id uuid primary key default gen_random_uuid(),
  agent_id text not null,
  mint text not null,
  symbol text,
  name text,
  image text,
  sol_in numeric,
  usd_in numeric,
  tokens_raw text,
  entry_price_usd numeric,
  tp_pct numeric not null default 0.10,
  thesis text,
  signature text,
  status text not null default 'open',
  exit_signature text,
  exit_reason text,
  pnl_usd numeric,
  opened_at timestamptz not null default now(),
  closed_at timestamptz
);

alter table public.ox_live_positions enable row level security;

drop policy if exists "ox_live_positions public read" on public.ox_live_positions;
create policy "ox_live_positions public read" on public.ox_live_positions for select using (true);

create table if not exists public.ox_live_fills (
  id uuid primary key default gen_random_uuid(),
  agent_id text,
  mint text,
  symbol text,
  side text not null,
  sol_amount numeric,
  usd_amount numeric,
  pnl_usd numeric,
  pnl_pct numeric,
  signature text,
  thesis text,
  reason text,
  created_at timestamptz not null default now()
);

alter table public.ox_live_fills enable row level security;

drop policy if exists "ox_live_fills public read" on public.ox_live_fills;
create policy "ox_live_fills public read" on public.ox_live_fills for select using (true);

revoke all on public.ox_live_desk from anon, authenticated;
revoke all on public.ox_live_positions from anon, authenticated;
revoke all on public.ox_live_fills from anon, authenticated;
grant select on public.ox_live_desk to anon, authenticated;
grant select on public.ox_live_positions to anon, authenticated;
grant select on public.ox_live_fills to anon, authenticated;

create index if not exists ox_live_positions_open_idx on public.ox_live_positions (status, opened_at desc);
create index if not exists ox_live_fills_created_idx on public.ox_live_fills (created_at desc);
