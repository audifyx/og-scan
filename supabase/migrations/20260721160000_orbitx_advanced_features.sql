-- OrbitX Launchpad — advanced feature backend: watchlist, achievements,
-- referrals, and NFT registry. Same trust model as the existing OrbitX
-- tables (orbitx_profiles/orbitx_tokens): wallet-native, no Supabase Auth,
-- RLS enabled with public read, writes go through SECURITY DEFINER RPCs.

-- ═══════════════════════════ Watchlist ═══════════════════════════
create table if not exists public.orbitx_watchlist (
  wallet text not null,
  mint_address text not null,
  created_at timestamptz not null default now(),
  primary key (wallet, mint_address)
);
alter table public.orbitx_watchlist enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='orbitx_watchlist' and policyname='orbitx_watchlist_read_all') then
    create policy orbitx_watchlist_read_all on public.orbitx_watchlist for select using (true);
  end if;
end $$;

create or replace function public.orbitx_watchlist_toggle(p_wallet text, p_mint text)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_now_watching boolean;
begin
  if exists (select 1 from public.orbitx_watchlist where wallet = p_wallet and mint_address = p_mint) then
    delete from public.orbitx_watchlist where wallet = p_wallet and mint_address = p_mint;
    v_now_watching := false;
  else
    insert into public.orbitx_watchlist (wallet, mint_address) values (p_wallet, p_mint)
      on conflict do nothing;
    v_now_watching := true;
  end if;
  return v_now_watching;
end $$;
grant execute on function public.orbitx_watchlist_toggle(text, text) to anon, authenticated;

-- ═══════════════════════════ Achievements ═══════════════════════════
create table if not exists public.orbitx_achievements (
  wallet text not null,
  achievement_id text not null,
  unlocked_at timestamptz not null default now(),
  primary key (wallet, achievement_id)
);
alter table public.orbitx_achievements enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='orbitx_achievements' and policyname='orbitx_achievements_read_all') then
    create policy orbitx_achievements_read_all on public.orbitx_achievements for select using (true);
  end if;
end $$;

-- Recomputes + persists every achievement a wallet has earned, from real
-- registry data. Idempotent (on conflict do nothing) -- once unlocked, an
-- achievement's timestamp never moves even if later stats change.
create or replace function public.orbitx_sync_achievements(p_wallet text)
returns setof text
language plpgsql security definer set search_path = '' as $$
declare
  v_launches integer;
  v_graduated integer;
  v_best_flagged boolean;
  v_million boolean;
begin
  select count(*) into v_launches from public.orbitx_tokens where creator_wallet = p_wallet;
  select count(*) into v_graduated from public.orbitx_tokens
    where creator_wallet = p_wallet and (lp_pool_address is not null or graduated_at is not null);
  select bool_or(is_vamp) into v_best_flagged from public.orbitx_tokens where creator_wallet = p_wallet;

  if v_launches >= 1 then
    insert into public.orbitx_achievements (wallet, achievement_id) values (p_wallet, 'first_launch') on conflict do nothing;
    insert into public.orbitx_achievements (wallet, achievement_id) values (p_wallet, 'orbitx_og') on conflict do nothing;
  end if;
  if v_launches >= 5 then
    insert into public.orbitx_achievements (wallet, achievement_id) values (p_wallet, 'five_launches') on conflict do nothing;
  end if;
  if v_launches >= 10 then
    insert into public.orbitx_achievements (wallet, achievement_id) values (p_wallet, 'ten_launches') on conflict do nothing;
  end if;
  if v_graduated >= 1 then
    insert into public.orbitx_achievements (wallet, achievement_id) values (p_wallet, 'first_graduate') on conflict do nothing;
  end if;
  if v_graduated >= 3 then
    insert into public.orbitx_achievements (wallet, achievement_id) values (p_wallet, 'verified_builder') on conflict do nothing;
  end if;
  if v_launches >= 1 and coalesce(v_best_flagged, false) = false then
    insert into public.orbitx_achievements (wallet, achievement_id) values (p_wallet, 'original_creator') on conflict do nothing;
  end if;

  return query select achievement_id from public.orbitx_achievements where wallet = p_wallet;
end $$;
grant execute on function public.orbitx_sync_achievements(text) to anon, authenticated;

