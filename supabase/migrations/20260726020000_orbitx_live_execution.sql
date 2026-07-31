-- OrbitX live execution ledger and non-bypassable risk controls.
-- All mutations are made by the authenticated Edge Function using service_role;
-- browser clients receive select-only access to their own records.

create table if not exists public.orbitx_trading_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  wallet_address text not null check (char_length(wallet_address) between 32 and 44),
  auto_trading boolean not null default false,
  emergency_stop boolean not null default true,
  max_trade_usd numeric(12, 2) not null default 2.00 check (max_trade_usd > 0 and max_trade_usd <= 2.00),
  daily_loss_limit_usd numeric(12, 2) not null default 5.00 check (daily_loss_limit_usd > 0 and daily_loss_limit_usd <= 5.00),
  max_open_positions integer not null default 2 check (max_open_positions between 1 and 2),
  max_slippage_bps integer not null default 300 check (max_slippage_bps between 1 and 300),
  updated_at timestamptz not null default now()
);

create table if not exists public.orbitx_execution_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key uuid not null,
  venue text not null check (venue in ('jupiter', 'pumpfun')),
  side text not null check (side in ('buy', 'sell')),
  input_mint text not null,
  output_mint text not null,
  input_amount numeric not null check (input_amount > 0),
  output_amount numeric,
  requested_value_usd numeric,
  realized_pnl_usd numeric not null default 0,
  slippage_bps integer not null check (slippage_bps between 1 and 300),
  signature text unique,
  status text not null default 'pending' check (status in ('pending', 'submitted', 'confirmed', 'failed', 'blocked')),
  failure_reason text,
  quote jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

create index if not exists orbitx_execution_ledger_user_created_idx
  on public.orbitx_execution_ledger (user_id, created_at desc);
create index if not exists orbitx_execution_ledger_open_idx
  on public.orbitx_execution_ledger (user_id, output_mint, status)
  where status in ('pending', 'submitted', 'confirmed');

create table if not exists public.orbitx_positions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mint text not null,
  quantity numeric not null default 0 check (quantity >= 0),
  cost_basis_usd numeric not null default 0 check (cost_basis_usd >= 0),
  status text not null default 'open' check (status in ('open', 'closed')),
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  unique (user_id, mint)
);

create table if not exists public.orbitx_creator_fee_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mint text not null,
  signature text unique,
  amount_sol numeric,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'failed')),
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.orbitx_trading_settings enable row level security;
alter table public.orbitx_execution_ledger enable row level security;
alter table public.orbitx_positions enable row level security;
alter table public.orbitx_creator_fee_claims enable row level security;

drop policy if exists orbitx_trading_settings_owner_read on public.orbitx_trading_settings;
create policy orbitx_trading_settings_owner_read on public.orbitx_trading_settings
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists orbitx_execution_ledger_owner_read on public.orbitx_execution_ledger;
create policy orbitx_execution_ledger_owner_read on public.orbitx_execution_ledger
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists orbitx_positions_owner_read on public.orbitx_positions;
create policy orbitx_positions_owner_read on public.orbitx_positions
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists orbitx_creator_fee_claims_owner_read on public.orbitx_creator_fee_claims;
create policy orbitx_creator_fee_claims_owner_read on public.orbitx_creator_fee_claims
  for select to authenticated using (user_id = (select auth.uid()));

-- Direct browser writes are deliberately not allowed. The protected execution
-- function validates every state transition with service_role.
