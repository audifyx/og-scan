-- Auth + RLS hardening (idempotent). Safe on databases that already applied
-- the deleted OXW / orbitx_profiles migrations (tables exist in prod).

-- 1) Wallet SIWS: one-time nonce consume (HMAC nonces were replayable for 5 min).
create table if not exists public.wallet_auth_used_nonces (
  nonce text primary key,
  pubkey text not null,
  used_at timestamptz not null default now()
);

create index if not exists wallet_auth_used_nonces_used_at_idx
  on public.wallet_auth_used_nonces (used_at);

alter table public.wallet_auth_used_nonces enable row level security;

revoke all on public.wallet_auth_used_nonces from public, anon, authenticated;
grant all on public.wallet_auth_used_nonces to service_role;

-- 2) orbitx_upsert_profile: stop anonymous spoofing; bind wallet to session.
do $$
declare
  r record;
begin
  if to_regclass('public.orbitx_profiles') is null then
    return;
  end if;

  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'orbitx_upsert_profile'
  ) then
    execute $fn$
      create or replace function public.orbitx_upsert_profile(
        p_wallet text, p_username text, p_display_name text, p_bio text,
        p_avatar_url text, p_banner_url text, p_twitter text, p_website text
      ) returns void
      language plpgsql
      security definer
      set search_path = public
      as $body$
      begin
        if auth.uid() is null then
          raise exception 'not authenticated';
        end if;
        if to_regclass('public.wallet_identities') is not null then
          if not exists (
            select 1 from public.wallet_identities w
            where w.user_id = auth.uid()
              and lower(w.wallet) = lower(p_wallet)
          ) then
            raise exception 'wallet not linked to this account';
          end if;
        end if;
        insert into public.orbitx_profiles as pr
          (wallet, username, display_name, bio, avatar_url, banner_url, twitter, website, updated_at)
        values
          (p_wallet, nullif(p_username,''), nullif(p_display_name,''), nullif(p_bio,''),
           nullif(p_avatar_url,''), nullif(p_banner_url,''), nullif(p_twitter,''), nullif(p_website,''), now())
        on conflict (wallet) do update set
          username = excluded.username, display_name = excluded.display_name, bio = excluded.bio,
          avatar_url = excluded.avatar_url, banner_url = excluded.banner_url,
          twitter = excluded.twitter, website = excluded.website, updated_at = now();
      end
      $body$;
    $fn$;
  end if;

  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'orbitx_upsert_profile'
  loop
    execute format('revoke all on function %s from public, anon', r.sig);
    execute format('grant execute on function %s to authenticated, service_role', r.sig);
  end loop;
end $$;

-- 3) profiles: own-row writes. Public SELECT stays (social).
do $$
declare
  r record;
begin
  if to_regclass('public.profiles') is null then
    return;
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'user_id'
  ) then
    return;
  end if;

  execute 'alter table public.profiles enable row level security';

  for r in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and cmd = 'INSERT'
      and coalesce(with_check, '') in ('true', '(true)')
  loop
    execute format('drop policy if exists %I on public.profiles', r.policyname);
  end loop;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_insert_own'
  ) then
    execute $p$
      create policy profiles_insert_own on public.profiles
        for insert to authenticated
        with check (user_id = (select auth.uid()))
    $p$;
  end if;

  for r in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and cmd = 'UPDATE'
      and coalesce(qual, '') in ('true', '(true)')
  loop
    execute format('drop policy if exists %I on public.profiles', r.policyname);
  end loop;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_update_own'
  ) then
    execute $p$
      create policy profiles_update_own on public.profiles
        for update to authenticated
        using (user_id = (select auth.uid()))
        with check (user_id = (select auth.uid()))
    $p$;
  end if;
end $$;

-- 4) OXW private lobby / community / chat / voice: no self-insert into private spaces.
do $$
begin
  if to_regclass('public.oxw_lobby_members') is null then
    return;
  end if;
  if not exists (select 1 from pg_proc where proname = 'oxw_is_staff') then
    return;
  end if;

  execute 'drop policy if exists oxw_lobby_members_self on public.oxw_lobby_members';
  execute 'drop policy if exists oxw_lobby_members_insert on public.oxw_lobby_members';
  execute 'drop policy if exists oxw_lobby_members_update on public.oxw_lobby_members';
  execute 'drop policy if exists oxw_lobby_members_delete on public.oxw_lobby_members';

  execute $p$
    create policy oxw_lobby_members_insert on public.oxw_lobby_members
      for insert to authenticated
      with check (
        user_id = (select auth.uid())
        and (
          public.oxw_is_staff()
          or exists (
            select 1 from public.oxw_lobbies l
            where l.id = lobby_id
              and (
                l.visibility = 'public'
                or l.host_id = (select auth.uid())
              )
          )
        )
      )
  $p$;
  execute $p$
    create policy oxw_lobby_members_update on public.oxw_lobby_members
      for update to authenticated
      using (user_id = (select auth.uid()) or public.oxw_is_staff())
      with check (user_id = (select auth.uid()) or public.oxw_is_staff())
  $p$;
  execute $p$
    create policy oxw_lobby_members_delete on public.oxw_lobby_members
      for delete to authenticated
      using (user_id = (select auth.uid()) or public.oxw_is_staff())
  $p$;
