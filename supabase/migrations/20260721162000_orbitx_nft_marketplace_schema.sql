-- OrbitX NFT Hub — marketplace schema completion: collection stats/verification,
-- listings (real DB-tracked "for sale" state), and a transactions ledger ready
-- to receive real settlement records once atomic buy/sell execution ships
-- (Phase 2: Metaplex Auction House or a treasury-signing edge function for the
-- official shop -- neither is wired to money movement yet, so this migration
-- only adds state, not payment logic).

alter table public.orbitx_nft_collections
  add column if not exists verified boolean not null default false,
  add column if not exists floor_price_sol numeric,
  add column if not exists volume_sol numeric not null default 0,
  add column if not exists is_official boolean not null default false;

alter table public.orbitx_nfts
  add column if not exists status text not null default 'unlisted' check (status in ('unlisted', 'listed', 'sold')),
  add column if not exists current_owner text;

update public.orbitx_nfts set current_owner = creator_wallet where current_owner is null;

create table if not exists public.orbitx_nft_listings (
  id uuid primary key default gen_random_uuid(),
  nft_id uuid not null references public.orbitx_nfts(id) on delete cascade,
  seller_wallet text not null,
  price_sol numeric not null check (price_sol > 0),
  status text not null default 'active' check (status in ('active', 'cancelled', 'sold')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.orbitx_nft_listings enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='orbitx_nft_listings' and policyname='orbitx_nft_listings_read_all') then
    create policy orbitx_nft_listings_read_all on public.orbitx_nft_listings for select using (true);
  end if;
end $$;
create index if not exists orbitx_nft_listings_nft_idx on public.orbitx_nft_listings (nft_id) where status = 'active';
create unique index if not exists orbitx_nft_listings_one_active on public.orbitx_nft_listings (nft_id) where status = 'active';

create table if not exists public.orbitx_nft_transactions (
  id uuid primary key default gen_random_uuid(),
  nft_id uuid not null references public.orbitx_nfts(id) on delete cascade,
  buyer_wallet text not null,
  seller_wallet text not null,
  creator_wallet text not null,
  amount_sol numeric not null,
  tx_signature text not null unique,
  created_at timestamptz not null default now()
);
alter table public.orbitx_nft_transactions enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='orbitx_nft_transactions' and policyname='orbitx_nft_transactions_read_all') then
    create policy orbitx_nft_transactions_read_all on public.orbitx_nft_transactions for select using (true);
  end if;
end $$;
create index if not exists orbitx_nft_transactions_nft_idx on public.orbitx_nft_transactions (nft_id);

-- List / cancel are pure state changes (who owns the NFT never moves here) --
-- safe to expose directly, same trust model as the rest of OrbitX's tables.
create or replace function public.orbitx_nft_list(p_nft_id uuid, p_seller_wallet text, p_price_sol numeric)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_owner text;
begin
  select current_owner into v_owner from public.orbitx_nfts where id = p_nft_id;
  if v_owner is distinct from p_seller_wallet then
    raise exception 'Only the current owner can list this NFT';
  end if;
  update public.orbitx_nft_listings set status = 'cancelled', updated_at = now()
    where nft_id = p_nft_id and status = 'active';
  insert into public.orbitx_nft_listings (nft_id, seller_wallet, price_sol) values (p_nft_id, p_seller_wallet, p_price_sol)
    returning id into v_id;
  update public.orbitx_nfts set status = 'listed' where id = p_nft_id;
  return v_id;
end $$;
grant execute on function public.orbitx_nft_list(uuid, text, numeric) to anon, authenticated;

create or replace function public.orbitx_nft_cancel_listing(p_nft_id uuid, p_seller_wallet text)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.orbitx_nft_listings set status = 'cancelled', updated_at = now()
    where nft_id = p_nft_id and status = 'active' and seller_wallet = p_seller_wallet;
  update public.orbitx_nfts set status = 'unlisted' where id = p_nft_id and status = 'listed';
end $$;
grant execute on function public.orbitx_nft_cancel_listing(uuid, text) to anon, authenticated;
