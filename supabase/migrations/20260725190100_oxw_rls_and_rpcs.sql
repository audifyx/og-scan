-- =============================================================================
-- OrbitX World — RLS policies + privileged RPCs
-- All tables default-deny; authenticated users access only their own rows
-- unless a public-read or membership rule applies. Staff via oxw_is_staff().
-- =============================================================================

-- Enable RLS
alter table public.oxw_user_roles enable row level security;
alter table public.oxw_user_settings enable row level security;
alter table public.oxw_wallet_links enable row level security;
alter table public.oxw_progression enable row level security;
alter table public.oxw_xp_events enable row level security;
alter table public.oxw_achievements enable row level security;
alter table public.oxw_user_achievements enable row level security;
alter table public.oxw_rewards enable row level security;
alter table public.oxw_user_rewards enable row level security;
alter table public.oxw_item_defs enable row level security;
alter table public.oxw_inventory enable row level security;
alter table public.oxw_friend_requests enable row level security;
alter table public.oxw_friendships enable row level security;
alter table public.oxw_notifications enable row level security;
alter table public.oxw_communities enable row level security;
alter table public.oxw_community_members enable row level security;
alter table public.oxw_community_posts enable row level security;
alter table public.oxw_chat_channels enable row level security;
alter table public.oxw_chat_messages enable row level security;
alter table public.oxw_chat_members enable row level security;
alter table public.oxw_voice_rooms enable row level security;
alter table public.oxw_voice_participants enable row level security;
alter table public.oxw_lobbies enable row level security;
alter table public.oxw_lobby_members enable row level security;
alter table public.oxw_presence_sessions enable row level security;
alter table public.oxw_trade_history enable row level security;
alter table public.oxw_portfolio_snapshots enable row level security;
alter table public.oxw_quests enable row level security;
alter table public.oxw_user_quests enable row level security;
alter table public.oxw_play_sessions enable row level security;
alter table public.oxw_token_intel enable row level security;
alter table public.oxw_onchain_events enable row level security;
alter table public.oxw_audit_log enable row level security;

-- Helper: drop+create policy pattern
-- Roles
drop policy if exists oxw_user_roles_select on public.oxw_user_roles;
create policy oxw_user_roles_select on public.oxw_user_roles
  for select to authenticated
  using (user_id = (select auth.uid()) or public.oxw_is_staff());

-- Settings
drop policy if exists oxw_user_settings_all on public.oxw_user_settings;
create policy oxw_user_settings_all on public.oxw_user_settings
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Wallet links
drop policy if exists oxw_wallet_links_all on public.oxw_wallet_links;
create policy oxw_wallet_links_all on public.oxw_wallet_links
  for all to authenticated
  using (user_id = (select auth.uid()) or public.oxw_is_staff())
  with check (user_id = (select auth.uid()));

-- Progression (read own; writes via RPC)
drop policy if exists oxw_progression_select on public.oxw_progression;
create policy oxw_progression_select on public.oxw_progression
  for select to authenticated
  using (user_id = (select auth.uid()) or public.oxw_is_staff());

drop policy if exists oxw_xp_events_select on public.oxw_xp_events;
create policy oxw_xp_events_select on public.oxw_xp_events
  for select to authenticated
  using (user_id = (select auth.uid()) or public.oxw_is_staff());

-- Achievements catalog public read
drop policy if exists oxw_achievements_read on public.oxw_achievements;
create policy oxw_achievements_read on public.oxw_achievements
  for select to anon, authenticated using (is_active = true or public.oxw_is_staff());

drop policy if exists oxw_user_achievements_select on public.oxw_user_achievements;
create policy oxw_user_achievements_select on public.oxw_user_achievements
  for select to authenticated
  using (user_id = (select auth.uid()) or public.oxw_is_staff());

drop policy if exists oxw_rewards_read on public.oxw_rewards;
create policy oxw_rewards_read on public.oxw_rewards
  for select to authenticated using (is_active = true or public.oxw_is_staff());

drop policy if exists oxw_user_rewards_select on public.oxw_user_rewards;
create policy oxw_user_rewards_select on public.oxw_user_rewards
  for select to authenticated
  using (user_id = (select auth.uid()) or public.oxw_is_staff());

