-- OrbitX launchpad rebuild (spec §12–13).
-- Index tables + identity columns. Chain remains source of truth for mints/fees.

alter table public.profiles
  add column if not exists wallet_pubkey text,
  add column if not exists wallet_linked_at timestamptz;

create unique index if not exists profiles_wallet_pubkey_uidx
  on public.profiles (wallet_pubkey)
  where wallet_pubkey is not null;

alter table public.orbitx_tokens
  add column if not exists quote_mint text,
  add column if not exists quote_symbol text,
  add column if not exists pad_mode text,
  add column if not exists holder_rewards boolean default false,
  add column if not exists bagwork boolean default false,
  add column if not exists graduation_dest text;

create index if not exists orbitx_tokens_quote_mint_idx on public.orbitx_tokens (quote_mint);
create index if not exists orbitx_tokens_pad_mode_idx on public.orbitx_tokens (pad_mode);

-- Dedicated pad index (does not replace orbitx_tokens).
create table if not exists public.orbitx_pad_launches (
  mint text primary key,
  creator_wallet text not null,
  creator_x text,
  launch_type text not null,
  quote_mint text not null,
  quote_symbol text,
  graduation_dest text not null default 'pumpswap',
  name text,
  symbol text,
  uri text,
  holder_rewards boolean not null default false,
  bagwork boolean not null default false,
  created_sig text,
  created_at timestamptz not null default now(),
  graduated_at timestamptz,
  stale boolean not null default false
);

create index if not exists orbitx_pad_launches_created_at_idx
  on public.orbitx_pad_launches (created_at desc);
create index if not exists orbitx_pad_launches_quote_idx
  on public.orbitx_pad_launches (quote_mint);
create index if not exists orbitx_pad_launches_type_idx
  on public.orbitx_pad_launches (launch_type);

alter table public.orbitx_pad_launches enable row level security;

drop policy if exists "public read pad launches" on public.orbitx_pad_launches;
create policy "public read pad launches"
  on public.orbitx_pad_launches for select using (true);

drop policy if exists "creator insert pad launches" on public.orbitx_pad_launches;
create policy "creator insert pad launches"
  on public.orbitx_pad_launches for insert
  with check (
    creator_wallet = (
      select p.wallet_pubkey from public.profiles p
      where p.user_id = auth.uid()
      limit 1
    )
  );

create table if not exists public.orbitx_extra_pools (
  id uuid primary key default gen_random_uuid(),
  base_mint text not null,
  quote_mint text not null,
  venue text not null,
  pool_pubkey text not null unique,
  created_by text,
  created_at timestamptz not null default now()
);

alter table public.orbitx_extra_pools enable row level security;

drop policy if exists "public read extra pools" on public.orbitx_extra_pools;
create policy "public read extra pools"
  on public.orbitx_extra_pools for select using (true);

drop policy if exists "auth insert extra pools" on public.orbitx_extra_pools;
create policy "auth insert extra pools"
  on public.orbitx_extra_pools for insert
  with check (auth.uid() is not null);

create table if not exists public.orbitx_bagwork_bounties (
  id uuid primary key default gen_random_uuid(),
  mint text not null,
  title text not null,
  reward_amount numeric not null,
  reward_mint text not null,
  status text not null default 'open',
  proof_url text,
  worker_wallet text,
  worker_x text,
  escrow_pda text,
  payout_sig text,
  created_by_wallet text,
  created_at timestamptz not null default now()
);

create index if not exists orbitx_bagwork_bounties_mint_idx
  on public.orbitx_bagwork_bounties (mint, created_at desc);

alter table public.orbitx_bagwork_bounties enable row level security;

drop policy if exists "public read bagwork bounties" on public.orbitx_bagwork_bounties;
create policy "public read bagwork bounties"
  on public.orbitx_bagwork_bounties for select using (true);

drop policy if exists "auth insert bagwork bounties" on public.orbitx_bagwork_bounties;
create policy "auth insert bagwork bounties"
  on public.orbitx_bagwork_bounties for insert
  with check (auth.uid() is not null);

drop policy if exists "auth update bagwork bounties" on public.orbitx_bagwork_bounties;
create policy "auth update bagwork bounties"
  on public.orbitx_bagwork_bounties for update
  using (auth.uid() is not null);

create table if not exists public.orbitx_rewards_pools (
  mint text primary key,
  quote_mint text not null,
  mode text not null,
  accrued_quote numeric not null default 0,
  last_indexed_slot bigint,
  vault_pubkey text
);

create table if not exists public.orbitx_rewards_claims (
  id uuid primary key default gen_random_uuid(),
  mint text not null,
  owner text not null,
  amount numeric not null,
  quote_mint text not null,
  sig text unique not null,
  claimed_at timestamptz not null default now()
);

alter table public.orbitx_rewards_pools enable row level security;
alter table public.orbitx_rewards_claims enable row level security;

drop policy if exists "public read rewards pools" on public.orbitx_rewards_pools;
create policy "public read rewards pools"
  on public.orbitx_rewards_pools for select using (true);

drop policy if exists "public read rewards claims" on public.orbitx_rewards_claims;
create policy "public read rewards claims"
  on public.orbitx_rewards_claims for select using (true);

drop policy if exists "auth insert rewards claims" on public.orbitx_rewards_claims;
create policy "auth insert rewards claims"
  on public.orbitx_rewards_claims for insert
  with check (auth.uid() is not null);
