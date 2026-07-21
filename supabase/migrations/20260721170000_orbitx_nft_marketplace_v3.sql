-- OrbitX NFT Hub v3 — rarity, fraud/copy detection, offers, auctions, and the
-- schema needed for atomic delegated-authority settlement (see the
-- nft-execute-sale edge function). No function here moves SOL or NFT
-- ownership directly -- that only ever happens through a real, signed
-- on-chain transaction; these RPCs manage negotiation/bidding state and
-- record settlements after the chain confirms them.

-- ═══════════════════════════ Rarity + fraud fields ═══════════════════════════
alter table public.orbitx_nfts
  add column if not exists attributes jsonb not null default '[]'::jsonb,
  add column if not exists content_hash text,
  add column if not exists rarity_rank integer,
  add column if not exists rarity_score numeric,
  add column if not exists rarity_tier text check (rarity_tier in ('Common','Rare','Epic','Legendary','Mythic')),
  add column if not exists is_flagged_duplicate boolean not null default false,
  add column if not exists delegate_approved boolean not null default false;

create index if not exists orbitx_nfts_content_hash_idx on public.orbitx_nfts (content_hash) where content_hash is not null;

create or replace function public.orbitx_register_nft(
  p_collection_id uuid, p_mint_address text, p_creator_wallet text, p_name text,
  p_symbol text, p_image_url text, p_metadata_uri text, p_royalty_bps integer,
  p_attributes jsonb, p_content_hash text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_dupe boolean;
begin
  select exists(
    select 1 from public.orbitx_nfts where content_hash = p_content_hash and p_content_hash is not null
  ) into v_dupe;

  insert into public.orbitx_nfts
    (collection_id, mint_address, creator_wallet, current_owner, name, symbol, image_url, metadata_uri, royalty_bps, attributes, content_hash, is_flagged_duplicate)
  values
    (p_collection_id, p_mint_address, p_creator_wallet, p_creator_wallet, p_name, nullif(p_symbol,''),
     nullif(p_image_url,''), nullif(p_metadata_uri,''), coalesce(p_royalty_bps, 0), coalesce(p_attributes, '[]'::jsonb),
     nullif(p_content_hash,''), coalesce(v_dupe, false))
  returning id into v_id;

  if p_collection_id is not null then
    perform public.orbitx_compute_rarity(p_collection_id);
  end if;
  return v_id;
end $$;
grant execute on function public.orbitx_register_nft(uuid,text,text,text,text,text,text,integer,jsonb,text) to anon, authenticated;
drop function if exists public.orbitx_register_nft(uuid,text,text,text,text,text,text,integer);

-- Trait-frequency rarity score (classic "statistical rarity": sum of
-- 1 / (trait_value frequency within the collection) across every trait),
-- ranked, then bucketed into tiers by percentile. Recomputed for the whole
-- collection whenever a member NFT is added, so ranks stay correct.
create or replace function public.orbitx_compute_rarity(p_collection_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_total integer;
begin
  select count(*) into v_total from public.orbitx_nfts where collection_id = p_collection_id;
  if v_total = 0 then return; end if;

  with trait_freq as (
    select (attr->>'trait_type') as trait_type, (attr->>'value') as value, count(*) as cnt
    from public.orbitx_nfts, jsonb_array_elements(attributes) as attr
    where collection_id = p_collection_id
    group by 1, 2
  ),
  nft_scores as (
    select n.id,
      coalesce(sum(1.0 / greatest(tf.cnt, 1)), 0) as score
    from public.orbitx_nfts n
    left join jsonb_array_elements(n.attributes) as attr on true
    left join trait_freq tf on tf.trait_type = (attr->>'trait_type') and tf.value = (attr->>'value')
    where n.collection_id = p_collection_id
    group by n.id
  ),
  ranked as (
    select id, score, rank() over (order by score desc) as rnk,
      percent_rank() over (order by score desc) as pct
    from nft_scores
  )
  update public.orbitx_nfts n
  set rarity_score = r.score,
      rarity_rank = r.rnk,
      rarity_tier = case
        when r.pct <= 0.01 then 'Mythic'
        when r.pct <= 0.05 then 'Legendary'
        when r.pct <= 0.20 then 'Epic'
        when r.pct <= 0.50 then 'Rare'
        else 'Common'
      end
  from ranked r
  where n.id = r.id;
end $$;
grant execute on function public.orbitx_compute_rarity(uuid) to anon, authenticated;

-- Collection name/symbol originality check -- same trigram-similarity
-- approach as the token launchpad's anti-vamp system, applied to NFT
-- collections so copycat collections get flagged the same way.
create or replace function public.orbitx_nft_collection_check(p_name text, p_symbol text)
returns table (id uuid, name text, symbol text, sim real)
language sql stable set search_path = '' as $$
  select c.id, c.name, c.symbol,
    greatest(
      public.similarity(lower(c.name), lower(coalesce(p_name, ''))),
      public.similarity(lower(c.symbol), lower(coalesce(p_symbol, ''))),
      case when regexp_replace(lower(translate(c.name, '0134$5','oleass')), '[^a-z0-9]', '', 'g')
                = regexp_replace(lower(translate(coalesce(p_name,''), '0134$5','oleass')), '[^a-z0-9]', '', 'g')
             or regexp_replace(lower(translate(c.symbol, '0134$5','oleass')), '[^a-z0-9]', '', 'g')
                = regexp_replace(lower(translate(coalesce(p_symbol,''), '0134$5','oleass')), '[^a-z0-9]', '', 'g')
           then 1.0 else 0.0 end
    )::real as sim
  from public.orbitx_nft_collections c
  where regexp_replace(lower(translate(c.name, '0134$5','oleass')), '[^a-z0-9]', '', 'g')
        = regexp_replace(lower(translate(coalesce(p_name,''), '0134$5','oleass')), '[^a-z0-9]', '', 'g')
     or regexp_replace(lower(translate(c.symbol, '0134$5','oleass')), '[^a-z0-9]', '', 'g')
        = regexp_replace(lower(translate(coalesce(p_symbol,''), '0134$5','oleass')), '[^a-z0-9]', '', 'g')
     or public.similarity(lower(c.name), lower(coalesce(p_name, ''))) >= 0.55
     or public.similarity(lower(c.symbol), lower(coalesce(p_symbol, ''))) >= 0.55
  order by sim desc
  limit 10;
$$;
grant execute on function public.orbitx_nft_collection_check(text, text) to anon, authenticated;

-- Duplicate-artwork check by exact file hash (SHA-256 of the uploaded bytes,
-- computed client-side before upload). Catches literal re-uploads of the
-- same file; it will not catch resized/cropped/re-encoded copies -- that
-- needs perceptual hashing, a separate follow-up.
create or replace function public.orbitx_nft_content_check(p_content_hash text)
returns table (id uuid, name text, mint_address text, creator_wallet text)
language sql stable set search_path = '' as $$
  select id, name, mint_address, creator_wallet from public.orbitx_nfts
  where content_hash = p_content_hash and p_content_hash is not null
  limit 10;
$$;
grant execute on function public.orbitx_nft_content_check(text) to anon, authenticated;

-- ═══════════════════════════ Offers ═══════════════════════════
create table if not exists public.orbitx_nft_offers (
  id uuid primary key default gen_random_uuid(),
  nft_id uuid not null references public.orbitx_nfts(id) on delete cascade,
  buyer_wallet text not null,
  price_sol numeric not null check (price_sol > 0),
  status text not null default 'active' check (status in ('active','accepted','rejected','cancelled','expired','settled')),
  created_at timestamptz not null default now(),
  expires_at timestamptz
);
alter table public.orbitx_nft_offers enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='orbitx_nft_offers' and policyname='orbitx_nft_offers_read_all') then
    create policy orbitx_nft_offers_read_all on public.orbitx_nft_offers for select using (true);
  end if;
end $$;
create index if not exists orbitx_nft_offers_nft_idx on public.orbitx_nft_offers (nft_id) where status = 'active';

create or replace function public.orbitx_nft_make_offer(p_nft_id uuid, p_buyer_wallet text, p_price_sol numeric, p_expires_hours integer)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  insert into public.orbitx_nft_offers (nft_id, buyer_wallet, price_sol, expires_at)
    values (p_nft_id, p_buyer_wallet, p_price_sol, case when p_expires_hours is not null then now() + (p_expires_hours || ' hours')::interval else null end)
    returning id into v_id;
  return v_id;
end $$;
grant execute on function public.orbitx_nft_make_offer(uuid, text, numeric, integer) to anon, authenticated;

create or replace function public.orbitx_nft_cancel_offer(p_offer_id uuid, p_buyer_wallet text)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.orbitx_nft_offers set status = 'cancelled'
    where id = p_offer_id and buyer_wallet = p_buyer_wallet and status = 'active';
end $$;
grant execute on function public.orbitx_nft_cancel_offer(uuid, text) to anon, authenticated;

create or replace function public.orbitx_nft_respond_offer(p_offer_id uuid, p_seller_wallet text, p_accept boolean)
returns void
language plpgsql security definer set search_path = '' as $$
declare v_owner text;
begin
  select current_owner into v_owner from public.orbitx_nfts n join public.orbitx_nft_offers o on o.nft_id = n.id where o.id = p_offer_id;
  if v_owner is distinct from p_seller_wallet then raise exception 'Only the current owner can respond to offers'; end if;
  update public.orbitx_nft_offers set status = case when p_accept then 'accepted' else 'rejected' end
    where id = p_offer_id and status = 'active';
end $$;
grant execute on function public.orbitx_nft_respond_offer(uuid, text, boolean) to anon, authenticated;

-- ═══════════════════════════ Auctions ═══════════════════════════
create table if not exists public.orbitx_nft_auctions (
  id uuid primary key default gen_random_uuid(),
  nft_id uuid not null references public.orbitx_nfts(id) on delete cascade,
  seller_wallet text not null,
  start_price_sol numeric not null check (start_price_sol > 0),
  min_increment_sol numeric not null default 0.05,
  highest_bid_sol numeric,
  highest_bidder text,
  ends_at timestamptz not null,
  status text not null default 'active' check (status in ('active','ended','settled','cancelled')),
  created_at timestamptz not null default now()
);
alter table public.orbitx_nft_auctions enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='orbitx_nft_auctions' and policyname='orbitx_nft_auctions_read_all') then
    create policy orbitx_nft_auctions_read_all on public.orbitx_nft_auctions for select using (true);
  end if;