-- Items / inventory
drop policy if exists oxw_item_defs_read on public.oxw_item_defs;
create policy oxw_item_defs_read on public.oxw_item_defs
  for select to anon, authenticated using (true);

drop policy if exists oxw_inventory_all on public.oxw_inventory;
create policy oxw_inventory_all on public.oxw_inventory
  for all to authenticated
  using (user_id = (select auth.uid()) or public.oxw_is_staff())
  with check (user_id = (select auth.uid()));

-- Friends
drop policy if exists oxw_friend_requests_select on public.oxw_friend_requests;
create policy oxw_friend_requests_select on public.oxw_friend_requests
  for select to authenticated
  using (from_user_id = (select auth.uid()) or to_user_id = (select auth.uid()) or public.oxw_is_staff());

drop policy if exists oxw_friend_requests_insert on public.oxw_friend_requests;
create policy oxw_friend_requests_insert on public.oxw_friend_requests
  for insert to authenticated
  with check (from_user_id = (select auth.uid()));

drop policy if exists oxw_friend_requests_update on public.oxw_friend_requests;
create policy oxw_friend_requests_update on public.oxw_friend_requests
  for update to authenticated
  using (from_user_id = (select auth.uid()) or to_user_id = (select auth.uid()) or public.oxw_is_staff());

drop policy if exists oxw_friendships_select on public.oxw_friendships;
create policy oxw_friendships_select on public.oxw_friendships
  for select to authenticated
  using (user_a = (select auth.uid()) or user_b = (select auth.uid()) or public.oxw_is_staff());

-- Notifications
drop policy if exists oxw_notifications_all on public.oxw_notifications;
create policy oxw_notifications_all on public.oxw_notifications
  for all to authenticated
  using (user_id = (select auth.uid()) or public.oxw_is_staff())
  with check (user_id = (select auth.uid()));

-- Communities
drop policy if exists oxw_communities_read on public.oxw_communities;
create policy oxw_communities_read on public.oxw_communities
  for select to anon, authenticated
  using (visibility in ('public', 'unlisted') or owner_id = (select auth.uid()) or public.oxw_is_staff()
    or exists (
      select 1 from public.oxw_community_members m
      where m.community_id = oxw_communities.id and m.user_id = (select auth.uid())
    ));

drop policy if exists oxw_communities_insert on public.oxw_communities;
create policy oxw_communities_insert on public.oxw_communities
  for insert to authenticated with check (owner_id = (select auth.uid()));

drop policy if exists oxw_communities_update on public.oxw_communities;
create policy oxw_communities_update on public.oxw_communities
  for update to authenticated
  using (owner_id = (select auth.uid()) or public.oxw_is_staff());

drop policy if exists oxw_community_members_select on public.oxw_community_members;
create policy oxw_community_members_select on public.oxw_community_members
  for select to authenticated using (true);

drop policy if exists oxw_community_members_self on public.oxw_community_members;
create policy oxw_community_members_self on public.oxw_community_members
  for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists oxw_community_members_delete on public.oxw_community_members;
create policy oxw_community_members_delete on public.oxw_community_members
  for delete to authenticated
  using (user_id = (select auth.uid()) or public.oxw_is_staff());

drop policy if exists oxw_community_posts_read on public.oxw_community_posts;
create policy oxw_community_posts_read on public.oxw_community_posts
  for select to authenticated
  using (deleted_at is null);

drop policy if exists oxw_community_posts_insert on public.oxw_community_posts;
create policy oxw_community_posts_insert on public.oxw_community_posts
  for insert to authenticated with check (author_id = (select auth.uid()));

drop policy if exists oxw_community_posts_update on public.oxw_community_posts;
create policy oxw_community_posts_update on public.oxw_community_posts
  for update to authenticated
  using (author_id = (select auth.uid()) or public.oxw_is_staff());

-- Chat
drop policy if exists oxw_chat_channels_read on public.oxw_chat_channels;
create policy oxw_chat_channels_read on public.oxw_chat_channels
  for select to authenticated
  using (
    is_private = false
    or created_by = (select auth.uid())
    or public.oxw_is_staff()
    or exists (
      select 1 from public.oxw_chat_members m
      where m.channel_id = oxw_chat_channels.id and m.user_id = (select auth.uid())
    )
  );

