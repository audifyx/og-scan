-- OG DEX listings + boosts (MCP submit + owner desk pending queues)
-- Service-role APIs use these tables; RLS on for anon, open for service role.

create table if not exists public.ogdex_listings (
  id uuid primary key default gen_random_uuid(),
  contract_address text not null,
  chain text not null default 'solana',
  tier text not null default 'standard',
  status text not null default 'pending',
  project_name text,
  symbol text,
  logo_url text,
  banner_url text,
  description text,
  links jsonb default '{}'::jsonb,
  contact text,
  payment_tx text,
  metadata jsonb default '{}'::jsonb,
  featured boolean default false,
  featured_rank integer default 0,
  views integer default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  approved_at timestamptz
);

create index if not exists ogdex_listings_status_idx on public.ogdex_listings (status, created_at desc);
create index if not exists ogdex_listings_ca_idx on public.ogdex_listings (contract_address);

create table if not exists public.ogdex_boosts (
  id uuid primary key default gen_random_uuid(),
  mint text not null,
  tier text not null,
  payment_tx text,
  payer_wallet text,
  symbol text,
  name text,
  icon text,
  chain text not null default 'solana',
  status text not null default 'pending',
  expires_at timestamptz,
  usd_paid numeric default 0,
  featured_rank integer default 999,
  created_at timestamptz not null default now()
);

create index if not exists ogdex_boosts_status_idx on public.ogdex_boosts (status, created_at desc);
create index if not exists ogdex_boosts_mint_idx on public.ogdex_boosts (mint);

alter table public.ogdex_listings enable row level security;
alter table public.ogdex_boosts enable row level security;

-- Public can read approved/active; writes go through service-role API.
drop policy if exists ogdex_listings_public_read on public.ogdex_listings;
create policy ogdex_listings_public_read on public.ogdex_listings
  for select to anon, authenticated
  using (status = 'approved');

drop policy if exists ogdex_boosts_public_read on public.ogdex_boosts;
create policy ogdex_boosts_public_read on public.ogdex_boosts
  for select to anon, authenticated
  using (status = 'active' and (expires_at is null or expires_at > now()));