end $$;

create table if not exists public.orbitx_nft_auction_bids (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid not null references public.orbitx_nft_auctions(id) on delete cascade,
  bidder_wallet text not null,
  amount_sol numeric not null,
  created_at timestamptz not null default now()
);
alter table public.orbitx_nft_auction_bids enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='orbitx_nft_auction_bids' and policyname='orbitx_nft_auction_bids_read_all') then
    create policy orbitx_nft_auction_bids_read_all on public.orbitx_nft_auction_bids for select using (true);
  end if;
end $$;
create index if not exists orbitx_nft_auction_bids_auction_idx on public.orbitx_nft_auction_bids (auction_id);

create or replace function public.orbitx_nft_create_auction(p_nft_id uuid, p_seller_wallet text, p_start_price_sol numeric, p_min_increment_sol numeric, p_duration_hours numeric)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_owner text;
begin
  select current_owner into v_owner from public.orbitx_nfts where id = p_nft_id;
  if v_owner is distinct from p_seller_wallet then raise exception 'Only the current owner can auction this NFT'; end if;
  insert into public.orbitx_nft_auctions (nft_id, seller_wallet, start_price_sol, min_increment_sol, ends_at)
    values (p_nft_id, p_seller_wallet, p_start_price_sol, coalesce(p_min_increment_sol, 0.05), now() + make_interval(hours => p_duration_hours))
    returning id into v_id;
  update public.orbitx_nfts set status = 'listed' where id = p_nft_id;
  return v_id;