drop policy if exists oxw_chat_messages_read on public.oxw_chat_messages;
create policy oxw_chat_messages_read on public.oxw_chat_messages
  for select to authenticated
  using (
    exists (
      select 1 from public.oxw_chat_channels c
      where c.id = channel_id and (
        c.is_private = false
        or exists (select 1 from public.oxw_chat_members m where m.channel_id = c.id and m.user_id = (select auth.uid()))
        or public.oxw_is_staff()
      )
    )
  );

drop policy if exists oxw_chat_messages_insert on public.oxw_chat_messages;
create policy oxw_chat_messages_insert on public.oxw_chat_messages
  for insert to authenticated with check (sender_id = (select auth.uid()));

drop policy if exists oxw_chat_members_self on public.oxw_chat_members;
create policy oxw_chat_members_self on public.oxw_chat_members
  for all to authenticated
  using (user_id = (select auth.uid()) or public.oxw_is_staff())
  with check (user_id = (select auth.uid()));

-- Voice
drop policy if exists oxw_voice_rooms_read on public.oxw_voice_rooms;
create policy oxw_voice_rooms_read on public.oxw_voice_rooms
  for select to authenticated
  using (is_public = true or owner_id = (select auth.uid()) or public.oxw_is_staff());

drop policy if exists oxw_voice_participants_select on public.oxw_voice_participants;
create policy oxw_voice_participants_select on public.oxw_voice_participants
  for select to authenticated using (true);

drop policy if exists oxw_voice_participants_self on public.oxw_voice_participants;
create policy oxw_voice_participants_self on public.oxw_voice_participants
  for insert to authenticated with check (user_id = (select auth.uid()));

-- Lobbies
drop policy if exists oxw_lobbies_read on public.oxw_lobbies;
create policy oxw_lobbies_read on public.oxw_lobbies
  for select to anon, authenticated
  using (
    visibility = 'public'
    or host_id = (select auth.uid())
    or public.oxw_is_staff()
    or exists (
      select 1 from public.oxw_lobby_members m
      where m.lobby_id = oxw_lobbies.id
        and m.user_id = (select auth.uid())
        and m.left_at is null
    )
  );

drop policy if exists oxw_lobbies_insert on public.oxw_lobbies;
create policy oxw_lobbies_insert on public.oxw_lobbies
  for insert to authenticated with check (host_id = (select auth.uid()));

drop policy if exists oxw_lobbies_update on public.oxw_lobbies;
create policy oxw_lobbies_update on public.oxw_lobbies
  for update to authenticated
  using (host_id = (select auth.uid()) or public.oxw_is_staff());

drop policy if exists oxw_lobby_members_select on public.oxw_lobby_members;
create policy oxw_lobby_members_select on public.oxw_lobby_members
  for select to authenticated using (true);

drop policy if exists oxw_lobby_members_self on public.oxw_lobby_members;
create policy oxw_lobby_members_self on public.oxw_lobby_members
  for all to authenticated
  using (user_id = (select auth.uid()) or public.oxw_is_staff())
  with check (user_id = (select auth.uid()));

-- Presence
drop policy if exists oxw_presence_select on public.oxw_presence_sessions;
create policy oxw_presence_select on public.oxw_presence_sessions
  for select to authenticated using (true);

drop policy if exists oxw_presence_self on public.oxw_presence_sessions;
create policy oxw_presence_self on public.oxw_presence_sessions
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Trading
drop policy if exists oxw_trade_history_select on public.oxw_trade_history;
create policy oxw_trade_history_select on public.oxw_trade_history
  for select to authenticated
  using (user_id = (select auth.uid()) or public.oxw_is_staff());

drop policy if exists oxw_portfolio_select on public.oxw_portfolio_snapshots;
create policy oxw_portfolio_select on public.oxw_portfolio_snapshots
  for select to authenticated
  using (user_id = (select auth.uid()) or public.oxw_is_staff());

