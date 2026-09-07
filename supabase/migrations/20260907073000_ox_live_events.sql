-- Live desk event tape: ticks, skips, buys, sells. Public read.
create table if not exists public.ox_live_events (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  agent_id text,
  mint text,
  symbol text,
  side text,
  usd_amount numeric,
  sol_amount numeric,
  pnl_usd numeric,
  thesis text,
  reason text,
  signature text,
  meta jsonb,
  created_at timestamptz not null default now()
);

alter table public.ox_live_events enable row level security;

drop policy if exists "ox_live_events public read" on public.ox_live_events;
create policy "ox_live_events public read" on public.ox_live_events for select using (true);

revoke all on public.ox_live_events from anon, authenticated;
grant select on public.ox_live_events to anon, authenticated;

create index if not exists ox_live_events_created_idx on public.ox_live_events (created_at desc);
