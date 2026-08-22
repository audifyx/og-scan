-- Per-Telegram-user launch / NFT wizard state for @theorbitxmcpbot.
-- Service role writes via /api/telegram-orbitx. No public access.

create table if not exists public.telegram_orbitx_action_sessions (
  telegram_user_id text primary key,
  chat_id text,
  kind text not null default 'token',
  step text not null default 'ticker',
  confirm_nonce text,
  in_flight boolean not null default false,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 minutes')
);

create index if not exists telegram_orbitx_action_sessions_expires_idx
  on public.telegram_orbitx_action_sessions (expires_at);

comment on table public.telegram_orbitx_action_sessions is
  'In-progress token/NFT launch wizard for official Telegram bot. Keyed by telegram user id.';

alter table public.telegram_orbitx_action_sessions enable row level security;

revoke all on public.telegram_orbitx_action_sessions from anon, authenticated;
