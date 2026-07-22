-- OrbitX NFT Marketplace v4
-- Social layer (Phase 2), Launch Drops (Phase 3), collection analytics
-- snapshots (Phase 4), and the "trade an NFT like a meme coin" market +
-- pump.fun-style creator fee accrual/claim ledger.
--
-- Wallet-native trust model (same as the existing NFT registry): reads are
-- public; writes go through SECURITY DEFINER RPCs so the client never needs a
-- privileged key. Idempotent — safe to re-run.

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────────────────────
-- Phase 2 — social
-- ─────────────────────────────────────────────────────────────
create table if not exists public.orbitx_nft_follows (
  follower_wallet text not null,
  creator_wallet  text not null,
  created_at      timestamptz not null default now(),
  primary key (follower_wallet, creator_wallet),
  check (follower_wallet <> creator_wallet)
);
create index if not exists idx_nft_follows_creator on public.orbitx_nft_follows(creator_wallet);

create table if not exists public.orbitx_nft_likes (
  wallet     text not null,
  nft_id     uuid not null references public.orbitx_nfts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (wallet, nft_id)
);
create index if not exists idx_nft_likes_nft on public.orbitx_nft_likes(nft_id);

create table if not exists public.orbitx_nft_comments (
  id         uuid primary key default gen_random_uuid(),
  nft_id     uuid not null references public.orbitx_nfts(id) on delete cascade,
  wallet     text not null,
  body       text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists idx_nft_comments_nft on public.orbitx_nft_comments(nft_id, created_at desc);

create table if not exists public.orbitx_nft_notifications (
  id         uuid primary key default gen_random_uuid(),
  wallet     text not null,
  kind       text not null,               -- follow | like | comment | offer | sale | drop
  body       text not null,
  link       text,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_nft_notifs_wallet on public.orbitx_nft_notifications(wallet, created_at desc);

-- ─────────────────────────────────────────────────────────────
-- Phase 3 — Launch Drops
-- ─────────────────────────────────────────────────────────────
create table if not exists public.orbitx_nft_drops (
  id               uuid primary key default gen_random_uuid(),
  collection_id    uuid references public.orbitx_nft_collections(id) on delete set null,
  creator_wallet   text not null,
  name             text not null,
  description      text,
  banner_url       text,
  logo_url         text,
  mint_price_sol   numeric not null default 0,
  supply           integer,               -- null = open edition
  minted           integer not null default 0,
  per_wallet_limit integer,               -- null = unlimited
  access           text not null default 'public' check (access in ('public','whitelist','private')),
  starts_at        timestamptz,
  ends_at          timestamptz,
  status           text not null default 'scheduled',
  created_at       timestamptz not null default now()
);
create index if not exists idx_nft_drops_start on public.orbitx_nft_drops(starts_at);

create table if not exists public.orbitx_nft_drop_whitelist (
  drop_id uuid not null references public.orbitx_nft_drops(id) on delete cascade,
  wallet  text not null,
  primary key (drop_id, wallet)
);

-- ─────────────────────────────────────────────────────────────
-- Phase 4 — collection analytics snapshots (daily)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.orbitx_nft_collection_stats_daily (
  collection_id uuid not null references public.orbitx_nft_collections(id) on delete cascade,
  day           date not null,
  floor_sol     numeric,
  volume_sol    numeric not null default 0,
  sales         integer not null default 0,
  holders       integer,
  listed        integer,
  market_cap_sol numeric,
  primary key (collection_id, day)
);

-- ─────────────────────────────────────────────────────────────
-- NFT-as-meme-coin market + pump.fun-style creator fees
-- ─────────────────────────────────────────────────────────────
create table if not exists public.orbitx_nft_coin_markets (
  nft_id           uuid primary key references public.orbitx_nfts(id) on delete cascade,
  mint_address     text not null,
  creator_wallet   text not null,
  enabled          boolean not null default false,
  curve_supply     numeric not null default 0,   -- tokens minted along the curve
  sol_reserves     numeric not null default 0,    -- SOL locked in the curve
  last_price_sol   numeric,
  market_cap_sol   numeric,
  creator_fee_bps  integer not null default 50,   -- 0.50% -> creator (claimable)
  platform_fee_bps integer not null default 50,   -- 0.50% -> OrbitX platform
  graduated        boolean not null default false,
  created_at       timestamptz not null default now()
);

create table if not exists public.orbitx_nft_coin_trades (
  id               uuid primary key default gen_random_uuid(),
  nft_id           uuid not null references public.orbitx_nfts(id) on delete cascade,
  trader_wallet    text not null,
  side             text not null check (side in ('buy','sell')),
  sol_amount       numeric not null,
  token_amount     numeric not null,
  price_sol        numeric,
  creator_fee_sol  numeric not null default 0,
  platform_fee_sol numeric not null default 0,
  tx_signature     text,
  created_at       timestamptz not null default now()
);
create index if not exists idx_nft_coin_trades_nft on public.orbitx_nft_coin_trades(nft_id, created_at desc);

-- Creator-fee ledger: 'accrual' rows add claimable balance, 'claim' rows spend it.
create table if not exists public.orbitx_nft_creator_fee_ledger (
  id             uuid primary key default gen_random_uuid(),
  creator_wallet text not null,
  nft_id         uuid references public.orbitx_nfts(id) on delete set null,
  kind           text not null check (kind in ('accrual','claim')),
  amount_sol     numeric not null check (amount_sol >= 0),
  tx_signature   text,
  created_at     timestamptz not null default now()
);
create index if not exists idx_nft_fee_ledger_wallet on public.orbitx_nft_creator_fee_ledger(creator_wallet, created_at desc);

-- ─────────────────────────────────────────────────────────────
-- RLS: public read on everything; writes only via RPCs below.
-- ─────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'orbitx_nft_follows','orbitx_nft_likes','orbitx_nft_comments','orbitx_nft_notifications',
    'orbitx_nft_drops','orbitx_nft_drop_whitelist','orbitx_nft_collection_stats_daily',
    'orbitx_nft_coin_markets','orbitx_nft_coin_trades','orbitx_nft_creator_fee_ledger'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t||'_read', t);
    execute format('create policy %I on public.%I for select using (true)', t||'_read', t);
  end loop;
end $$;

-- ─────────────────────────────────────────────────────────────
-- RPCs (SECURITY DEFINER)
-- ─────────────────────────────────────────────────────────────
create or replace function public.orbitx_nft_toggle_follow(p_follower text, p_creator text)
returns boolean language plpgsql security definer set search_path = public as $$
declare now_following boolean;
begin
  if p_follower is null or p_creator is null or p_follower = p_creator then
    raise exception 'invalid follow';
  end if;
  if exists (select 1 from orbitx_nft_follows where follower_wallet = p_follower and creator_wallet = p_creator) then
    delete from orbitx_nft_follows where follower_wallet = p_follower and creator_wallet = p_creator;
    now_following := false;
  else
    insert into orbitx_nft_follows(follower_wallet, creator_wallet) values (p_follower, p_creator);
    insert into orbitx_nft_notifications(wallet, kind, body, link)
      values (p_creator, 'follow', left(p_follower,4)||'…'||right(p_follower,4)||' followed you', '/nft/profile/'||p_follower);
    now_following := true;
  end if;
  return now_following;
end $$;

create or replace function public.orbitx_nft_follow_counts(p_wallet text)
returns table(followers bigint, following bigint) language sql security definer set search_path = public as $$
  select
    (select count(*) from orbitx_nft_follows where creator_wallet = p_wallet),
    (select count(*) from orbitx_nft_follows where follower_wallet = p_wallet);
$$;

create or replace function public.orbitx_nft_toggle_like(p_nft_id uuid, p_wallet text)
returns boolean language plpgsql security definer set search_path = public as $$
declare liked boolean;
begin
  if exists (select 1 from orbitx_nft_likes where nft_id = p_nft_id and wallet = p_wallet) then
    delete from orbitx_nft_likes where nft_id = p_nft_id and wallet = p_wallet;
    liked := false;
  else
    insert into orbitx_nft_likes(nft_id, wallet) values (p_nft_id, p_wallet);
    liked := true;
  end if;
  return liked;
end $$;

create or replace function public.orbitx_nft_add_comment(p_nft_id uuid, p_wallet text, p_body text)
returns uuid language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  insert into orbitx_nft_comments(nft_id, wallet, body) values (p_nft_id, p_wallet, p_body) returning id into new_id;
  return new_id;
end $$;

create or replace function public.orbitx_nft_creator_fee_summary(p_wallet text)
returns table(claimable_sol numeric, lifetime_sol numeric, last_claim_at timestamptz)
language sql security definer set search_path = public as $$
  select
    coalesce(sum(case when kind='accrual' then amount_sol else -amount_sol end), 0) as claimable_sol,
    coalesce(sum(case when kind='accrual' then amount_sol else 0 end), 0) as lifetime_sol,
    (select max(created_at) from orbitx_nft_creator_fee_ledger where creator_wallet = p_wallet and kind='claim') as last_claim_at
  from orbitx_nft_creator_fee_ledger where creator_wallet = p_wallet;
$$;

grant execute on function
  public.orbitx_nft_toggle_follow(text,text),
  public.orbitx_nft_follow_counts(text),
  public.orbitx_nft_toggle_like(uuid,text),
  public.orbitx_nft_add_comment(uuid,text,text),
  public.orbitx_nft_creator_fee_summary(text)
to anon, authenticated;
