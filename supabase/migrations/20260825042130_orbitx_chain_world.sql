-- OrbitX living on-chain intelligence world.
-- Cache only. Solana RPC / Helius remains the source of truth.
-- Rebuildable from signatures. Never treat these rows as authority.

create table if not exists public.ox_chain_events (
  event_id text primary key,
  signature text not null,
  slot bigint,
  block_time timestamptz,
  event_type text not null,
  status text not null default 'confirmed',
  chain text not null default 'solana',
  program text,
  source text,
  attribution text not null default 'UNKNOWN',
  wallet text,
  counterparty text,
  source_wallet text,
  destination_wallet text,
  token_ca text,
  token_symbol text,
  token_name text,
  token_image text,
  token_decimals int,
  amount numeric,
  sol_amount numeric,
  usd_value numeric,
  market_cap numeric,
  wallet_balance_before numeric,
  wallet_balance_after numeric,
  transaction_fee numeric,
  orbitx_related boolean not null default false,
  orbitx_event_type text,
  kol_related boolean not null default false,
  whale_related boolean not null default false,
  importance int not null default 0,
  confidence text not null default 'observed',
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists ox_chain_events_sig_type_idx
  on public.ox_chain_events (signature, event_type, coalesce(wallet, ''), coalesce(token_ca, ''));
create index if not exists ox_chain_events_time_idx
  on public.ox_chain_events (block_time desc nulls last, created_at desc);
create index if not exists ox_chain_events_type_time_idx
  on public.ox_chain_events (event_type, block_time desc);
create index if not exists ox_chain_events_wallet_idx
  on public.ox_chain_events (wallet, block_time desc);
create index if not exists ox_chain_events_counterparty_idx
  on public.ox_chain_events (counterparty, block_time desc);
create index if not exists ox_chain_events_token_idx
  on public.ox_chain_events (token_ca, block_time desc);
create index if not exists ox_chain_events_orbitx_idx
  on public.ox_chain_events (orbitx_related, block_time desc)
  where orbitx_related = true;
create index if not exists ox_chain_events_usd_idx
  on public.ox_chain_events (usd_value desc nulls last);
create index if not exists ox_chain_events_slot_idx
  on public.ox_chain_events (slot desc);
create index if not exists ox_chain_events_importance_idx
  on public.ox_chain_events (importance desc, block_time desc);

create table if not exists public.ox_chain_wallets (
  address text primary key,
  label text,
  label_kind text not null default 'Wallet',
  first_seen timestamptz,
  last_seen timestamptz,
  tx_count int not null default 0,
  sol_received numeric not null default 0,
  sol_sent numeric not null default 0,
  sol_volume numeric not null default 0,
  estimated_usd_volume numeric not null default 0,
  tokens_traded int not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists ox_chain_wallets_last_seen_idx
  on public.ox_chain_wallets (last_seen desc);

create table if not exists public.ox_chain_tokens (
  mint text primary key,
  symbol text,
  name text,
  image text,
  decimals int,
  description text,
  website text,
  twitter text,
  telegram text,
  creator text,
  launch_platform text,
  price_usd numeric,
  market_cap numeric,
  liquidity_usd numeric,
  volume_24h numeric,
  holders int,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists ox_chain_tokens_symbol_idx
  on public.ox_chain_tokens (lower(symbol));

create table if not exists public.ox_chain_wallet_tokens (
  wallet text not null,
  token_ca text not null,
  token_symbol text,
  balance numeric,
  bought_amount numeric not null default 0,
  sold_amount numeric not null default 0,
  burned_amount numeric not null default 0,
  bought_usd numeric not null default 0,
  sold_usd numeric not null default 0,
  last_event_at timestamptz,
  primary key (wallet, token_ca)
);

create index if not exists ox_chain_wallet_tokens_token_idx
  on public.ox_chain_wallet_tokens (token_ca, bought_usd desc);

create table if not exists public.ox_chain_flows (
  id uuid primary key default gen_random_uuid(),
  from_address text not null,
  to_address text not null,
  token_ca text,
  token_symbol text,
  transfer_count int not null default 0,
  total_amount numeric not null default 0,
  total_sol numeric not null default 0,
  total_usd numeric not null default 0,
  first_seen timestamptz,
  last_seen timestamptz,
  last_signature text
);

create unique index if not exists ox_chain_flows_pair_idx
  on public.ox_chain_flows (from_address, to_address, coalesce(token_ca, ''));
create index if not exists ox_chain_flows_from_idx
  on public.ox_chain_flows (from_address, last_seen desc);
create index if not exists ox_chain_flows_to_idx
  on public.ox_chain_flows (to_address, last_seen desc);

create table if not exists public.ox_chain_tracked (
  address text primary key,
  label text,
  label_kind text not null default 'TRACKED WALLET',
  notes text,
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists public.ox_chain_index_state (
  id text primary key default 'solana-mainnet',
  last_slot bigint,
  chain_slot bigint,
  last_ingest_at timestamptz,
  last_signature text,
  events_indexed bigint not null default 0,
  txs_processed bigint not null default 0,
  txs_failed bigint not null default 0,
  rpc_failures bigint not null default 0,
  metadata_failures bigint not null default 0,
  lag_slots bigint,
  websocket_status text not null default 'polling',
  last_error text,
  updated_at timestamptz not null default now()
);

insert into public.ox_chain_index_state (id)
values ('solana-mainnet')
on conflict (id) do nothing;

create table if not exists public.ox_chain_orbitx_daily (
  day date primary key,
  buys int not null default 0,
  sells int not null default 0,
  burns int not null default 0,
  transfers int not null default 0,
  buy_amount numeric not null default 0,
  sell_amount numeric not null default 0,
  burn_amount numeric not null default 0,
  buy_usd numeric not null default 0,
  sell_usd numeric not null default 0,
  unique_wallets int not null default 0,
  updated_at timestamptz not null default now()
);

-- Seed OrbitX mint as a known token identity (metadata filled by indexer).
insert into public.ox_chain_tokens (mint, symbol, name, decimals)
values ('13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9', 'ORBITX', 'OrbitX', 6)
on conflict (mint) do update
  set symbol = excluded.symbol,
      name = excluded.name;

-- Service-role only. Frontend reads through /api/on-chain.
alter table public.ox_chain_events enable row level security;
alter table public.ox_chain_wallets enable row level security;
alter table public.ox_chain_tokens enable row level security;
alter table public.ox_chain_wallet_tokens enable row level security;
alter table public.ox_chain_flows enable row level security;
alter table public.ox_chain_tracked enable row level security;
alter table public.ox_chain_index_state enable row level security;
alter table public.ox_chain_orbitx_daily enable row level security;

revoke all on public.ox_chain_events from anon, authenticated;
revoke all on public.ox_chain_wallets from anon, authenticated;
revoke all on public.ox_chain_tokens from anon, authenticated;
revoke all on public.ox_chain_wallet_tokens from anon, authenticated;
revoke all on public.ox_chain_flows from anon, authenticated;
revoke all on public.ox_chain_tracked from anon, authenticated;
revoke all on public.ox_chain_index_state from anon, authenticated;
revoke all on public.ox_chain_orbitx_daily from anon, authenticated;

comment on table public.ox_chain_events is
  'Normalized Solana activity cache for /on-chain. Authority is the transaction signature.';
comment on table public.ox_chain_index_state is
  'Indexer cursor and health. Compare last_slot vs chain_slot for lag.';
