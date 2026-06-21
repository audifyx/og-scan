-- Channels where a BYO Discord bot should auto-post alerts (via /subscribe).
create table if not exists public.discord_bot_channels (
  id                uuid primary key default gen_random_uuid(),
  bot_id            uuid references public.discord_bots(id) on delete cascade,
  application_id    text not null,
  channel_id        text not null,
  guild_id          text,
  alerts_migrations boolean not null default true,
  created_at        timestamptz not null default now()
);
create unique index if not exists idx_dbc_app_channel on public.discord_bot_channels (application_id, channel_id);
create index if not exists idx_dbc_bot on public.discord_bot_channels (bot_id);
alter table public.discord_bot_channels enable row level security;
-- Service-role only (edge functions manage rows); no public policy.
