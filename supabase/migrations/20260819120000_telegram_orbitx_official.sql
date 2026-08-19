-- Official first-party OrbitX Telegram bot (@theorbitxmcpbot).
-- Separate from telegram_bots (user-owned BotFather tokens / MCP dashboard).
-- Service role writes via /api/telegram-orbitx. Authenticated users may only
-- read their own link rows from the /telegram web companion.

create table if not exists public.telegram_orbitx_links (
  telegram_user_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  telegram_username text,
  wallet_address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists telegram_orbitx_links_user_id_uidx
  on public.telegram_orbitx_links (user_id);

create index if not exists telegram_orbitx_links_wallet_idx
  on public.telegram_orbitx_links (wallet_address);

create table if not exists public.telegram_orbitx_login_codes (
  code text primary key,
  telegram_user_id text not null,
  telegram_username text,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists telegram_orbitx_login_codes_tg_idx
  on public.telegram_orbitx_login_codes (telegram_user_id);

create index if not exists telegram_orbitx_login_codes_exp_idx
  on public.telegram_orbitx_login_codes (expires_at);

comment on table public.telegram_orbitx_links is
  'Official @theorbitxmcpbot DM links: Telegram user ↔ OrbitX auth user.';
comment on table public.telegram_orbitx_login_codes is
  'Short-lived /login codes consumed on /telegram?code=. Service role only.';

alter table public.telegram_orbitx_links enable row level security;
alter table public.telegram_orbitx_login_codes enable row level security;

drop policy if exists telegram_orbitx_links_select_own on public.telegram_orbitx_links;
create policy telegram_orbitx_links_select_own
  on public.telegram_orbitx_links
  for select
  to authenticated
  using (auth.uid() = user_id);

-- No insert/update/delete policies: writes go through the service-role API.

revoke all on public.telegram_orbitx_links from anon, authenticated;
grant select on public.telegram_orbitx_links to authenticated;

revoke all on public.telegram_orbitx_login_codes from anon, authenticated;
