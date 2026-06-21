-- Super bot: watchlist + daily digest opt-out + group auto-scan toggle.

alter table public.telegram_bots
  add column if not exists auto_scan boolean not null default true;

alter table public.telegram_alert_chats
  add column if not exists digest_enabled boolean not null default true;

create table if not exists public.telegram_watchlist (
  id          uuid primary key default gen_random_uuid(),
  bot_id      uuid not null references public.telegram_bots(id) on delete cascade,
  chat_id     bigint not null,
  mint        text not null,
  symbol      text,
  last_price  numeric,
  created_at  timestamptz not null default now(),
  unique (bot_id, chat_id, mint)
);
create index if not exists idx_tg_watch_bot on public.telegram_watchlist (bot_id);

alter table public.telegram_watchlist enable row level security;
