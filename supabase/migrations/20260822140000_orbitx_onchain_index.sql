-- OrbitX on-chain event INDEX (not source of truth).
-- Rebuildable by scanning Solana signatures / Memo program logs.
-- Do not treat this table as authority — verify tx_signature on RPC.

create table if not exists public.ox_onchain_events (
  id uuid primary key default gen_random_uuid(),
  tx_signature text not null unique,
  wallet text,
  kind text not null,
  content_hash text not null,
  memo text not null,
  fee_lamports bigint,
  slot bigint,
  block_time timestamptz,
  ref_id text,
  verified boolean not null default false,
  meets_cost_target boolean,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ox_onchain_events_wallet_idx
  on public.ox_onchain_events (wallet, created_at desc);
create index if not exists ox_onchain_events_kind_idx
  on public.ox_onchain_events (kind, created_at desc);
create index if not exists ox_onchain_events_hash_idx
  on public.ox_onchain_events (content_hash);

alter table public.ox_onchain_events enable row level security;
revoke all on public.ox_onchain_events from anon, authenticated;

comment on table public.ox_onchain_events is
  'Cached OrbitX memo attestations. Source of truth is the Solana transaction.';
