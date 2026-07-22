-- OrbitX v9 — one pump.fun coin per collection + USDC listings.
alter table public.orbitx_nft_collections add column if not exists coin_mint text;

create or replace function public.orbitx_set_collection_coin(p_collection_id uuid, p_coin_mint text, p_creator text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_creator text;
begin
  select creator_wallet into v_creator from public.orbitx_nft_collections where id = p_collection_id;
  if v_creator is null then raise exception 'collection not found'; end if;
  if v_creator is distinct from p_creator then raise exception 'only the creator can set the coin'; end if;
  update public.orbitx_nft_collections set coin_mint = p_coin_mint where id = p_collection_id;
  return true;
end $$;
grant execute on function public.orbitx_set_collection_coin(uuid, text, text) to anon, authenticated;

-- USDC listing support
alter table public.orbitx_nft_listings add column if not exists currency text not null default 'SOL';

drop function if exists public.orbitx_nft_list(uuid, text, numeric);
create or replace function public.orbitx_nft_list(p_nft_id uuid, p_seller_wallet text, p_price_sol numeric, p_currency text default 'SOL')
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_owner text;
begin
  select current_owner into v_owner from public.orbitx_nfts where id = p_nft_id;
  if v_owner is distinct from p_seller_wallet then raise exception 'Only the current owner can list this NFT'; end if;
  update public.orbitx_nft_listings set status = 'cancelled', updated_at = now() where nft_id = p_nft_id and status = 'active';
  insert into public.orbitx_nft_listings (nft_id, seller_wallet, price_sol, currency)
    values (p_nft_id, p_seller_wallet, p_price_sol, coalesce(p_currency, 'SOL')) returning id into v_id;
  update public.orbitx_nfts set status = 'listed' where id = p_nft_id;
  return v_id;
end $$;
grant execute on function public.orbitx_nft_list(uuid, text, numeric, text) to anon, authenticated;