-- Auto-sync on every insert/update to a creator's tokens so achievements
-- unlock live, server-side, the moment the underlying stat is true.
create or replace function public.orbitx_tokens_achievements_trigger()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.orbitx_sync_achievements(new.creator_wallet);
  return new;
end $$;
drop trigger if exists orbitx_tokens_achievements on public.orbitx_tokens;
create trigger orbitx_tokens_achievements
  after insert or update of lp_pool_address, graduated_at, is_vamp on public.orbitx_tokens
  for each row execute function public.orbitx_tokens_achievements_trigger();

-- ═══════════════════════════ Referrals ═══════════════════════════
create table if not exists public.orbitx_referral_codes (
  wallet text primary key,
  code text not null unique,
  created_at timestamptz not null default now()
);
alter table public.orbitx_referral_codes enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='orbitx_referral_codes' and policyname='orbitx_referral_codes_read_all') then
    create policy orbitx_referral_codes_read_all on public.orbitx_referral_codes for select using (true);
  end if;
end $$;

create table if not exists public.orbitx_referrals (
  referred_wallet text primary key,
  referrer_wallet text not null,
  created_at timestamptz not null default now(),
  constraint orbitx_referrals_no_self check (referred_wallet <> referrer_wallet)
);
alter table public.orbitx_referrals enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='orbitx_referrals' and policyname='orbitx_referrals_read_all') then
    create policy orbitx_referrals_read_all on public.orbitx_referrals for select using (true);
  end if;
end $$;

create table if not exists public.orbitx_referral_earnings (
  id uuid primary key default gen_random_uuid(),
  referrer_wallet text not null,
  source_wallet text not null,
  mint_address text,
  amount_usd numeric not null check (amount_usd >= 0),
  created_at timestamptz not null default now()
);
alter table public.orbitx_referral_earnings enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='orbitx_referral_earnings' and policyname='orbitx_referral_earnings_read_all') then
    create policy orbitx_referral_earnings_read_all on public.orbitx_referral_earnings for select using (true);
  end if;
end $$;
create index if not exists orbitx_referral_earnings_referrer_idx on public.orbitx_referral_earnings (referrer_wallet);

create or replace function public.orbitx_get_or_create_referral_code(p_wallet text)
returns text
language plpgsql security definer set search_path = '' as $$
declare v_code text;
begin
  select code into v_code from public.orbitx_referral_codes where wallet = p_wallet;
  if v_code is not null then return v_code; end if;
  loop
    v_code := upper(substr(md5(p_wallet || clock_timestamp()::text || random()::text), 1, 8));
    begin
      insert into public.orbitx_referral_codes (wallet, code) values (p_wallet, v_code);
      exit;
    exception when unique_violation then
      -- code collision, retry
    end;
  end loop;
  return v_code;
end $$;
grant execute on function public.orbitx_get_or_create_referral_code(text) to anon, authenticated;

create or replace function public.orbitx_redeem_referral_code(p_new_wallet text, p_code text)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_referrer text;
begin
  if p_new_wallet is null or p_code is null or trim(p_code) = '' then return false; end if;
  select wallet into v_referrer from public.orbitx_referral_codes where code = upper(trim(p_code));
  if v_referrer is null or v_referrer = p_new_wallet then return false; end if;
  if exists (select 1 from public.orbitx_referrals where referred_wallet = p_new_wallet) then return false; end if;
  insert into public.orbitx_referrals (referred_wallet, referrer_wallet) values (p_new_wallet, v_referrer);
  return true;
exception when unique_violation then
  return false;
end $$;
grant execute on function public.orbitx_redeem_referral_code(text, text) to anon, authenticated;

-- Called right after a referred wallet's token registers; credits the
-- referrer a share of that real launch fee (amount computed client-side
-- from the actual fee paid, passed in — this ledger is a record of real
-- launches, not a simulated number).
create or replace function public.orbitx_record_referral_earning(p_source_wallet text, p_mint text, p_launch_fee_usd numeric)
returns numeric
language plpgsql security definer set search_path = '' as $$
declare
  v_referrer text;
  v_bonus numeric;
