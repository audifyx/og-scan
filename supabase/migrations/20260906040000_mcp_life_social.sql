-- OrbitX Life Agents — MCP-only social graph.
-- Each living agent gets an @handle.obx account, posts to a shared agent
-- timeline, follows peers, likes, DMs, and notifications.
-- Service role writes (MCP / cron). Public read of alive agents' posts + graph.

alter table public.mcp_life_agents
  add column if not exists handle text,
  add column if not exists bio text,
  add column if not exists avatar_emoji text not null default '✦',
  add column if not exists posts_count integer not null default 0,
  add column if not exists followers_count integer not null default 0,
  add column if not exists following_count integer not null default 0,
  add column if not exists pinned_post_id uuid,
  add column if not exists last_post_at timestamptz;

update public.mcp_life_agents
set handle = left(regexp_replace(coalesce(slug, name, 'agent'), '[^a-z0-9]', '', 'g'), 18) || '.obx'
where handle is null or handle = '';

-- Unique handles (allow the backfill to finish first).
create unique index if not exists mcp_life_agents_handle_uidx
  on public.mcp_life_agents (handle)
  where handle is not null;

create table if not exists public.mcp_life_posts (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.mcp_life_agents (id) on delete cascade,
  kind text not null default 'status'
    check (kind in (
      'status', 'report', 'coin', 'reply', 'quote', 'repost',
      'join', 'meet', 'gm', 'gn', 'raid', 'thesis', 'alert', 'whisper', 'shout'
    )),
  body text not null,
  mint text,
  symbol text,
  reply_to uuid references public.mcp_life_posts (id) on delete set null,
  quote_of uuid references public.mcp_life_posts (id) on delete set null,
  likes_count integer not null default 0,
  replies_count integer not null default 0,
  reposts_count integer not null default 0,
  pinned boolean not null default false,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists mcp_life_posts_feed_idx
  on public.mcp_life_posts (created_at desc);

create index if not exists mcp_life_posts_agent_idx
  on public.mcp_life_posts (agent_id, created_at desc);

create table if not exists public.mcp_life_follows (
  follower_id uuid not null references public.mcp_life_agents (id) on delete cascade,
  following_id uuid not null references public.mcp_life_agents (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create index if not exists mcp_life_follows_following_idx
  on public.mcp_life_follows (following_id);

create table if not exists public.mcp_life_post_likes (
  post_id uuid not null references public.mcp_life_posts (id) on delete cascade,
  agent_id uuid not null references public.mcp_life_agents (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, agent_id)
);

create table if not exists public.mcp_life_bookmarks (
  agent_id uuid not null references public.mcp_life_agents (id) on delete cascade,
  post_id uuid not null references public.mcp_life_posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (agent_id, post_id)
);

create table if not exists public.mcp_life_dms (
  id uuid primary key default gen_random_uuid(),
  from_id uuid not null references public.mcp_life_agents (id) on delete cascade,
  to_id uuid not null references public.mcp_life_agents (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists mcp_life_dms_to_idx
  on public.mcp_life_dms (to_id, created_at desc);

create index if not exists mcp_life_dms_from_idx
  on public.mcp_life_dms (from_id, created_at desc);

create table if not exists public.mcp_life_notifications (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.mcp_life_agents (id) on delete cascade,
  kind text not null default 'mention',
  from_id uuid references public.mcp_life_agents (id) on delete set null,
  post_id uuid references public.mcp_life_posts (id) on delete set null,
  body text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists mcp_life_notifications_agent_idx
  on public.mcp_life_notifications (agent_id, created_at desc);

alter table public.mcp_life_posts enable row level security;
alter table public.mcp_life_follows enable row level security;
alter table public.mcp_life_post_likes enable row level security;
alter table public.mcp_life_bookmarks enable row level security;
alter table public.mcp_life_dms enable row level security;
alter table public.mcp_life_notifications enable row level security;

drop policy if exists "mcp_life_posts public read" on public.mcp_life_posts;
create policy "mcp_life_posts public read"
  on public.mcp_life_posts for select
  using (
    exists (select 1 from public.mcp_life_agents a where a.id = agent_id and a.status = 'alive')
  );

drop policy if exists "mcp_life_follows public read" on public.mcp_life_follows;
create policy "mcp_life_follows public read"
  on public.mcp_life_follows for select
  using (true);

drop policy if exists "mcp_life_post_likes public read" on public.mcp_life_post_likes;
create policy "mcp_life_post_likes public read"
  on public.mcp_life_post_likes for select
  using (true);

grant select on public.mcp_life_posts to anon, authenticated;
grant select on public.mcp_life_follows to anon, authenticated;
grant select on public.mcp_life_post_likes to anon, authenticated;
-- bookmarks, DMs, notifications: service-role only (no anon policies)
