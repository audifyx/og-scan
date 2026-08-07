-- OG DEX Admin expansion — new tables
-- Run in Supabase SQL editor

-- Pro wallet manual grants
create table if not exists ogdex_pro_wallets (
  id          uuid primary key default gen_random_uuid(),
  address     text unique not null,
  note        text,
  granted_at  timestamptz default now(),
  granted_by  text default 'admin'
);

-- Banned wallets
create table if not exists ogdex_banned_wallets (
  id          uuid primary key default gen_random_uuid(),
  address     text unique not null,
  reason      text,
  banned_at   timestamptz default now(),
  banned_by   text default 'admin'
);

-- KOL community nominations (from /api/ogdex/kols/nominate)
create table if not exists ogdex_kol_nominations (
  id            uuid primary key default gen_random_uuid(),
  address       text unique not null,
  label         text,
  status        text default 'pending',  -- pending | approved | rejected
  votes         integer default 1,
  submitted_by  text,
  submitted_at  timestamptz default now(),
  reviewed_at   timestamptz
);

-- Site-wide config / feature flags (key-value store)
create table if not exists ogdex_config (
  key         text primary key,
  value       text not null,
  updated_at  timestamptz default now()
);

-- Seed defaults
insert into ogdex_config (key, value) values
  ('pro_gate_enabled',  'true'),
  ('pro_threshold',     '10000'),
  ('screener_enabled',  'true'),
  ('mcp_enabled',       'true'),
  ('widget_enabled',    'true'),
  ('maintenance_mode',  'false'),
  ('og_token',          '"13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9"')
on conflict (key) do nothing;

-- Listings + boosts (MCP + desk pending queues)
create table if not exists ogdex_listings (
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

create table if not exists ogdex_boosts (
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

-- Enable RLS (admin reads via service role key in _lib.js)
alter table ogdex_pro_wallets    enable row level security;
alter table ogdex_banned_wallets enable row level security;
alter table ogdex_kol_nominations enable row level security;
alter table ogdex_config          enable row level security;
alter table ogdex_listings        enable row level security;
alter table ogdex_boosts          enable row level security;

-- Pin official $ORBITX as featured listing (skip if already present)
insert into ogdex_listings (
  contract_address, chain, project_name, symbol, logo_url, description,
  status, featured, featured_rank, tier, approved_at
)
select
  '13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9',
  'solana',
  'ORBITX',
  'ORBITX',
  '/og-icon.svg',
  'Official OrbitX platform token',
  'approved',
  true,
  9999,
  'express',
  now()
where not exists (
  select 1 from ogdex_listings
  where contract_address = '13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9'
);

-- Ensure existing official row stays featured at top rank
update ogdex_listings
set featured = true,
    featured_rank = greatest(coalesce(featured_rank, 0), 9999),
    status = 'approved',
    project_name = coalesce(nullif(project_name, ''), 'ORBITX'),
    symbol = coalesce(nullif(symbol, ''), 'ORBITX'),
    updated_at = now()
where contract_address = '13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9';
