-- OrbitX Launchpad — wallet-native profiles. The wallet address IS the account.
-- Public, non-sensitive profile fields only (no keys, no PII). Anyone can read;
-- writes go through orbitx_upsert_profile. NOTE (v1): the RPC trusts the caller's
-- wallet arg. A follow-up will gate writes behind an ed25519 signature (edge fn).
create table if not exists public.orbitx_profiles (
  wallet text primary key,
  username text unique,
  display_name text,
  bio text,
  avatar_url text,
  banner_url text,
  twitter text,
  website text,
  updated_at timestamptz not null default now()
);

alter table public.orbitx_profiles enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='orbitx_profiles' and policyname='orbitx_profiles_read_all') then
    create policy orbitx_profiles_read_all on public.orbitx_profiles for select using (true);
  end if;
end $$;

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
    username = excluded.username, display_name = excluded.display_name, bio = excluded.bio,
    avatar_url = excluded.avatar_url, banner_url = excluded.banner_url,
    twitter = excluded.twitter, website = excluded.website, updated_at = now();
end $$;

grant execute on function public.orbitx_upsert_profile(text,text,text,text,text,text,text,text) to anon, authenticated;
