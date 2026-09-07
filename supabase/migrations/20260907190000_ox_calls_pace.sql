-- Telegram call pace: 1 per 2 min, 5 per 25 min. Stored as recent post timestamps.
alter table public.ox_calls_desk add column if not exists post_ats jsonb not null default '[]'::jsonb;
