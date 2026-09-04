-- Official Telegram /verify badges. Service role writes via /api/telegram-orbitx.
-- Only the linked admin wallet in a private DM may insert/update.

create table if not exists public.orbitx_token_verifications (
  mint text primary key,
  symbol text,
  name text,
  verified_by_telegram_user_id text,
  verified_by_wallet text not null,
  verified_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists orbitx_token_verifications_verified_at_idx
  on public.orbitx_token_verifications (verified_at desc);

comment on table public.orbitx_token_verifications is
  'Admin-wallet Telegram /verify badges shown on official bot token scans.';

alter table public.orbitx_token_verifications enable row level security;

revoke all on public.orbitx_token_verifications from anon, authenticated;
