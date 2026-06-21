-- Conversational persistent watches against the pump.fun migration firehose.
create table if not exists public.migration_watches (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid,
  nl_request    text,
  conditions    jsonb not null default '[]'::jsonb,
  channel_type  text not null default 'discord' check (channel_type in ('discord','webhook','telegram')),
  webhook_url   text,
  chat_id       text,
  bot_id        uuid,
  min_age_min   integer not null default 0,
  enabled       boolean not null default true,
  last_fired_at timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists idx_mwatch_enabled on public.migration_watches (enabled);
alter table public.migration_watches enable row level security;
drop policy if exists "own migration watches" on public.migration_watches;
create policy "own migration watches" on public.migration_watches for all using (user_id = auth.uid()) with check (user_id = auth.uid());
