-- OrbitX launchpad advanced systems (spec v2).
-- Markets, attests, epochs, flags. Chain remains truth; this is index + identity.

alter table public.orbitx_pad_launches
  add column if not exists launch_style text,
  add column if not exists rewards_track text,
  add column if not exists delay_open_unix bigint,
  add column if not exists anti_snipe_blocks integer not null default 0;

create table if not exists public.orbitx_pad_markets (
  mint text primary key,
  question text not null,
  deadline_unix bigint not null,
  resolver text not null,
  feed_id text,
  threshold text,
  amm text not null default 'parimutuel',
  quote_mint text not null,
  status text not null default 'open',
  yes_pool numeric not null default 0,
  no_pool numeric not null default 0,
  outcome text,
  evidence_uri text,
  resolved_slot bigint,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists orbitx_pad_markets_status_idx
  on public.orbitx_pad_markets (status, deadline_unix);

alter table public.orbitx_pad_markets enable row level security;

drop policy if exists "public read pad markets" on public.orbitx_pad_markets;
create policy "public read pad markets"
  on public.orbitx_pad_markets for select using (true);

drop policy if exists "auth upsert pad markets" on public.orbitx_pad_markets;
create policy "auth upsert pad markets"
  on public.orbitx_pad_markets for insert
  with check (auth.uid() is not null);

drop policy if exists "auth update pad markets" on public.orbitx_pad_markets;
create policy "auth update pad markets"
  on public.orbitx_pad_markets for update
  using (auth.uid() is not null);

create table if not exists public.orbitx_pad_bets (
  id uuid primary key default gen_random_uuid(),
  mint text not null,
  owner text not null,
  side text not null,
  amount numeric not null,
  sig text unique,
  created_at timestamptz not null default now()
);

create index if not exists orbitx_pad_bets_mint_idx on public.orbitx_pad_bets (mint, created_at desc);

alter table public.orbitx_pad_bets enable row level security;

drop policy if exists "public read pad bets" on public.orbitx_pad_bets;
create policy "public read pad bets"
  on public.orbitx_pad_bets for select using (true);

drop policy if exists "auth insert pad bets" on public.orbitx_pad_bets;
create policy "auth insert pad bets"
  on public.orbitx_pad_bets for insert
  with check (auth.uid() is not null);

create table if not exists public.orbitx_pad_attests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  wallet text,
  country text not null,
  attest_version text not null,
  attested_at timestamptz not null default now()
);

alter table public.orbitx_pad_attests enable row level security;

drop policy if exists "own attests" on public.orbitx_pad_attests;
create policy "own attests"
  on public.orbitx_pad_attests for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create table if not exists public.orbitx_pad_epochs (
  id uuid primary key default gen_random_uuid(),
  mint text not null,
  epoch_end timestamptz not null,
  slot bigint,
  supply numeric,
  pot numeric,
  snapshot jsonb,
  created_at timestamptz not null default now(),
  unique (mint, epoch_end)
);

alter table public.orbitx_pad_epochs enable row level security;

drop policy if exists "public read pad epochs" on public.orbitx_pad_epochs;
create policy "public read pad epochs"
  on public.orbitx_pad_epochs for select using (true);

create table if not exists public.orbitx_pad_flags (
  key text primary key,
  value boolean not null,
  updated_at timestamptz not null default now()
);

alter table public.orbitx_pad_flags enable row level security;

drop policy if exists "public read pad flags" on public.orbitx_pad_flags;
create policy "public read pad flags"
  on public.orbitx_pad_flags for select using (true);

insert into public.orbitx_pad_flags (key, value) values
  ('predict_markets', true),
  ('stocks', true),
  ('bagwork', true),
  ('track_b_vault', false),
  ('kill_create', false),
  ('kill_trade', false)
on conflict (key) do nothing;
