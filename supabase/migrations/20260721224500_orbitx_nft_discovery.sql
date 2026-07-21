alter table public.orbitx_nft_collections add column if not exists category text;
alter table public.orbitx_nfts add column if not exists view_count integer not null default 0;
alter table public.orbitx_nfts add column if not exists favorite_count integer not null default 0;

create table if not exists public.orbitx_nft_favorites (
  id uuid primary key default gen_random_uuid(),
  nft_id uuid not null references public.orbitx_nfts(id) on delete cascade,
  wallet text not null,
  created_at timestamptz not null default now(),
  unique (nft_id, wallet)
);
alter table public.orbitx_nft_favorites enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='orbitx_nft_favorites' and policyname='orbitx_nft_favorites_read') then
    create policy orbitx_nft_favorites_read on public.orbitx_nft_favorites for select using (true);
  end if;
end $$;

create or replace function public.orbitx_nft_toggle_favorite(p_nft uuid, p_wallet text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_exists boolean;
begin
  select exists(select 1 from public.orbitx_nft_favorites where nft_id = p_nft and wallet = p_wallet) into v_exists;
  if v_exists then
    delete from public.orbitx_nft_favorites where nft_id = p_nft and wallet = p_wallet;
    update public.orbitx_nfts set favorite_count = greatest(0, favorite_count - 1) where id = p_nft;
    return false;
  else
    insert into public.orbitx_nft_favorites(nft_id, wallet) values (p_nft, p_wallet) on conflict do nothing;
    update public.orbitx_nfts set favorite_count = favorite_count + 1 where id = p_nft;
    return true;
  end if;
end $$;
grant execute on function public.orbitx_nft_toggle_favorite(uuid, text) to anon, authenticated;

create or replace function public.orbitx_nft_increment_view(p_nft uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin update public.orbitx_nfts set view_count = view_count + 1 where id = p_nft; end $$;
grant execute on function public.orbitx_nft_increment_view(uuid) to anon, authenticated;

create index if not exists orbitx_nft_collections_category_idx on public.orbitx_nft_collections (category);
create or replace function public.orbitx_set_collection_category(p_collection_id uuid, p_category text, p_creator text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.orbitx_nft_collections set category = p_category
  where id = p_collection_id and creator_wallet = p_creator;
end $$;
grant execute on function public.orbitx_set_collection_category(uuid, text, text) to anon, authenticated;
