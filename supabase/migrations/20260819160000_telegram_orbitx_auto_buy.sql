-- Per-linked-Telegram auto-buy preference (skip chat confirm; Phantom still signs).

alter table public.telegram_orbitx_links
  add column if not exists auto_buy boolean not null default false;

comment on column public.telegram_orbitx_links.auto_buy is
  'When true, official bot trade prepares use autoSignUrl (Phantom pops immediately). User still signs. Isolated to this Telegram user_id.';
