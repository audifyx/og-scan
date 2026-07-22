-- Keep social profiles (public.profiles) and wallet profiles (public.orbitx_profiles)
-- from drifting: bidirectional sync of username / display_name / bio / avatar_url /
-- banner_url, joined through wallet_identities. Loop-safe via pg_trigger_depth().

create or replace function public.sync_profile_to_orbitx() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  begin
    update public.orbitx_profiles op set
      username     = coalesce(new.username, op.username),
      display_name = coalesce(new.display_name, op.display_name),
      bio          = coalesce(new.bio, op.bio),
      avatar_url   = coalesce(new.avatar_url, op.avatar_url),
      banner_url   = coalesce(new.banner_url, op.banner_url),
      updated_at   = now()
    where op.wallet in (select wi.wallet from public.wallet_identities wi where wi.user_id = new.user_id)
      and (coalesce(new.username, op.username)         is distinct from op.username
        or coalesce(new.display_name, op.display_name) is distinct from op.display_name
        or coalesce(new.bio, op.bio)                   is distinct from op.bio
        or coalesce(new.avatar_url, op.avatar_url)     is distinct from op.avatar_url
        or coalesce(new.banner_url, op.banner_url)     is distinct from op.banner_url);
  exception when unique_violation then
    update public.orbitx_profiles op set
      display_name = coalesce(new.display_name, op.display_name),
      bio          = coalesce(new.bio, op.bio),
      avatar_url   = coalesce(new.avatar_url, op.avatar_url),
      banner_url   = coalesce(new.banner_url, op.banner_url),
      updated_at   = now()
    where op.wallet in (select wi.wallet from public.wallet_identities wi where wi.user_id = new.user_id);
  end;
  return new;
end $$;

drop trigger if exists trg_sync_profile_to_orbitx on public.profiles;
create trigger trg_sync_profile_to_orbitx
  after insert or update of username, display_name, bio, avatar_url, banner_url on public.profiles
  for each row when (pg_trigger_depth() = 0)
  execute function public.sync_profile_to_orbitx();

create or replace function public.sync_orbitx_to_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_user uuid;
begin
  select wi.user_id into v_user from public.wallet_identities wi where wi.wallet = new.wallet limit 1;
  if v_user is null then return new; end if;
  begin
    update public.profiles p set
      username     = coalesce(new.username, p.username),
      display_name = coalesce(new.display_name, p.display_name),
      bio          = coalesce(new.bio, p.bio),
      avatar_url   = coalesce(new.avatar_url, p.avatar_url),
      banner_url   = coalesce(new.banner_url, p.banner_url),
      updated_at   = now()
    where p.user_id = v_user
      and (coalesce(new.username, p.username)         is distinct from p.username
        or coalesce(new.display_name, p.display_name) is distinct from p.display_name
        or coalesce(new.bio, p.bio)                   is distinct from p.bio
        or coalesce(new.avatar_url, p.avatar_url)     is distinct from p.avatar_url
        or coalesce(new.banner_url, p.banner_url)     is distinct from p.banner_url);
  exception when unique_violation then
    update public.profiles p set
      display_name = coalesce(new.display_name, p.display_name),
      bio          = coalesce(new.bio, p.bio),
      avatar_url   = coalesce(new.avatar_url, p.avatar_url),
      banner_url   = coalesce(new.banner_url, p.banner_url),
      updated_at   = now()
    where p.user_id = v_user;
  end;
  return new;
end $$;

drop trigger if exists trg_sync_orbitx_to_profile on public.orbitx_profiles;
create trigger trg_sync_orbitx_to_profile
  after insert or update on public.orbitx_profiles
  for each row when (pg_trigger_depth() = 0)
  execute function public.sync_orbitx_to_profile();

-- NFT-profile saves must never blank out fields that weren't provided.
create or replace function public.orbitx_upsert_profile(
  p_wallet text, p_username text, p_display_name text, p_bio text,
  p_avatar_url text, p_banner_url text, p_twitter text, p_website text
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.orbitx_profiles as pr
    (wallet, username, display_name, bio, avatar_url, banner_url, twitter, website, updated_at)
  values
    (p_wallet, nullif(p_username,''), nullif(p_display_name,''), nullif(p_bio,''),
     nullif(p_avatar_url,''), nullif(p_banner_url,''), nullif(p_twitter,''), nullif(p_website,''), now())
  on conflict (wallet) do update set
    username     = coalesce(nullif(excluded.username,''), pr.username),
    display_name = coalesce(nullif(excluded.display_name,''), pr.display_name),
    bio          = coalesce(nullif(excluded.bio,''), pr.bio),
    avatar_url   = coalesce(nullif(excluded.avatar_url,''), pr.avatar_url),
    banner_url   = coalesce(nullif(excluded.banner_url,''), pr.banner_url),
    twitter      = coalesce(nullif(excluded.twitter,''), pr.twitter),
    website      = coalesce(nullif(excluded.website,''), pr.website),
    updated_at   = now();
end $$;
