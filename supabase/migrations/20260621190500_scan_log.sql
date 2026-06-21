-- Every token scan, logged with the score + price at that moment.
-- Powers: Grim's track record (Phase 2) and caller/group leaderboards (Phase 5).
create table if not exists public.scan_log (
  id               uuid primary key default gen_random_uuid(),
  mint             text not null,
  symbol           text,
  name             text,
  og_score         integer,          -- 0-100 composite score at scan time
  momentum         integer,          -- 0-100 momentum at scan time
  price_usd        double precision,
  market_cap       double precision,
  liquidity_usd    double precision,
  holder_count     integer,
  source           text default 'web',   -- web | telegram | discord | group | api
  bot_id           uuid,             -- telegram_bots.id when scanned via a BYO bot
  chat_id          text,             -- group/chat id when applicable
  scanned_by       text,             -- telegram user id / caller handle when known
  -- track-record fields (updated by the price updater cron)
  last_price_usd   double precision,
  last_market_cap  double precision,
  peak_market_cap  double precision,
  peak_multiple    double precision, -- peak_market_cap / market_cap
  last_checked_at  timestamptz,
  created_at       timestamptz not null default now()
);
create index if not exists idx_scan_log_mint on public.scan_log (mint);
create index if not exists idx_scan_log_created on public.scan_log (created_at desc);
create index if not exists idx_scan_log_score on public.scan_log (og_score);
create index if not exists idx_scan_log_bot on public.scan_log (bot_id);
alter table public.scan_log enable row level security;
drop policy if exists "scan_log public read" on public.scan_log;
create policy "scan_log public read" on public.scan_log for select using (true);
-- writes happen via service role (edge functions) only.
