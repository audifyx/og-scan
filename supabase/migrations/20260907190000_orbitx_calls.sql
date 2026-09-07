-- Token calls made through OrbitX MCP / Telegram / web tools. Powers /calls.
create table if not exists public.orbitx_calls (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'mcp',          -- mcp | telegram | web | agent
  tool text not null,                          -- orbitx_get_token, orbitx_full_report, ...
  chain text not null default 'solana',
  mint text not null,
  symbol text,
  name text,
  price_usd numeric,
  mc_usd numeric,
  liquidity_usd numeric,
  verdict text,
  caller text,                                 -- wallet / telegram user / agent id (never secrets)
  chat_id text,
  meta jsonb,
  created_at timestamptz not null default now()
);

alter table public.orbitx_calls enable row level security;

drop policy if exists "orbitx_calls public read" on public.orbitx_calls;
create policy "orbitx_calls public read" on public.orbitx_calls for select using (true);

revoke all on public.orbitx_calls from anon, authenticated;
grant select on public.orbitx_calls to anon, authenticated;

create index if not exists orbitx_calls_created_idx on public.orbitx_calls (created_at desc);
create index if not exists orbitx_calls_mint_idx on public.orbitx_calls (mint, created_at desc);

-- Aggregated leaderboard: most-called tokens with first-call price for multiplier math.
create or replace view public.orbitx_calls_top as
select
  mint,
  chain,
  max(symbol) filter (where symbol is not null) as symbol,
  max(name) filter (where name is not null) as name,
  count(*)::int as calls,
  count(*) filter (where created_at > now() - interval '24 hours')::int as calls_24h,
  min(created_at) as first_called_at,
  max(created_at) as last_called_at,
  (array_agg(price_usd order by created_at asc) filter (where price_usd is not null))[1] as first_price_usd,
  (array_agg(price_usd order by created_at desc) filter (where price_usd is not null))[1] as last_price_usd,
  (array_agg(mc_usd order by created_at desc) filter (where mc_usd is not null))[1] as last_mc_usd
from public.orbitx_calls
group by mint, chain;

grant select on public.orbitx_calls_top to anon, authenticated;