end $$;
grant execute on function public.orbitx_nft_create_auction(uuid, text, numeric, numeric, numeric) to anon, authenticated;

create or replace function public.orbitx_nft_place_bid(p_auction_id uuid, p_bidder_wallet text, p_amount_sol numeric)
returns void
language plpgsql security definer set search_path = '' as $$
declare v_auction record;
begin
  select * into v_auction from public.orbitx_nft_auctions where id = p_auction_id for update;
  if v_auction.status <> 'active' then raise exception 'Auction is not active'; end if;
  if now() >= v_auction.ends_at then raise exception 'Auction has ended'; end if;
  if p_amount_sol < v_auction.start_price_sol then raise exception 'Bid below starting price'; end if;
  if v_auction.highest_bid_sol is not null and p_amount_sol < v_auction.highest_bid_sol + v_auction.min_increment_sol then
    raise exception 'Bid must be at least % SOL', v_auction.highest_bid_sol + v_auction.min_increment_sol;
  end if;
  insert into public.orbitx_nft_auction_bids (auction_id, bidder_wallet, amount_sol) values (p_auction_id, p_bidder_wallet, p_amount_sol);
  update public.orbitx_nft_auctions set highest_bid_sol = p_amount_sol, highest_bidder = p_bidder_wallet where id = p_auction_id;
