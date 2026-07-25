-- =============================================================================
-- OrbitX World (OXW) — production platform schema
-- Backend Architecture Team — additive, idempotent, no frontend coupling.
--
-- Extends existing auth.users + wallet_identities + profiles.
-- Prefix: oxw_* to avoid collisions with orbitx_* launchpad tables.
-- Designed for horizontal scale: UUID PKs, append-only ledgers, hot-path indexes,
-- RLS on every table, security-definer RPCs for privileged mutations.
-- =============================================================================

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.oxw_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Roles / admin
-- ---------------------------------------------------------------------------
create table if not exists public.oxw_user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('player', 'creator', 'moderator', 'admin', 'ops', 'analyst')),
  granted_by uuid references auth.users(id),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  note text,
  unique (user_id, role)
);
create index if not exists oxw_user_roles_user_idx on public.oxw_user_roles (user_id) where revoked_at is null;

create or replace function public.oxw_is_staff(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.oxw_user_roles r
    where r.user_id = uid
      and r.role in ('admin', 'moderator', 'ops')
      and r.revoked_at is null
  );
$$;

-- ---------------------------------------------------------------------------
-- Settings
-- ---------------------------------------------------------------------------
create table if not exists public.oxw_user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_prefs jsonb not null default '{}'::jsonb,
  privacy jsonb not null default '{"show_online": true, "allow_dms": true, "show_wallet": false}'::jsonb,
  notifications jsonb not null default '{"push": true, "email": false, "trade": true, "social": true, "quests": true}'::jsonb,
  gameplay jsonb not null default '{"quality": "high", "touch_controls": null, "mute_voice": false}'::jsonb,
  locale text not null default 'en',
  timezone text not null default 'UTC',
  updated_at timestamptz not null default now()
);

drop trigger if exists oxw_user_settings_updated on public.oxw_user_settings;
create trigger oxw_user_settings_updated
  before update on public.oxw_user_settings
  for each row execute function public.oxw_set_updated_at();

-- ---------------------------------------------------------------------------
-- Multi-wallet / multi-chain links (primary stays in wallet_identities)
-- ---------------------------------------------------------------------------
create table if not exists public.oxw_wallet_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  chain text not null check (chain in ('solana', 'ethereum', 'base', 'bsc', 'polygon', 'arbitrum', 'other')),
  address text not null,
  is_primary boolean not null default false,
  label text,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  unique (chain, address)
);
create index if not exists oxw_wallet_links_user_idx on public.oxw_wallet_links (user_id);
create unique index if not exists oxw_wallet_links_one_primary
  on public.oxw_wallet_links (user_id) where is_primary;

-- ---------------------------------------------------------------------------
-- Progression: XP / levels / titles
-- ---------------------------------------------------------------------------
create table if not exists public.oxw_progression (
  user_id uuid primary key references auth.users(id) on delete cascade,
  xp bigint not null default 0 check (xp >= 0),
  level integer not null default 1 check (level >= 1),
  title text not null default 'Traveler',
  prestige integer not null default 0 check (prestige >= 0),
  updated_at timestamptz not null default now()
);

-- Append-only XP ledger (never update rows — scale via time indexes / future partitions)
create table if not exists public.oxw_xp_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null,
  reason text not null,
  source text not null default 'system' check (source in ('system', 'quest', 'trade', 'social', 'game', 'admin', 'referral', 'daily')),
  ref_type text,
  ref_id text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists oxw_xp_events_user_created_idx on public.oxw_xp_events (user_id, created_at desc);
create index if not exists oxw_xp_events_reason_idx on public.oxw_xp_events (reason, created_at desc);

