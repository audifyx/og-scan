-- ============================================================
-- OG Scan Intelligence — Social + Trend layer (spec D, 8, 9)
-- - ogi_share_event: scan share attribution (X/Telegram/card)
-- - ogi_trend_snapshot: time-series for velocity/lifecycle
-- - ogi_telegram_subscriber: alert routing
-- - ogi_token_edge already exists (clone graph)
-- ============================================================

create extension if not exists pgcrypto;

-- ── Share attribution events ────────────────────────────────
create table if not exists public.ogi_share_event (
  id           uuid primary key default gen_random_uuid(),
  mint         text not null,
  channel      text not null check (channel in ('x','telegram','card','link')),
  handle       text,                  -- attribution handle
  shared_by    uuid,                  -- auth.users id (nullable)
  scan_id      uuid,                  -- optional link to ogi_scan_log
  created_at   timestamptz not null default now()
);
create index if not exists ogi_share_event_mint_idx on public.ogi_share_event (mint, created_at desc);
create index if not exists ogi_share_event_handle_idx on public.ogi_share_event (handle);

-- ── Trend snapshots (time-series) ───────────────────────────
create table if not exists public.ogi_trend_snapshot (
  id            uuid primary key default gen_random_uuid(),
  mint          text not null,
  price_usd     numeric,
  volume_24h    numeric,
  liquidity_usd numeric,
  velocity      numeric,             -- 0-100 computed velocity
  captured_at   timestamptz not null default now()
);
create index if not exists ogi_trend_snapshot_mint_idx on public.ogi_trend_snapshot (mint, captured_at desc);

-- ── Telegram subscribers / alert routing ────────────────────
create table if not exists public.ogi_telegram_subscriber (
  id          uuid primary key default gen_random_uuid(),
  chat_id     text not null unique,
  handle      text,
  alerts      jsonb not null default '{"velocity_spike":true,"og_identified":true,"abnormal_activity":true,"daily_report":true}'::jsonb,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ── RLS ─────────────────────────────────────────────────────
alter table public.ogi_share_event        enable row level security;
alter table public.ogi_trend_snapshot     enable row level security;
alter table public.ogi_telegram_subscriber enable row level security;

drop policy if exists ogi_share_read   on public.ogi_share_event;
drop policy if exists ogi_share_write  on public.ogi_share_event;
create policy ogi_share_read  on public.ogi_share_event for select using (true);
create policy ogi_share_write on public.ogi_share_event for insert with check (true);

drop policy if exists ogi_trend_read   on public.ogi_trend_snapshot;
drop policy if exists ogi_trend_write  on public.ogi_trend_snapshot;
create policy ogi_trend_read  on public.ogi_trend_snapshot for select using (true);
create policy ogi_trend_write on public.ogi_trend_snapshot for insert with check (true);

-- telegram subscribers are not publicly readable (contain chat ids)
drop policy if exists ogi_tg_self on public.ogi_telegram_subscriber;
create policy ogi_tg_self on public.ogi_telegram_subscriber for all using (false) with check (true);

-- ── Attribution leaderboard view (who finds OGs) ────────────
create or replace view public.ogi_scanner_leaderboard as
select
  coalesce(scanner_handle, 'anon')         as handle,
  count(*)                                  as total_scans,
  count(*) filter (where tier='OG_TOKEN')   as og_finds,
  count(distinct mint)                       as unique_tokens,
  max(created_at)                            as last_active
from public.ogi_scan_log
group by coalesce(scanner_handle, 'anon')
order by og_finds desc, total_scans desc
limit 100;

grant select on public.ogi_scanner_leaderboard to anon, authenticated;
