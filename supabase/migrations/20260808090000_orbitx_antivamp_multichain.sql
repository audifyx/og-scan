-- OrbitX anti-vamp hardening. Intentionally unapplied by the agent.
-- Adds metadata without changing existing launch behavior until reviewed.

create table if not exists public.orbitx_identity_registry (
  id uuid primary key default gen_random_uuid(),
  asset_type text not null check (asset_type in ('token','nft_collection','nft_item')),
  chain_id text not null default 'solana',
  name text not null,
  ticker text,
  normalized_name text generated always as (orbitx_normalize(name)) stored,
  normalized_ticker text generated always as (orbitx_normalize(coalesce(ticker, ''))) stored,
  source text not null default 'orbitx',
  decision text not null default 'clear' check (decision in ('clear','soft','hard','denylist')),
  fee_route text not null default 'creator' check (fee_route in ('creator','orbitx_buyback','og')),
  royalty_route text not null default 'creator' check (royalty_route in ('creator','orbitx_platform','restricted')),
  reference_address text,
  created_at timestamptz not null default now()
);

create index if not exists orbitx_identity_registry_name_idx on public.orbitx_identity_registry (asset_type, chain_id, normalized_name);
create index if not exists orbitx_identity_registry_ticker_idx on public.orbitx_identity_registry (asset_type, chain_id, normalized_ticker);

alter table public.orbitx_tokens add column if not exists chain_id text not null default 'solana';
alter table public.orbitx_tokens add column if not exists asset_type text not null default 'token';
alter table public.orbitx_tokens add column if not exists originality_decision text not null default 'clear';
alter table public.orbitx_tokens add column if not exists originality_checked_at timestamptz;

alter table public.orbitx_nft_collections add column if not exists chain_id text not null default 'solana';
alter table public.orbitx_nft_collections add column if not exists originality_decision text not null default 'clear';
alter table public.orbitx_nft_collections add column if not exists royalty_route text not null default 'creator';
alter table public.orbitx_nfts add column if not exists chain_id text not null default 'solana';
alter table public.orbitx_nfts add column if not exists originality_decision text not null default 'clear';
alter table public.orbitx_nfts add column if not exists royalty_route text not null default 'creator';

create or replace function public.orbitx_vamp_check_multichain(
  p_name text, p_ticker text default null, p_chain_ids text[] default null, p_asset_type text default 'token'
) returns table(name text, ticker text, chain_id text, source text, decision text) language sql stable security definer set search_path = public as $$
  select r.name, r.ticker, r.chain_id, r.source, r.decision
  from public.orbitx_identity_registry r
  where r.asset_type = p_asset_type
    and (p_chain_ids is null or r.chain_id = any(p_chain_ids))
    and (r.normalized_name = orbitx_normalize(p_name) or (p_ticker is not null and r.normalized_ticker = orbitx_normalize(p_ticker)))
  order by r.created_at asc;
$$;

comment on table public.orbitx_identity_registry is 'First-party cross-chain originality backstop; populate through reviewed registration flows.';