end $$;

do $$
begin
  if to_regclass('public.oxw_community_members') is null then
    return;
  end if;
  if not exists (select 1 from pg_proc where proname = 'oxw_is_staff') then
    return;
  end if;

  execute 'drop policy if exists oxw_community_members_self on public.oxw_community_members';
  execute 'drop policy if exists oxw_community_members_insert on public.oxw_community_members';

  execute $p$
    create policy oxw_community_members_insert on public.oxw_community_members
      for insert to authenticated
      with check (
        user_id = (select auth.uid())
        and (
          public.oxw_is_staff()
          or exists (
            select 1 from public.oxw_communities c
            where c.id = community_id
              and (
                c.visibility in ('public', 'unlisted')
                or c.owner_id = (select auth.uid())
              )
          )
        )
      )
  $p$;
end $$;

do $$
begin
  if to_regclass('public.oxw_chat_members') is null or to_regclass('public.oxw_chat_channels') is null then
    return;
  end if;
  if not exists (select 1 from pg_proc where proname = 'oxw_is_staff') then
    return;
  end if;

  execute 'drop policy if exists oxw_chat_members_self on public.oxw_chat_members';
  execute 'drop policy if exists oxw_chat_members_insert on public.oxw_chat_members';
  execute 'drop policy if exists oxw_chat_members_update on public.oxw_chat_members';
  execute 'drop policy if exists oxw_chat_members_delete on public.oxw_chat_members';

  execute $p$
    create policy oxw_chat_members_insert on public.oxw_chat_members
      for insert to authenticated
      with check (
        user_id = (select auth.uid())
        and exists (
          select 1 from public.oxw_chat_channels c
          where c.id = channel_id
            and (
              c.is_private = false
              or c.created_by = (select auth.uid())
              or public.oxw_is_staff()
            )
        )
      )
  $p$;
  execute $p$
    create policy oxw_chat_members_update on public.oxw_chat_members
      for update to authenticated
      using (user_id = (select auth.uid()) or public.oxw_is_staff())
      with check (user_id = (select auth.uid()) or public.oxw_is_staff())
  $p$;
  execute $p$
    create policy oxw_chat_members_delete on public.oxw_chat_members
      for delete to authenticated
      using (user_id = (select auth.uid()) or public.oxw_is_staff())
  $p$;
end $$;

do $$
begin
  if to_regclass('public.oxw_voice_participants') is null or to_regclass('public.oxw_voice_rooms') is null then
    return;
  end if;
  if not exists (select 1 from pg_proc where proname = 'oxw_is_staff') then
    return;
  end if;

  execute 'drop policy if exists oxw_voice_participants_self on public.oxw_voice_participants';
  execute 'drop policy if exists oxw_voice_participants_insert on public.oxw_voice_participants';

  execute $p$
    create policy oxw_voice_participants_insert on public.oxw_voice_participants
      for insert to authenticated
      with check (
        user_id = (select auth.uid())
        and exists (
          select 1 from public.oxw_voice_rooms r
          where r.id = room_id
            and (
              r.is_public = true
              or r.owner_id = (select auth.uid())
              or public.oxw_is_staff()
            )
        )
      )
  $p$;
end $$;

-- 5) Token chat: poster wallet must belong to the signed-in user.
do $$
begin
  if to_regclass('public.orbitx_token_chat') is null then
    return;
  end if;
  if to_regclass('public.wallet_identities') is null then
    return;
  end if;

  execute 'drop policy if exists orbitx_token_chat_insert_all on public.orbitx_token_chat';
  execute 'drop policy if exists orbitx_token_chat_insert_auth on public.orbitx_token_chat';

  execute $p$
    create policy orbitx_token_chat_insert_auth on public.orbitx_token_chat
      for insert to authenticated
      with check (
        (select auth.uid()) is not null
        and char_length(body) between 1 and 500
        and exists (
          select 1 from public.wallet_identities w
          where w.user_id = (select auth.uid())
            and lower(w.wallet) = lower(orbitx_token_chat.wallet)
        )
      )
  $p$;
end $$;

comment on table public.wallet_auth_used_nonces is
  'One-time SIWS nonces. Service-role only; wallet-auth inserts then rejects duplicates.';
