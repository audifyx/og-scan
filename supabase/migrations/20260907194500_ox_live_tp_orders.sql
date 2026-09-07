-- Market-cap take-profit ladder for the live desk wallet. Runs every cron tick
-- regardless of armed/paused so exits never get missed.
create table if not exists public.ox_live_tp_orders (
  id uuid primary key default gen_random_uuid(),
  mint text not null,
  symbol text,
  target_mc_usd numeric not null,
  sell_pct numeric not null check (sell_pct > 0 and sell_pct <= 100),
  status text not null default 'open',          -- open | filled | failed | cancelled
  attempts int not null default 0,
  last_mc_usd numeric,
  last_checked_at timestamptz,
  filled_at timestamptz,
  signature text,
  sol_out numeric,
  usd_out numeric,
  last_error text,
  note text,
  created_at timestamptz not null default now()
);

alter table public.ox_live_tp_orders enable row level security;
drop policy if exists "ox_live_tp_orders public read" on public.ox_live_tp_orders;
create policy "ox_live_tp_orders public read" on public.ox_live_tp_orders for select using (true);
revoke all on public.ox_live_tp_orders from anon, authenticated;
grant select on public.ox_live_tp_orders to anon, authenticated;
create index if not exists ox_live_tp_orders_open_idx on public.ox_live_tp_orders (status, target_mc_usd);

-- Nasduck ladder: 50% at $10M MC, remaining 100% at $15M MC.
insert into public.ox_live_tp_orders (mint, symbol, target_mc_usd, sell_pct, note)
values
  ('7Y7V1a4m2nWK7BMgbka5B4vR1pDvCK7yva3Hnrqkraze', 'Nasduck', 10000000, 50, 'owner: sell half at 10M'),
  ('7Y7V1a4m2nWK7BMgbka5B4vR1pDvCK7yva3Hnrqkraze', 'Nasduck', 15000000, 100, 'owner: clip out fully at 15M');