end $$;
grant execute on function public.orbitx_nft_place_bid(uuid, text, numeric) to anon, authenticated;

create or replace function public.orbitx_nft_close_ended_auctions()
returns void
language sql security definer set search_path = '' as $$
  update public.orbitx_nft_auctions set status = 'ended' where status = 'active' and now() >= ends_at;
$$;
grant execute on function public.orbitx_nft_close_ended_auctions() to anon, authenticated;

-- ═══════════════════════════ Settlement recording ═══════════════════════════
-- Called by the nft-execute-sale edge function ONLY after the atomic on-chain
-- transaction (SOL payment + delegated NFT transfer, one transaction, one
-- signature from the buyer + one from the OrbitX marketplace delegate
-- authority) is confirmed on Solana. This function never moves funds itself
-- -- it just records a settlement that already happened on-chain and updates
-- local state (ownership, listing/offer/auction status).
create or replace function public.orbitx_nft_record_sale(
  p_nft_id uuid, p_buyer_wallet text, p_seller_wallet text, p_creator_wallet text,
  p_amount_sol numeric, p_tx_signature text, p_listing_id uuid, p_offer_id uuid, p_auction_id uuid
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.orbitx_nft_transactions (nft_id, buyer_wallet, seller_wallet, creator_wallet, amount_sol, tx_signature)
    values (p_nft_id, p_buyer_wallet, p_seller_wallet, p_creator_wallet, p_amount_sol, p_tx_signature);

  update public.orbitx_nfts set current_owner = p_buyer_wallet, status = 'unlisted' where id = p_nft_id;

  if p_listing_id is not null then
    update public.orbitx_nft_listings set status = 'sold', updated_at = now() where id = p_listing_id;
  end if;
  if p_offer_id is not null then
    update public.orbitx_nft_offers set status = 'settled' where id = p_offer_id;
  end if;
  if p_auction_id is not null then
    update public.orbitx_nft_auctions set status = 'settled' where id = p_auction_id;
  end if;

  update public.orbitx_nft_collections c set volume_sol = volume_sol + p_amount_sol
    where c.id = (select collection_id from public.orbitx_nfts where id = p_nft_id);
end $$;
-- NOT granted to anon/authenticated -- only the service-role key (used by the
-- edge function, never exposed to the browser) may call this.
revoke all on function public.orbitx_nft_record_sale(uuid,text,text,text,numeric,text,uuid,uuid,uuid) from anon, authenticated;

-- ═══════════════════════════ Pending sale staging (edge function only) ═══════════════════════════
-- The nft-execute-sale edge function is the ONLY writer/reader of this table
-- (via the service-role key, which bypasses RLS -- no anon/authenticated
-- grants at all). It builds the canonical transaction server-side, stages
-- the exact amounts here, and consumes the row exactly once on successful
-- on-chain settlement. Solana's own signature verification (any instruction
-- tampering invalidates the marketplace authority's partial signature)
-- is the real integrity guarantee; this table exists for idempotency and
-- expiry, not as the security boundary itself.
create table if not exists public.orbitx_nft_pending_sales (
  id uuid primary key default gen_random_uuid(),
  nft_id uuid not null references public.orbitx_nfts(id) on delete cascade,
  mode text not null check (mode in ('listing','offer','auction')),
  source_id uuid not null,
  buyer_wallet text not null,
  seller_wallet text not null,
  creator_wallet text not null,
  seller_amount_sol numeric not null,
  creator_amount_sol numeric not null default 0,
  fee_amount_sol numeric not null default 0,
  total_amount_sol numeric not null,
  status text not null default 'pending' check (status in ('pending','consumed','expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '5 minutes'
);
alter table public.orbitx_nft_pending_sales enable row level security;
-- Deliberately no policies -- zero anon/authenticated access. Only the
-- service-role key (edge function) can read/write this table.

-- Marks that the current owner has run the on-chain `approve` (delegate)
-- instruction granting the OrbitX marketplace authority transfer rights over
-- this specific NFT. Purely a DB flag; the actual authority only works if the
-- on-chain approval really happened (a mismatch just makes settlement fail
-- harmlessly, since the transfer instruction would be signed by an authority
-- that was never actually approved on-chain).
create or replace function public.orbitx_nft_set_delegate_approved(p_nft_id uuid, p_wallet text)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.orbitx_nfts set delegate_approved = true
    where id = p_nft_id and current_owner = p_wallet;
end $$;
grant execute on function public.orbitx_nft_set_delegate_approved(uuid, text) to anon, authenticated;
