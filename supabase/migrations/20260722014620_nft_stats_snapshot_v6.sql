-- OrbitX v6 — Phase 4 analytics: daily collection stats snapshot + schedule.
create or replace function public.orbitx_snapshot_collection_stats()
returns integer language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into public.orbitx_nft_collection_stats_daily(collection_id, day, floor_sol, volume_sol, sales, holders, listed, market_cap_sol)
  select
    c.id, current_date,
    (select min(l.price_sol) from public.orbitx_nft_listings l join public.orbitx_nfts nn on nn.id = l.nft_id where nn.collection_id = c.id and l.status = 'active'),
    coalesce(c.volume_sol, 0),
    (select count(*) from public.orbitx_nft_transactions t join public.orbitx_nfts nn on nn.id = t.nft_id where nn.collection_id = c.id and t.created_at::date = current_date),
    (select count(distinct nn.current_owner) from public.orbitx_nfts nn where nn.collection_id = c.id),
    (select count(*) from public.orbitx_nft_listings l join public.orbitx_nfts nn on nn.id = l.nft_id where nn.collection_id = c.id and l.status = 'active'),
    coalesce(c.floor_price_sol, 0) * (select count(*) from public.orbitx_nfts nn where nn.collection_id = c.id)
  from public.orbitx_nft_collections c
  on conflict (collection_id, day) do update set
    floor_sol = excluded.floor_sol, volume_sol = excluded.volume_sol, sales = excluded.sales,
    holders = excluded.holders, listed = excluded.listed, market_cap_sol = excluded.market_cap_sol;
  get diagnostics n = row_count;
  return n;
end $$;

grant execute on function public.orbitx_snapshot_collection_stats() to service_role;