-- Quests
drop policy if exists oxw_quests_read on public.oxw_quests;
create policy oxw_quests_read on public.oxw_quests
  for select to anon, authenticated using (is_active = true or public.oxw_is_staff());

drop policy if exists oxw_user_quests_all on public.oxw_user_quests;
create policy oxw_user_quests_all on public.oxw_user_quests
  for all to authenticated
  using (user_id = (select auth.uid()) or public.oxw_is_staff())
  with check (user_id = (select auth.uid()));

drop policy if exists oxw_play_sessions_all on public.oxw_play_sessions;
create policy oxw_play_sessions_all on public.oxw_play_sessions
  for all to authenticated
  using (user_id = (select auth.uid()) or public.oxw_is_staff())
  with check (user_id = (select auth.uid()));

-- Token intel public read (cached scanner output)
drop policy if exists oxw_token_intel_read on public.oxw_token_intel;
create policy oxw_token_intel_read on public.oxw_token_intel
  for select to anon, authenticated using (true);

drop policy if exists oxw_onchain_events_read on public.oxw_onchain_events;
create policy oxw_onchain_events_read on public.oxw_onchain_events
  for select to authenticated using (true);

-- Audit: staff only
drop policy if exists oxw_audit_log_staff on public.oxw_audit_log;
create policy oxw_audit_log_staff on public.oxw_audit_log
  for select to authenticated using (public.oxw_is_staff());

-- =============================================================================
-- RPCs (security definer) — privileged mutations
-- =============================================================================

-- Level curve: level N requires N^2 * 100 XP cumulative
create or replace function public.oxw_level_for_xp(p_xp bigint)
returns integer
language sql
immutable
set search_path = public
as $$
  select greatest(1, floor(sqrt(greatest(p_xp, 0)::numeric / 100.0))::integer + 1);
$$;

create or replace function public.oxw_award_xp(
  p_user_id uuid,
  p_amount integer,
  p_reason text,
  p_source text default 'system',
  p_ref_type text default null,
  p_ref_id text default null,
  p_meta jsonb default '{}'::jsonb
)
returns public.oxw_progression
language plpgsql
security definer
set search_path = public
as $$
declare
  prog public.oxw_progression;
begin
  if p_amount = 0 then
    raise exception 'amount must be non-zero';
  end if;
  -- Only service role / staff may award; players cannot call with arbitrary user ids
  if (select auth.role()) <> 'service_role' and not public.oxw_is_staff() then
    raise exception 'forbidden';
  end if;

  insert into public.oxw_xp_events (user_id, amount, reason, source, ref_type, ref_id, meta)
  values (p_user_id, p_amount, p_reason, coalesce(p_source, 'system'), p_ref_type, p_ref_id, coalesce(p_meta, '{}'::jsonb));

  insert into public.oxw_progression (user_id, xp, level)
  values (p_user_id, greatest(p_amount, 0), public.oxw_level_for_xp(greatest(p_amount, 0)))
  on conflict (user_id) do update set
    xp = greatest(0, public.oxw_progression.xp + p_amount),
    level = public.oxw_level_for_xp(greatest(0, public.oxw_progression.xp + p_amount)),
    updated_at = now()
  returning * into prog;

  return prog;
end;
$$;