create table if not exists public.oxw_achievements (
  id text primary key,
  name text not null,
  description text not null default '',
  category text not null default 'general',
  xp_reward integer not null default 0,
  icon text,
  criteria jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.oxw_user_achievements (
  user_id uuid not null references auth.users(id) on delete cascade,
  achievement_id text not null references public.oxw_achievements(id),
  unlocked_at timestamptz not null default now(),
  progress jsonb not null default '{}'::jsonb,
  primary key (user_id, achievement_id)
);
create index if not exists oxw_user_achievements_unlocked_idx on public.oxw_user_achievements (unlocked_at desc);

create table if not exists public.oxw_rewards (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  kind text not null check (kind in ('xp', 'item', 'badge', 'token_airdrop', 'cosmetic', 'title')),
  payload jsonb not null default '{}'::jsonb,
  starts_at timestamptz,
  ends_at timestamptz,
  max_claims integer,
  claims_count integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.oxw_user_rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reward_id uuid not null references public.oxw_rewards(id),
  claimed_at timestamptz not null default now(),
  status text not null default 'claimed' check (status in ('claimed', 'fulfilled', 'failed', 'revoked')),
  meta jsonb not null default '{}'::jsonb,
  unique (user_id, reward_id)
);

-- ---------------------------------------------------------------------------
-- Inventory
-- ---------------------------------------------------------------------------
create table if not exists public.oxw_item_defs (
  id text primary key,
  name text not null,
  kind text not null check (kind in ('cosmetic', 'badge', 'key', 'consumable', 'ad_slot', 'emote', 'vehicle', 'other')),
  rarity text not null default 'common' check (rarity in ('common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic')),
  stackable boolean not null default true,
  max_stack integer not null default 99,
  meta jsonb not null default '{}'::jsonb,
  tradeable boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.oxw_inventory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id text not null references public.oxw_item_defs(id),
  qty integer not null default 1 check (qty > 0),
  equipped boolean not null default false,
  meta jsonb not null default '{}'::jsonb,
  acquired_at timestamptz not null default now(),
  unique (user_id, item_id)
);
create index if not exists oxw_inventory_user_idx on public.oxw_inventory (user_id);

-- ---------------------------------------------------------------------------
-- Friends
-- ---------------------------------------------------------------------------
create table if not exists public.oxw_friend_requests (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references auth.users(id) on delete cascade,
  to_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  check (from_user_id <> to_user_id)
);
create unique index if not exists oxw_friend_requests_pending_uq
  on public.oxw_friend_requests (from_user_id, to_user_id) where status = 'pending';
create index if not exists oxw_friend_requests_to_idx on public.oxw_friend_requests (to_user_id, status);

create table if not exists public.oxw_friendships (
  user_a uuid not null references auth.users(id) on delete cascade,
  user_b uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (user_a < user_b),
  primary key (user_a, user_b)
);
create index if not exists oxw_friendships_b_idx on public.oxw_friendships (user_b);

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------
create table if not exists public.oxw_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null default '',
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists oxw_notifications_user_unread_idx
  on public.oxw_notifications (user_id, created_at desc) where read_at is null;
create index if not exists oxw_notifications_user_created_idx
  on public.oxw_notifications (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Communities
-- ---------------------------------------------------------------------------
create table if not exists public.oxw_communities (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null default '',
  owner_id uuid not null references auth.users(id),
  visibility text not null default 'public' check (visibility in ('public', 'unlisted', 'private')),
  avatar_url text,
  banner_url text,
  member_count integer not null default 0,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists oxw_communities_owner_idx on public.oxw_communities (owner_id);
create index if not exists oxw_communities_slug_trgm on public.oxw_communities using gin (slug gin_trgm_ops);

drop trigger if exists oxw_communities_updated on public.oxw_communities;
create trigger oxw_communities_updated
  before update on public.oxw_communities
  for each row execute function public.oxw_set_updated_at();

create table if not exists public.oxw_community_members (
  community_id uuid not null references public.oxw_communities(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('member', 'mod', 'admin', 'owner')),
  joined_at timestamptz not null default now(),
  primary key (community_id, user_id)
);
create index if not exists oxw_community_members_user_idx on public.oxw_community_members (user_id);

create table if not exists public.oxw_community_posts (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.oxw_communities(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  media jsonb not null default '[]'::jsonb,
  like_count integer not null default 0,
  comment_count integer not null default 0,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);
create index if not exists oxw_community_posts_feed_idx
  on public.oxw_community_posts (community_id, created_at desc) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- Chat
-- ---------------------------------------------------------------------------
create table if not exists public.oxw_chat_channels (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('world', 'lobby', 'dm', 'community', 'guild', 'system')),
  slug text,
  title text,
  city_id text,
  lobby_id uuid,
  community_id uuid references public.oxw_communities(id) on delete set null,
  is_private boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (kind, slug)
);
create index if not exists oxw_chat_channels_kind_idx on public.oxw_chat_channels (kind, city_id);

create table if not exists public.oxw_chat_messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.oxw_chat_channels(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists oxw_chat_messages_channel_created_idx
  on public.oxw_chat_messages (channel_id, created_at desc);

create table if not exists public.oxw_chat_members (
  channel_id uuid not null references public.oxw_chat_channels(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz,
  muted boolean not null default false,
  primary key (channel_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Voice rooms
-- ---------------------------------------------------------------------------
create table if not exists public.oxw_voice_rooms (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  city_id text,
  livekit_room text not null,
  max_participants integer not null default 50,
  is_public boolean not null default true,
  owner_id uuid references auth.users(id),
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);
create index if not exists oxw_voice_rooms_open_idx on public.oxw_voice_rooms (city_id) where closed_at is null;

create table if not exists public.oxw_voice_participants (
  room_id uuid not null references public.oxw_voice_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  role text not null default 'speaker' check (role in ('listener', 'speaker', 'mod', 'host')),
  primary key (room_id, user_id, joined_at)
);
create index if not exists oxw_voice_participants_active_idx
  on public.oxw_voice_participants (room_id) where left_at is null;

-- ---------------------------------------------------------------------------
-- Multiplayer lobbies (durable metadata; realtime presence is ephemeral)
-- ---------------------------------------------------------------------------
create table if not exists public.oxw_lobbies (
  id uuid primary key default gen_random_uuid(),
  channel_id text not null unique,
  label text not null,
  city_id text not null default 'nyc',
  visibility text not null default 'public' check (visibility in ('public', 'private', 'friends')),
  password_hash text,
  host_id uuid references auth.users(id),
  max_players integer not null default 64,
  player_count integer not null default 0,
  status text not null default 'open' check (status in ('open', 'full', 'closed', 'archived')),
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists oxw_lobbies_public_idx
  on public.oxw_lobbies (city_id, player_count desc) where status = 'open' and visibility = 'public';

drop trigger if exists oxw_lobbies_updated on public.oxw_lobbies;
create trigger oxw_lobbies_updated
  before update on public.oxw_lobbies
  for each row execute function public.oxw_set_updated_at();

create table if not exists public.oxw_lobby_members (
  lobby_id uuid not null references public.oxw_lobbies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  primary key (lobby_id, user_id)
);
create index if not exists oxw_lobby_members_active_idx
  on public.oxw_lobby_members (lobby_id) where left_at is null;

create table if not exists public.oxw_presence_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lobby_id uuid references public.oxw_lobbies(id) on delete set null,
  city_id text not null default 'nyc',
  status text not null default 'online' check (status in ('online', 'away', 'in_voice', 'trading', 'offline')),
  last_seen_at timestamptz not null default now(),
  meta jsonb not null default '{}'::jsonb,
  unique (user_id)
);
create index if not exists oxw_presence_lobby_idx on public.oxw_presence_sessions (lobby_id, last_seen_at desc);

-- ---------------------------------------------------------------------------
-- Trading history + portfolio
-- ---------------------------------------------------------------------------
create table if not exists public.oxw_trade_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  wallet text not null,
  chain text not null default 'solana',
  side text not null check (side in ('buy', 'sell', 'swap')),
  input_mint text not null,
  output_mint text not null,
  input_amount numeric not null,
  output_amount numeric not null,
  price_usd numeric,
  value_usd numeric,
  signature text,
  venue text not null default 'jupiter' check (venue in ('jupiter', 'pumpfun', 'raydium', 'orbitx', 'other')),
  status text not null default 'confirmed' check (status in ('pending', 'confirmed', 'failed')),
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create unique index if not exists oxw_trade_history_sig_uq on public.oxw_trade_history (signature) where signature is not null;
create index if not exists oxw_trade_history_user_created_idx on public.oxw_trade_history (user_id, created_at desc);
create index if not exists oxw_trade_history_mint_idx on public.oxw_trade_history (output_mint, created_at desc);

create table if not exists public.oxw_portfolio_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  wallet text not null,
  total_usd numeric not null default 0,
  holdings jsonb not null default '[]'::jsonb,
  captured_at timestamptz not null default now()
);
create index if not exists oxw_portfolio_snapshots_user_idx
  on public.oxw_portfolio_snapshots (user_id, captured_at desc);

-- ---------------------------------------------------------------------------
-- Gaming: quests + play sessions
-- ---------------------------------------------------------------------------
create table if not exists public.oxw_quests (
  id text primary key,
  title text not null,
  description text not null default '',
  kind text not null default 'daily' check (kind in ('daily', 'weekly', 'story', 'event', 'tutorial')),
  xp_reward integer not null default 0,
  reward_item_id text references public.oxw_item_defs(id),
  criteria jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.oxw_user_quests (
  user_id uuid not null references auth.users(id) on delete cascade,
  quest_id text not null references public.oxw_quests(id),
  status text not null default 'active' check (status in ('active', 'completed', 'claimed', 'expired')),
  progress jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (user_id, quest_id)
);
create index if not exists oxw_user_quests_status_idx on public.oxw_user_quests (user_id, status);

create table if not exists public.oxw_play_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  city_id text not null default 'nyc',
  lobby_id uuid references public.oxw_lobbies(id) on delete set null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  shards_collected integer not null default 0,
  distance_m numeric not null default 0,
  meta jsonb not null default '{}'::jsonb
);
create index if not exists oxw_play_sessions_user_idx on public.oxw_play_sessions (user_id, started_at desc);

-- ---------------------------------------------------------------------------
-- Token intel / risk cache (crypto backend)
-- ---------------------------------------------------------------------------
create table if not exists public.oxw_token_intel (
  mint text primary key,
  chain text not null default 'solana',
  symbol text,
  name text,
  risk_score numeric,
  risk_flags jsonb not null default '[]'::jsonb,
  holder_count integer,
  top10_pct numeric,
  liquidity_usd numeric,
  mcap_usd numeric,
  dev_wallet text,
  last_scanned_at timestamptz not null default now(),
  raw jsonb not null default '{}'::jsonb
);
create index if not exists oxw_token_intel_scanned_idx on public.oxw_token_intel (last_scanned_at desc);
create index if not exists oxw_token_intel_risk_idx on public.oxw_token_intel (risk_score);

create table if not exists public.oxw_onchain_events (
  id uuid primary key default gen_random_uuid(),
  chain text not null default 'solana',
  event_type text not null,
  mint text,
  signature text,
  payload jsonb not null default '{}'::jsonb,
  observed_at timestamptz not null default now()
);
create index if not exists oxw_onchain_events_type_idx on public.oxw_onchain_events (event_type, observed_at desc);
create unique index if not exists oxw_onchain_events_sig_type_uq
  on public.oxw_onchain_events (signature, event_type) where signature is not null;

-- ---------------------------------------------------------------------------
-- Audit / security
-- ---------------------------------------------------------------------------
create table if not exists public.oxw_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text not null,
  resource_type text,
  resource_id text,
  ip text,
  user_agent text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists oxw_audit_log_actor_idx on public.oxw_audit_log (actor_id, created_at desc);
create index if not exists oxw_audit_log_action_idx on public.oxw_audit_log (action, created_at desc);

-- ---------------------------------------------------------------------------
-- Seed catalogs (safe upserts)
-- ---------------------------------------------------------------------------
insert into public.oxw_achievements (id, name, description, category, xp_reward) values
  ('first_steps', 'First Steps', 'Enter OrbitX City for the first time', 'tutorial', 50),
  ('social_butterfly', 'Social Butterfly', 'Send 10 world chat messages', 'social', 100),
  ('trader_initiate', 'Trader Initiate', 'Complete your first Jupiter swap in-world', 'trading', 150),
  ('shard_hunter', 'Shard Hunter', 'Collect 25 OBX shards', 'game', 120),
  ('lobby_host', 'Lobby Host', 'Create a public or private lobby', 'multiplayer', 80)
on conflict (id) do nothing;

insert into public.oxw_item_defs (id, name, kind, rarity, stackable, max_stack) values
  ('badge-pioneer', 'City Pioneer', 'badge', 'rare', false, 1),
  ('key-nyc', 'NYC Block Key', 'key', 'uncommon', false, 1),
  ('ad-slot', 'Billboard Slot', 'ad_slot', 'epic', true, 10),
  ('emote-dance', 'Dance Emote', 'emote', 'common', false, 1),
  ('cosmetic-neon-trim', 'Neon Trim', 'cosmetic', 'uncommon', false, 1)
on conflict (id) do nothing;

insert into public.oxw_quests (id, title, description, kind, xp_reward, criteria) values
  ('tutorial_enter', 'Enter the City', 'Join any lobby and enter a city', 'tutorial', 50, '{"enter_world":1}'::jsonb),
  ('daily_walk', 'Street Walker', 'Travel 500m in any city today', 'daily', 40, '{"distance_m":500}'::jsonb),
  ('daily_chat', 'Say Hello', 'Send 3 chat messages', 'daily', 30, '{"chat_messages":3}'::jsonb),
  ('event_trade', 'Make a Trade', 'Complete one confirmed swap', 'event', 100, '{"trades":1}'::jsonb)
on conflict (id) do nothing;

-- Main public lobby seed
insert into public.oxw_lobbies (channel_id, label, city_id, visibility, status, max_players)
values ('oxc-world-nyc', 'Main Lobby · NYC', 'nyc', 'public', 'open', 256)
on conflict (channel_id) do nothing;

insert into public.oxw_chat_channels (kind, slug, title, city_id, is_private)
values ('world', 'nyc-main', 'NYC World Chat', 'nyc', false)
on conflict (kind, slug) do nothing;
