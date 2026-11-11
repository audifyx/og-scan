-- Telegram bot user logging (2026-11-10): every user that uses @Orbitxofficialbot
-- is recorded so the operator can see bot stats (unique users, messages,
-- scans, recent users, daily activity) at /api/ogdex/tg-stats.
--
-- Privacy: only what Telegram already sends with every update is stored
-- (user id, username, first/last name, chat id/type, the kind of action,
-- and the token address for a scan). Arbitrary message text is NEVER stored.
-- Both tables have RLS enabled with no permissive policies, and the two
-- functions are executable by service_role only — the stats page is
-- unlinked and noindex, same as the /stats dashboard. All writes go
-- through the service-role key, which bypasses RLS.
-- Idempotent: safe to re-apply.

create table if not exists public.telegram_bot_users (
  user_id bigint primary key,
  username text,
  first_name text,
  last_name text,
  chat_id bigint,
  chat_type text,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  last_command text,
  message_count int not null default 0
);

create table if not exists public.telegram_bot_events (
  id bigint generated always as identity primary key,
  user_id bigint not null,
  username text,
  chat_id bigint,
  chat_type text,
  kind text not null, -- start | help | scan | text
  detail text,        -- the token address for kind=scan, else null
  created_at timestamptz not null default now()
);

create index if not exists telegram_bot_events_user_created_idx
  on public.telegram_bot_events (user_id, created_at desc);
create index if not exists telegram_bot_events_created_idx
  on public.telegram_bot_events (created_at desc);
create index if not exists telegram_bot_users_last_seen_idx
  on public.telegram_bot_users (last_seen desc);

alter table public.telegram_bot_users enable row level security;
alter table public.telegram_bot_events enable row level security;
-- No policies: service_role (used by the webhook + stats route) bypasses RLS;
-- anon / authenticated get nothing.

-- One call per bot update: upsert the user (bump message_count, refresh
-- last_seen / last_command, keep old names when the new value is null)
-- and append the event row. Atomic.
create or replace function public.telegram_bot_log(
  p_user_id bigint,
  p_username text,
  p_first_name text,
  p_last_name text,
  p_chat_id bigint,
  p_chat_type text,
  p_kind text,
  p_detail text
) returns void
language plpgsql
as $$
begin
  insert into public.telegram_bot_users
    (user_id, username, first_name, last_name, chat_id, chat_type,
     first_seen, last_seen, last_command, message_count)
  values
    (p_user_id, p_username, p_first_name, p_last_name, p_chat_id, p_chat_type,
     now(), now(), p_kind, 1)
  on conflict (user_id) do update set
    username = coalesce(excluded.username, public.telegram_bot_users.username),
    first_name = coalesce(excluded.first_name, public.telegram_bot_users.first_name),
    last_name = coalesce(excluded.last_name, public.telegram_bot_users.last_name),
    chat_id = excluded.chat_id,
    chat_type = excluded.chat_type,
    last_seen = now(),
    last_command = excluded.last_command,
    message_count = public.telegram_bot_users.message_count + 1;

  insert into public.telegram_bot_events
    (user_id, username, chat_id, chat_type, kind, detail)
  values
    (p_user_id, p_username, p_chat_id, p_chat_type, p_kind, p_detail);
end;
$$;

-- Aggregates for the stats page. "Today" is America/New_York, like the
-- /stats dashboard. Returns one JSON object.
create or replace function public.telegram_bot_stats()
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'total_users', (select count(*) from public.telegram_bot_users),
    'new_today', (select count(*) from public.telegram_bot_users
                  where (first_seen at time zone 'America/New_York')::date
                      = (now() at time zone 'America/New_York')::date),
    'active_today', (select count(*) from public.telegram_bot_users
                  where (last_seen at time zone 'America/New_York')::date
                      = (now() at time zone 'America/New_York')::date),
    'total_messages', (select count(*) from public.telegram_bot_events),
    'total_scans', (select count(*) from public.telegram_bot_events where kind = 'scan'),
    'messages_today', (select count(*) from public.telegram_bot_events
                  where (created_at at time zone 'America/New_York')::date
                      = (now() at time zone 'America/New_York')::date),
    'scans_today', (select count(*) from public.telegram_bot_events
                  where kind = 'scan'
                    and (created_at at time zone 'America/New_York')::date
                      = (now() at time zone 'America/New_York')::date),
    'daily', (select coalesce(jsonb_agg(d order by d.day), '[]'::jsonb) from (
       select (created_at at time zone 'America/New_York')::date as day,
              count(*) as messages,
              count(*) filter (where kind = 'scan') as scans,
              count(distinct user_id) as users
       from public.telegram_bot_events
       where created_at >= now() - interval '14 days'
       group by day
    ) d),
    'recent_users', (select coalesce(jsonb_agg(u order by u.last_seen desc), '[]'::jsonb) from (
       select user_id, username, first_name, last_name, chat_type,
              first_seen, last_seen, last_command, message_count
       from public.telegram_bot_users
       order by last_seen desc limit 50
    ) u),
    'recent_events', (select coalesce(jsonb_agg(e order by e.created_at desc), '[]'::jsonb) from (
       select id, user_id, username, kind, detail, created_at
       from public.telegram_bot_events
       order by created_at desc limit 50
    ) e)
  );
$$;

-- Service-role only: the webhook and the stats route call these with the
-- service key. Nobody else can execute them.
revoke execute on function public.telegram_bot_log(bigint, text, text, text, bigint, text, text, text) from public;
grant execute on function public.telegram_bot_log(bigint, text, text, text, bigint, text, text, text) to service_role;
revoke execute on function public.telegram_bot_stats() from public;
grant execute on function public.telegram_bot_stats() to service_role;
