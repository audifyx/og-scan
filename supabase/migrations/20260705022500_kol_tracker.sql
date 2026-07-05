-- ============================================================
-- KOL TRACKER — tracker configs, tracked wallets, telegram bots, alert log
-- ============================================================

create table if not exists public.kol_tracker_configs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null default 'custom_list' check (mode in ('all_kols','specific_wallet','custom_list')),
  wallet_address text,
  is_active boolean not null default true,
  alert_on_buy boolean not null default true,
  alert_on_sell boolean not null default true,
  min_sol_amount numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.kol_tracked_wallets (
  id uuid primary key default gen_random_uuid(),
  tracker_id uuid not null references public.kol_tracker_configs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  wallet_address text not null,
  label text,
  is_active boolean not null default true,
  last_activity_at timestamptz,
  created_at timestamptz not null default now(),
  unique (tracker_id, wallet_address)
);

create table if not exists public.telegram_bot_configs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  bot_token text not null,
  bot_name text,
  bot_bio text,
  bot_image_url text,
  bot_username text,
  chat_id text,
  message_thread_id text, -- Telegram forum topic id: alerts stay in one topic instead of the whole group
  linked_tracker_id uuid references public.kol_tracker_configs(id) on delete set null,
  launch_digest_enabled boolean not null default false,
  launch_digest_min_age_hours int not null default 5,
  launch_digest_max_age_hours int not null default 10,
  launch_digest_interval_hours int not null default 6,
  last_digest_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.kol_alert_log (
  id uuid primary key default gen_random_uuid(),
  tracker_id uuid references public.kol_tracker_configs(id) on delete set null,
  user_id uuid,
  wallet_address text not null,
  action text not null check (action in ('buy','sell')),
  token_symbol text,
  token_mint text,
  amount numeric,
  sol_amount numeric,
  tx_signature text,
  status text not null default 'sent',
  sent_at timestamptz not null default now()
);

create index if not exists idx_kol_tracker_configs_user on public.kol_tracker_configs (user_id);
create index if not exists idx_kol_tracked_wallets_user on public.kol_tracked_wallets (user_id);
create index if not exists idx_kol_tracked_wallets_addr on public.kol_tracked_wallets (wallet_address);
create index if not exists idx_telegram_bot_configs_user on public.telegram_bot_configs (user_id);
create index if not exists idx_telegram_bot_configs_tracker on public.telegram_bot_configs (linked_tracker_id);
create index if not exists idx_kol_alert_log_tracker on public.kol_alert_log (tracker_id, sent_at desc);
create index if not exists idx_kol_alert_log_user on public.kol_alert_log (user_id, sent_at desc);

-- ── RLS ──
alter table public.kol_tracker_configs enable row level security;
alter table public.kol_tracked_wallets enable row level security;
alter table public.telegram_bot_configs enable row level security;
alter table public.kol_alert_log enable row level security;

drop policy if exists "kol_tracker_configs_own" on public.kol_tracker_configs;
create policy "kol_tracker_configs_own" on public.kol_tracker_configs
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "kol_tracked_wallets_own" on public.kol_tracked_wallets;
create policy "kol_tracked_wallets_own" on public.kol_tracked_wallets
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "telegram_bot_configs_insert_own" on public.telegram_bot_configs;
create policy "telegram_bot_configs_insert_own" on public.telegram_bot_configs
  for insert with check ((select auth.uid()) = user_id);
drop policy if exists "telegram_bot_configs_update_own" on public.telegram_bot_configs;
create policy "telegram_bot_configs_update_own" on public.telegram_bot_configs
  for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "telegram_bot_configs_delete_own" on public.telegram_bot_configs;
create policy "telegram_bot_configs_delete_own" on public.telegram_bot_configs
  for delete using ((select auth.uid()) = user_id);
drop policy if exists "telegram_bot_configs_select_own" on public.telegram_bot_configs;
create policy "telegram_bot_configs_select_own" on public.telegram_bot_configs
  for select using ((select auth.uid()) = user_id);

-- SECURITY: bot_token is WRITE-ONLY from the client.
-- Column-level grants hide bot_token on SELECT; clients must select explicit columns.
revoke select on public.telegram_bot_configs from anon, authenticated;
grant select (id, user_id, bot_name, bot_bio, bot_image_url, bot_username, chat_id, message_thread_id, linked_tracker_id, launch_digest_enabled, launch_digest_min_age_hours, launch_digest_max_age_hours, launch_digest_interval_hours, last_digest_at, created_at)
  on public.telegram_bot_configs to authenticated;

drop policy if exists "kol_alert_log_select_own" on public.kol_alert_log;
create policy "kol_alert_log_select_own" on public.kol_alert_log
  for select using ((select auth.uid()) = user_id);
drop policy if exists "kol_alert_log_insert_own" on public.kol_alert_log;
create policy "kol_alert_log_insert_own" on public.kol_alert_log
  for insert with check ((select auth.uid()) = user_id);

-- ── Storage bucket for bot profile images ──
insert into storage.buckets (id, name, public)
values ('kol-bot-assets', 'kol-bot-assets', true)
on conflict (id) do nothing;

do $$ begin
  create policy "kol_bot_assets_upload" on storage.objects
    for insert to authenticated with check (bucket_id = 'kol-bot-assets');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "kol_bot_assets_read" on storage.objects
    for select to public using (bucket_id = 'kol-bot-assets');
exception when duplicate_object then null; end $$;

-- ── Launch radar snapshots (service-role only) ──
-- Hourly cron snapshots newly created pools; the launch digest then reports
-- "survivors" that are 5-10h old with live stats.
create table if not exists public.kol_launch_radar (
  pool_address text primary key,
  token_mint text,
  token_symbol text,
  token_name text,
  dex text,
  first_seen_at timestamptz not null default now(),
  pool_created_at timestamptz,
  base_info jsonb
);
create index if not exists idx_kol_launch_radar_created on public.kol_launch_radar (pool_created_at desc);
alter table public.kol_launch_radar enable row level security;
-- no client policies: service-role access only
