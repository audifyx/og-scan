-- Backend security scan — tighten open RLS / grants (idempotent).

-- Helpers avoid RLS self-recursion when policies need membership checks.
create or replace function public.oxw_is_community_member(p_community_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.oxw_community_members m
    where m.community_id = p_community_id and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.oxw_is_lobby_member(p_lobby_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.oxw_lobby_members m
    where m.lobby_id = p_lobby_id and m.user_id = (select auth.uid()) and m.left_at is null
  );
$$;

create or replace function public.oxw_is_chat_member(p_channel_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.oxw_chat_members m
    where m.channel_id = p_channel_id and m.user_id = (select auth.uid())
  );
$$;

revoke all on function public.oxw_is_community_member(uuid) from public;
revoke all on function public.oxw_is_lobby_member(uuid) from public;
revoke all on function public.oxw_is_chat_member(uuid) from public;
grant execute on function public.oxw_is_community_member(uuid) to authenticated;
grant execute on function public.oxw_is_lobby_member(uuid) to authenticated;
grant execute on function public.oxw_is_chat_member(uuid) to authenticated;

-- 1) orbitx_tokens: drop open insert
drop policy if exists orbitx_tokens_insert_all on public.orbitx_tokens;
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'orbitx_tokens'
      and policyname = 'orbitx_tokens_insert_authenticated'
  ) then
    create policy orbitx_tokens_insert_authenticated on public.orbitx_tokens
      for insert to authenticated
      with check (creator_wallet is not null and length(trim(creator_wallet)) > 0);
  end if;
end $$;

-- 2) orbitx_mark_graduated: service_role only
revoke execute on function public.orbitx_mark_graduated(text) from public, anon, authenticated;
grant execute on function public.orbitx_mark_graduated(text) to service_role;

-- 3) orbitx_token_chat: require authenticated session
drop policy if exists orbitx_token_chat_insert_all on public.orbitx_token_chat;
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'orbitx_token_chat'
      and policyname = 'orbitx_token_chat_insert_auth'
  ) then
    create policy orbitx_token_chat_insert_auth on public.orbitx_token_chat
      for insert to authenticated
      with check (
        auth.uid() is not null
        and char_length(body) between 1 and 500
        and char_length(wallet) between 32 and 44
      );
  end if;
end $$;

-- 4) OXW inventory: no self-mint via INSERT
drop policy if exists oxw_inventory_all on public.oxw_inventory;
drop policy if exists oxw_inventory_select on public.oxw_inventory;
drop policy if exists oxw_inventory_update on public.oxw_inventory;
create policy oxw_inventory_select on public.oxw_inventory
  for select to authenticated
  using (user_id = (select auth.uid()) or public.oxw_is_staff());
create policy oxw_inventory_update on public.oxw_inventory
  for update to authenticated
  using (user_id = (select auth.uid()) or public.oxw_is_staff())
  with check (user_id = (select auth.uid()) or public.oxw_is_staff());

-- 5) OXW membership-gated policies
drop policy if exists oxw_communities_read on public.oxw_communities;
create policy oxw_communities_read on public.oxw_communities
  for select to anon, authenticated
  using (
    visibility in ('public', 'unlisted')
    or owner_id = (select auth.uid())
    or public.oxw_is_staff()
    or public.oxw_is_community_member(id)
  );

drop policy if exists oxw_community_members_select on public.oxw_community_members;
create policy oxw_community_members_select on public.oxw_community_members
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.oxw_is_staff()
    or exists (
      select 1 from public.oxw_communities c
      where c.id = community_id
        and (
          c.visibility in ('public', 'unlisted')
          or c.owner_id = (select auth.uid())
          or public.oxw_is_community_member(c.id)
        )
    )
  );

drop policy if exists oxw_community_posts_read on public.oxw_community_posts;
create policy oxw_community_posts_read on public.oxw_community_posts
  for select to authenticated
  using (
    deleted_at is null
    and (
      public.oxw_is_staff()
      or exists (
        select 1 from public.oxw_communities c
        where c.id = community_id
          and (
            c.visibility in ('public', 'unlisted')
            or c.owner_id = (select auth.uid())
            or public.oxw_is_community_member(c.id)
          )
      )
    )
  );

drop policy if exists oxw_community_posts_insert on public.oxw_community_posts;
create policy oxw_community_posts_insert on public.oxw_community_posts
  for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and (
      public.oxw_is_staff()
      or exists (
        select 1 from public.oxw_communities c
        where c.id = community_id
          and (c.owner_id = (select auth.uid()) or public.oxw_is_community_member(c.id))
      )
    )
  );

drop policy if exists oxw_chat_channels_read on public.oxw_chat_channels;
create policy oxw_chat_channels_read on public.oxw_chat_channels
  for select to authenticated
  using (
    is_private = false
    or created_by = (select auth.uid())
    or public.oxw_is_staff()
    or public.oxw_is_chat_member(id)
  );

drop policy if exists oxw_chat_messages_read on public.oxw_chat_messages;
create policy oxw_chat_messages_read on public.oxw_chat_messages
  for select to authenticated
  using (
    exists (
      select 1 from public.oxw_chat_channels c
      where c.id = channel_id and (
        c.is_private = false
        or public.oxw_is_chat_member(c.id)
        or public.oxw_is_staff()
      )
    )
  );

drop policy if exists oxw_chat_messages_insert on public.oxw_chat_messages;
create policy oxw_chat_messages_insert on public.oxw_chat_messages
  for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and exists (
      select 1 from public.oxw_chat_channels c
      where c.id = channel_id
        and (
          c.is_private = false
          or c.created_by = (select auth.uid())
          or public.oxw_is_staff()
          or public.oxw_is_chat_member(c.id)
        )
    )
  );

drop policy if exists oxw_voice_participants_select on public.oxw_voice_participants;
create policy oxw_voice_participants_select on public.oxw_voice_participants
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.oxw_is_staff()
    or exists (
      select 1 from public.oxw_voice_rooms r
      where r.id = room_id
        and (r.is_public = true or r.owner_id = (select auth.uid()))
    )
  );

drop policy if exists oxw_lobbies_read on public.oxw_lobbies;
create policy oxw_lobbies_read on public.oxw_lobbies
  for select to anon, authenticated
  using (
    visibility = 'public'
    or host_id = (select auth.uid())
    or public.oxw_is_staff()
    or public.oxw_is_lobby_member(id)
  );

drop policy if exists oxw_lobby_members_select on public.oxw_lobby_members;
create policy oxw_lobby_members_select on public.oxw_lobby_members
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.oxw_is_staff()
    or exists (
      select 1 from public.oxw_lobbies l
      where l.id = lobby_id
        and (
          l.visibility = 'public'
          or l.host_id = (select auth.uid())
          or public.oxw_is_lobby_member(l.id)
        )
    )
  );

drop policy if exists oxw_presence_select on public.oxw_presence_sessions;
create policy oxw_presence_select on public.oxw_presence_sessions
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.oxw_is_staff()
    or status in ('online', 'away', 'in_lobby', 'in_game')
  );

drop policy if exists oxw_onchain_events_read on public.oxw_onchain_events;
create policy oxw_onchain_events_read on public.oxw_onchain_events
  for select to authenticated
  using (public.oxw_is_staff());

-- 6) wallet_identities: stop public user_id dump
drop policy if exists wallet_identities_read on public.wallet_identities;
create policy wallet_identities_read on public.wallet_identities
  for select to authenticated
  using (user_id = (select auth.uid()));
