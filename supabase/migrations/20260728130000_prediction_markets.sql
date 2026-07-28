-- OrbitX Prediction Markets (Polymarket-style AMM, virtual USDC ledger)
-- Prefix: pred_*

create extension if not exists pgcrypto;

create or replace function public.pred_set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

create table if not exists public.pred_markets (
  id uuid primary key default gen_random_uuid(),
  slug text unique,
  question text not null,
  description text not null default '',
  category text not null default 'crypto'
    check (category in ('crypto', 'meme', 'macro', 'politics', 'sports', 'orbitx', 'other')),
  image_url text,
  status text not null default 'open'
    check (status in ('open', 'closed', 'resolved')),
  resolution text check (resolution is null or resolution in ('yes', 'no', 'void')),
  resolves_at timestamptz,
  yes_pool numeric(18, 4) not null default 1000 check (yes_pool > 0),
  no_pool numeric(18, 4) not null default 1000 check (no_pool > 0),
  volume_usdc numeric(18, 2) not null default 0,
  traders_count integer not null default 0,
  featured boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pred_markets_status_idx on public.pred_markets (status, featured desc, volume_usdc desc);
create index if not exists pred_markets_category_idx on public.pred_markets (category, status);

create table if not exists public.pred_portfolios (
  user_id uuid primary key references auth.users(id) on delete cascade,
  usdc_balance numeric(18, 2) not null default 1000 check (usdc_balance >= 0),
  initial_balance numeric(18, 2) not null default 1000,
  total_trades integer not null default 0,
  realized_pnl numeric(18, 2) not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.pred_positions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  market_id uuid not null references public.pred_markets(id) on delete cascade,
  side text not null check (side in ('yes', 'no')),
  shares numeric(18, 6) not null default 0 check (shares >= 0),
  avg_price numeric(8, 6) not null default 0,
  cost_basis numeric(18, 2) not null default 0,
  updated_at timestamptz not null default now(),
  unique (user_id, market_id, side)
);

create index if not exists pred_positions_user_idx on public.pred_positions (user_id);
create index if not exists pred_positions_market_idx on public.pred_positions (market_id);

create table if not exists public.pred_trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  market_id uuid not null references public.pred_markets(id) on delete cascade,
  side text not null check (side in ('yes', 'no')),
  action text not null check (action in ('buy', 'sell')),
  shares numeric(18, 6) not null,
  price numeric(8, 6) not null,
  amount_usdc numeric(18, 2) not null,
  created_at timestamptz not null default now()
);

create index if not exists pred_trades_user_idx on public.pred_trades (user_id, created_at desc);
create index if not exists pred_trades_market_idx on public.pred_trades (market_id, created_at desc);

drop trigger if exists pred_markets_updated on public.pred_markets;
create trigger pred_markets_updated before update on public.pred_markets
  for each row execute function public.pred_set_updated_at();

drop trigger if exists pred_portfolios_updated on public.pred_portfolios;
create trigger pred_portfolios_updated before update on public.pred_portfolios
  for each row execute function public.pred_set_updated_at();

-- Yes price 0–1 from pool ratio (CPMM implied)
create or replace function public.pred_yes_price(p_yes numeric, p_no numeric)
returns numeric language sql immutable as $$
  select case when (p_yes + p_no) <= 0 then 0.5 else p_no / (p_yes + p_no) end;
$$;

create or replace function public.pred_get_or_create_portfolio(p_user uuid)
returns public.pred_portfolios
language plpgsql security definer set search_path = public as $$
declare r public.pred_portfolios;
begin
  select * into r from public.pred_portfolios where user_id = p_user;
  if not found then
    insert into public.pred_portfolios (user_id) values (p_user) returning * into r;
  end if;
  return r;
end; $$;

revoke all on function public.pred_get_or_create_portfolio(uuid) from public;
grant execute on function public.pred_get_or_create_portfolio(uuid) to authenticated;

