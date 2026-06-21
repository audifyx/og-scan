-- Super Bot Phase 1: per-bot identity (name + persona) and user-defined commands.

-- 1) Identity columns on the user's bot.
alter table public.telegram_bots
  add column if not exists bot_name text,
  add column if not exists persona  text;

-- 2) User-defined custom commands. response_type:
--    'text' -> static reply (supports {arg} and {user} placeholders)
--    'ai'   -> `content` is a system directive; the user's args become the prompt
create table if not exists public.telegram_custom_commands (
  id            uuid primary key default gen_random_uuid(),
  bot_id        uuid not null references public.telegram_bots(id) on delete cascade,
  user_id       uuid,
  command       text not null,
  description   text,
  response_type text not null default 'text' check (response_type in ('text','ai')),
  content       text not null default '',
  enabled       boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (bot_id, command)
);

create index if not exists idx_tg_custom_cmds_bot on public.telegram_custom_commands (bot_id);

-- 3) RLS: owners manage their own bot's commands; service role (edge fns) bypasses.
--    NOTE: qualify telegram_custom_commands.bot_id so it doesn't bind to
--    telegram_bots.bot_id (the bigint Telegram id) inside the subquery.
alter table public.telegram_custom_commands enable row level security;

drop policy if exists "own bot commands - select" on public.telegram_custom_commands;
create policy "own bot commands - select" on public.telegram_custom_commands
  for select using (
    exists (
      select 1 from public.telegram_bots b
      where b.id = telegram_custom_commands.bot_id and b.user_id = auth.uid()
    )
  );

drop policy if exists "own bot commands - write" on public.telegram_custom_commands;
create policy "own bot commands - write" on public.telegram_custom_commands
  for all using (
    exists (
      select 1 from public.telegram_bots b
      where b.id = telegram_custom_commands.bot_id and b.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.telegram_bots b
      where b.id = telegram_custom_commands.bot_id and b.user_id = auth.uid()
    )
  );
