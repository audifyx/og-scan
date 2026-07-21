-- A collection is itself a real on-chain Metaplex NFT; items reference it by
-- mint address on-chain (collection: {key}). Store that mint address so the
-- Creator Studio can look it up when minting items into an existing collection.
alter table public.orbitx_nft_collections
  add column if not exists mint_address text;
create unique index if not exists orbitx_nft_collections_mint_key
  on public.orbitx_nft_collections (mint_address) where mint_address is not null;

create or replace function public.orbitx_register_nft_collection(
  p_creator_wallet text, p_name text, p_symbol text, p_description text,
  p_banner_url text, p_logo_url text, p_royalty_bps integer, p_mint_price_sol numeric,
  p_mint_limit integer, p_mint_address text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  insert into public.orbitx_nft_collections
    (creator_wallet, name, symbol, description, banner_url, logo_url, royalty_bps, mint_price_sol, mint_limit, mint_address)
  values
    (p_creator_wallet, p_name, p_symbol, nullif(p_description,''), nullif(p_banner_url,''), nullif(p_logo_url,''),
     coalesce(p_royalty_bps, 500), coalesce(p_mint_price_sol, 0), p_mint_limit, p_mint_address)
  returning id into v_id;
  return v_id;
end $$;
grant execute on function public.orbitx_register_nft_collection(text,text,text,text,text,text,integer,numeric,integer,text) to anon, authenticated;

-- Drop the old 9-arg overload now that the 10-arg version above supersedes it.
drop function if exists public.orbitx_register_nft_collection(text,text,text,text,text,text,integer,numeric,integer);