revoke all on function public.oxw_award_xp(uuid, integer, text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.oxw_award_xp(uuid, integer, text, text, text, text, jsonb) to service_role;

create or replace function public.oxw_ensure_player(p_user_id uuid default auth.uid())
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null then
    raise exception 'not authenticated';
  end if;
  if p_user_id <> auth.uid() and (select auth.role()) <> 'service_role' and not public.oxw_is_staff() then
    raise exception 'forbidden';
  end if;

  insert into public.oxw_user_settings (user_id) values (p_user_id)
  on conflict (user_id) do nothing;

  insert into public.oxw_progression (user_id) values (p_user_id)
  on conflict (user_id) do nothing;

  insert into public.oxw_user_roles (user_id, role)
  values (p_user_id, 'player')
  on conflict (user_id, role) do nothing;

  insert into public.oxw_inventory (user_id, item_id, qty)
  values
    (p_user_id, 'badge-pioneer', 1),
    (p_user_id, 'key-nyc', 1),
    (p_user_id, 'emote-dance', 1)
  on conflict (user_id, item_id) do nothing;
end;
$$;

grant execute on function public.oxw_ensure_player(uuid) to authenticated, service_role;

create or replace function public.oxw_accept_friend_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  req public.oxw_friend_requests;
  a uuid; b uuid;
begin
  select * into req from public.oxw_friend_requests where id = p_request_id for update;
  if req.id is null then raise exception 'not found'; end if;
  if req.to_user_id <> auth.uid() and not public.oxw_is_staff() then raise exception 'forbidden'; end if;
  if req.status <> 'pending' then raise exception 'not pending'; end if;

  update public.oxw_friend_requests
    set status = 'accepted', resolved_at = now()
    where id = p_request_id;

  a := least(req.from_user_id, req.to_user_id);
  b := greatest(req.from_user_id, req.to_user_id);
  insert into public.oxw_friendships (user_a, user_b) values (a, b)
  on conflict do nothing;

  insert into public.oxw_notifications (user_id, kind, title, body, payload)
  values
    (req.from_user_id, 'friend_accepted', 'Friend request accepted', 'You are now friends', jsonb_build_object('user_id', req.to_user_id)),
    (req.to_user_id, 'friend_accepted', 'New friend', 'Friend request accepted', jsonb_build_object('user_id', req.from_user_id));
end;
$$;

grant execute on function public.oxw_accept_friend_request(uuid) to authenticated;

create or replace function public.oxw_record_trade(
  p_wallet text,
  p_side text,
  p_input_mint text,
  p_output_mint text,
  p_input_amount numeric,
  p_output_amount numeric,
  p_signature text,
  p_venue text default 'jupiter',
  p_price_usd numeric default null,
  p_value_usd numeric default null,
  p_meta jsonb default '{}'::jsonb
)
returns public.oxw_trade_history
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  row public.oxw_trade_history;
begin
  if uid is null then raise exception 'not authenticated'; end if;

  if p_signature is not null then
    select * into row from public.oxw_trade_history where signature = p_signature;
    if row.id is not null then
      return row;
    end if;
  end if;

  insert into public.oxw_trade_history (
    user_id, wallet, side, input_mint, output_mint, input_amount, output_amount,
    signature, venue, price_usd, value_usd, meta, status
  ) values (
    uid, p_wallet, p_side, p_input_mint, p_output_mint, p_input_amount, p_output_amount,
    p_signature, coalesce(p_venue, 'jupiter'), p_price_usd, p_value_usd, coalesce(p_meta, '{}'::jsonb), 'confirmed'
  )
  returning * into row;

  return row;
end;
$$;

grant execute on function public.oxw_record_trade(text, text, text, text, numeric, numeric, text, text, numeric, numeric, jsonb) to authenticated, service_role;

create or replace function public.oxw_upsert_presence(
  p_city_id text default 'nyc',
  p_lobby_id uuid default null,
  p_status text default 'online',
  p_meta jsonb default '{}'::jsonb
)
returns public.oxw_presence_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  row public.oxw_presence_sessions;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  insert into public.oxw_presence_sessions (user_id, city_id, lobby_id, status, meta, last_seen_at)
  values (uid, coalesce(p_city_id, 'nyc'), p_lobby_id, coalesce(p_status, 'online'), coalesce(p_meta, '{}'::jsonb), now())
  on conflict (user_id) do update set
    city_id = excluded.city_id,
    lobby_id = excluded.lobby_id,
    status = excluded.status,
    meta = excluded.meta,
    last_seen_at = now()
  returning * into row;
  return row;
end;
$$;

grant execute on function public.oxw_upsert_presence(text, uuid, text, jsonb) to authenticated;

create or replace function public.oxw_mark_notifications_read(p_ids uuid[] default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  update public.oxw_notifications
    set read_at = now()
  where user_id = auth.uid()
    and read_at is null
    and (p_ids is null or id = any(p_ids));
  get diagnostics n = row_count;
  return n;
end;
$$;

grant execute on function public.oxw_mark_notifications_read(uuid[]) to authenticated;
