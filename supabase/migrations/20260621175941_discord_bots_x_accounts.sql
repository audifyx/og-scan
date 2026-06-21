-- BYO Discord bot + X auto-poster: per-user credentials.
-- RLS own-row policies: a user manages only their own row. Edge functions
-- (discord-bot-connect, x-poster, discord-interactions) use the service role
-- and mask secrets in their responses (safe()).

create table if not exists public.discord_bots (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null,
  application_id  text not null,
  public_key      text not null,
  bot_token       text not null,
  bot_username    text,
  ai_enabled      boolean not null default true,
  enabled         boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create unique index if not exists idx_discord_bots_user on public.discord_bots (user_id);
create unique index if not exists idx_discord_bots_app on public.discord_bots (application_id);
alter table public.discord_bots enable row level security;
drop policy if exists "own discord bot" on public.discord_bots;
create policy "own discord bot" on public.discord_bots for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.x_accounts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null,
  api_key         text not null,
  api_secret      text not null,
  access_token    text not null,
  access_secret   text not null,
  handle          text,
  auto_migrations boolean not null default false,
  auto_reports    boolean not null default false,
  enabled         boolean not null default true,
  created_at      timestamptz not null default now()
);
create unique index if not exists idx_x_accounts_user on public.x_accounts (user_id);
alter table public.x_accounts enable row level security;
drop policy if exists "own x account" on public.x_accounts;
create policy "own x account" on public.x_accounts for all using (user_id = auth.uid()) with check (user_id = auth.uid());