begin
  select referrer_wallet into v_referrer from public.orbitx_referrals where referred_wallet = p_source_wallet;
  if v_referrer is null or p_launch_fee_usd is null or p_launch_fee_usd <= 0 then return 0; end if;
  v_bonus := round(p_launch_fee_usd * 0.10, 4); -- 10% of the launch fee, in USD
  insert into public.orbitx_referral_earnings (referrer_wallet, source_wallet, mint_address, amount_usd)
    values (v_referrer, p_source_wallet, p_mint, v_bonus);
  return v_bonus;
end $$;
grant execute on function public.orbitx_record_referral_earning(text, text, numeric) to anon, authenticated;

-- ═══════════════════════════ NFT registry (schema for NFT Hub v2) ═══════════════════════════
-- Mirrors orbitx_tokens' registry pattern so on-chain NFT/collection creation
-- has somewhere real to register into as soon as the mint-program integration
-- ships. Not yet written to by any UI flow (NFT Hub v1 is read-only, wallet-
-- owned NFTs via Helius) -- this is the schema half of that follow-up, live
-- and ready now rather than retrofitted later.
create table if not exists public.orbitx_nft_collections (
  id uuid primary key default gen_random_uuid(),
  creator_wallet text not null,
  name text not null,
  symbol text not null,
  description text,
  banner_url text,
  logo_url text,
  royalty_bps integer not null default 500 check (royalty_bps between 0 and 10000),
  mint_price_sol numeric not null default 0,
  mint_limit integer,
  created_at timestamptz not null default now()
);
alter table public.orbitx_nft_collections enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='orbitx_nft_collections' and policyname='orbitx_nft_collections_read_all') then
    create policy orbitx_nft_collections_read_all on public.orbitx_nft_collections for select using (true);
  end if;
end $$;
create index if not exists orbitx_nft_collections_creator_idx on public.orbitx_nft_collections (creator_wallet);

create table if not exists public.orbitx_nfts (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid references public.orbitx_nft_collections(id) on delete set null,
  mint_address text not null,
  creator_wallet text not null,
  name text not null,
  symbol text,
  image_url text,
  metadata_uri text,
  royalty_bps integer not null default 0 check (royalty_bps between 0 and 10000),
  cluster text not null default 'mainnet-beta',
  created_at timestamptz not null default now()
);
alter table public.orbitx_nfts enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='orbitx_nfts' and policyname='orbitx_nfts_read_all') then
    create policy orbitx_nfts_read_all on public.orbitx_nfts for select using (true);
  end if;
end $$;
create unique index if not exists orbitx_nfts_mint_key on public.orbitx_nfts (mint_address);
create index if not exists orbitx_nfts_creator_idx on public.orbitx_nfts (creator_wallet);

create or replace function public.orbitx_register_nft_collection(
  p_creator_wallet text, p_name text, p_symbol text, p_description text,
  p_banner_url text, p_logo_url text, p_royalty_bps integer, p_mint_price_sol numeric, p_mint_limit integer
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  insert into public.orbitx_nft_collections
    (creator_wallet, name, symbol, description, banner_url, logo_url, royalty_bps, mint_price_sol, mint_limit)
  values
    (p_creator_wallet, p_name, p_symbol, nullif(p_description,''), nullif(p_banner_url,''), nullif(p_logo_url,''),
     coalesce(p_royalty_bps, 500), coalesce(p_mint_price_sol, 0), p_mint_limit)
  returning id into v_id;
  return v_id;
end $$;
grant execute on function public.orbitx_register_nft_collection(text,text,text,text,text,text,integer,numeric,integer) to anon, authenticated;

create or replace function public.orbitx_register_nft(
  p_collection_id uuid, p_mint_address text, p_creator_wallet text, p_name text,
  p_symbol text, p_image_url text, p_metadata_uri text, p_royalty_bps integer
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  insert into public.orbitx_nfts
    (collection_id, mint_address, creator_wallet, name, symbol, image_url, metadata_uri, royalty_bps)
  values
    (p_collection_id, p_mint_address, p_creator_wallet, p_name, nullif(p_symbol,''),
     nullif(p_image_url,''), nullif(p_metadata_uri,''), coalesce(p_royalty_bps, 0))
  returning id into v_id;
  return v_id;
end $$;
grant execute on function public.orbitx_register_nft(uuid,text,text,text,text,text,text,integer) to anon, authenticated;