-- Execute buy/sell against constant-product pools (virtual USDC)
create or replace function public.pred_trade(
  p_market_id uuid,
  p_side text,
  p_action text,
  p_amount numeric
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_m public.pred_markets;
  v_pf public.pred_portfolios;
  v_pos public.pred_positions;
  v_k numeric;
  v_price numeric;
  v_shares numeric;
  v_new_yes numeric;
  v_new_no numeric;
  v_fee numeric := 0.02;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if p_side not in ('yes', 'no') then raise exception 'invalid side'; end if;
  if p_action not in ('buy', 'sell') then raise exception 'invalid action'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'invalid amount'; end if;

  select * into v_m from public.pred_markets where id = p_market_id for update;
  if not found then raise exception 'market not found'; end if;
  if v_m.status <> 'open' then raise exception 'market not open'; end if;

  v_pf := public.pred_get_or_create_portfolio(v_uid);
  v_k := v_m.yes_pool * v_m.no_pool;

  if p_action = 'buy' then
    if v_pf.usdc_balance < p_amount then raise exception 'insufficient balance'; end if;

    if p_side = 'yes' then
      v_new_no := v_m.no_pool + p_amount * (1 - v_fee);
      v_new_yes := v_k / v_new_no;
      v_shares := v_m.yes_pool - v_new_yes;
      if v_shares <= 0 then raise exception 'insufficient liquidity'; end if;
      v_m.yes_pool := v_new_yes;
      v_m.no_pool := v_new_no;
      v_price := public.pred_yes_price(v_m.yes_pool, v_m.no_pool);
    else
      v_new_yes := v_m.yes_pool + p_amount * (1 - v_fee);
      v_new_no := v_k / v_new_yes;
      v_shares := v_m.no_pool - v_new_no;
      if v_shares <= 0 then raise exception 'insufficient liquidity'; end if;
      v_m.yes_pool := v_new_yes;
      v_m.no_pool := v_new_no;
      v_price := 1 - public.pred_yes_price(v_m.yes_pool, v_m.no_pool);
    end if;

    update public.pred_portfolios set usdc_balance = usdc_balance - p_amount, total_trades = total_trades + 1 where user_id = v_uid;

    insert into public.pred_positions (user_id, market_id, side, shares, avg_price, cost_basis)
    values (v_uid, p_market_id, p_side, v_shares, v_price, p_amount)
    on conflict (user_id, market_id, side) do update set
      shares = pred_positions.shares + excluded.shares,
      cost_basis = pred_positions.cost_basis + excluded.cost_basis,
      avg_price = (pred_positions.cost_basis + excluded.cost_basis) / nullif(pred_positions.shares + excluded.shares, 0),
      updated_at = now();

  else -- sell
    select * into v_pos from public.pred_positions where user_id = v_uid and market_id = p_market_id and side = p_side for update;
    if not found or v_pos.shares < p_amount then raise exception 'insufficient shares'; end if;

    if p_side = 'yes' then
      v_new_yes := v_m.yes_pool + p_amount;
      v_new_no := v_k / v_new_yes;
      v_shares := p_amount;
      v_price := public.pred_yes_price(v_m.yes_pool, v_m.no_pool);
      v_m.yes_pool := v_new_yes;
      v_m.no_pool := v_new_no;
    else
      v_new_no := v_m.no_pool + p_amount;
      v_new_yes := v_k / v_new_no;
      v_shares := p_amount;
      v_price := 1 - public.pred_yes_price(v_m.yes_pool, v_m.no_pool);
      v_m.yes_pool := v_new_yes;
      v_m.no_pool := v_new_no;
    end if;

    update public.pred_portfolios set usdc_balance = usdc_balance + (p_amount * v_price), total_trades = total_trades + 1 where user_id = v_uid;
    update public.pred_positions set shares = shares - p_amount,
      cost_basis = greatest(0, cost_basis - (avg_price * p_amount)),
      updated_at = now()
    where user_id = v_uid and market_id = p_market_id and side = p_side;
  end if;

  v_m.volume_usdc := v_m.volume_usdc + case when p_action = 'buy' then p_amount else p_amount * v_price end;
  update public.pred_markets set yes_pool = v_m.yes_pool, no_pool = v_m.no_pool, volume_usdc = v_m.volume_usdc, updated_at = now()
  where id = p_market_id;

  insert into public.pred_trades (user_id, market_id, side, action, shares, price, amount_usdc)
  values (v_uid, p_market_id, p_side, p_action, v_shares, v_price, case when p_action = 'buy' then p_amount else p_amount * v_price end);

  return jsonb_build_object(
    'ok', true,
    'shares', v_shares,
    'price', v_price,
    'yes_price', public.pred_yes_price(v_m.yes_pool, v_m.no_pool),
    'yes_pool', v_m.yes_pool,
    'no_pool', v_m.no_pool
  );
end; $$;

revoke all on function public.pred_trade(uuid, text, text, numeric) from public;
grant execute on function public.pred_trade(uuid, text, text, numeric) to authenticated;

-- RLS
alter table public.pred_markets enable row level security;
alter table public.pred_portfolios enable row level security;
alter table public.pred_positions enable row level security;
alter table public.pred_trades enable row level security;

drop policy if exists pred_markets_read on public.pred_markets;
create policy pred_markets_read on public.pred_markets for select using (true);

drop policy if exists pred_portfolios_own on public.pred_portfolios;
create policy pred_portfolios_own on public.pred_portfolios for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists pred_positions_own on public.pred_positions;
create policy pred_positions_own on public.pred_positions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists pred_trades_own on public.pred_trades;
create policy pred_trades_own on public.pred_trades for select using (auth.uid() = user_id);

drop policy if exists pred_trades_insert_own on public.pred_trades;
create policy pred_trades_insert_own on public.pred_trades for insert with check (auth.uid() = user_id);

-- Seed markets
insert into public.pred_markets (slug, question, description, category, featured, resolves_at, yes_pool, no_pool, volume_usdc)
values
  ('sol-200-week', 'Will SOL close above $200 this week?', 'Resolves YES if SOL/USD is ≥ $200.00 on CoinGecko at Friday 23:59 UTC.', 'crypto', true, now() + interval '7 days', 850, 1150, 84200),
  ('pump-10m-graduate', 'Next Pump.fun graduate hits $10M mcap?', 'First pump.fun token to migrate this week that reaches $10M FDV.', 'meme', true, now() + interval '14 days', 620, 1380, 31500),
  ('btc-dominance-58', 'BTC dominance above 58% by month end?', 'CoinGecko BTC dominance ≥ 58% on last day of month.', 'macro', false, now() + interval '30 days', 980, 1020, 120400),
  ('fed-cut-q3', 'Fed cuts rates before Q3?', 'Resolves YES if FOMC announces a rate cut before Oct 1.', 'macro', false, now() + interval '90 days', 720, 1280, 52800),
  ('orbitx-mobile-beta', 'OrbitX mobile app in public beta by Q4?', 'Official OrbitX mobile beta listed on orbitx.world.', 'orbitx', true, now() + interval '120 days', 1100, 900, 18400),
  ('eth-5k-2026', 'ETH above $5,000 in 2026?', 'ETH/USD ≥ $5000 on any day in 2026 (CoinGecko).', 'crypto', false, now() + interval '180 days', 540, 1460, 96700)
on conflict (slug) do nothing;
