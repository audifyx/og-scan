-- OrbitX v7 — Phase 5 staff-picks / featured curation.
alter table public.orbitx_nft_collections add column if not exists featured boolean not null default false;
alter table public.orbitx_nft_collections add column if not exists featured_rank integer;

create table if not exists public.orbitx_curators (
  wallet text primary key,
  added_at timestamptz not null default now()
);
insert into public.orbitx_curators(wallet) values ('jYbHk588JspmzG5ibjPpKpCrjNP7epAjBT8Syvu7GUb') on conflict do nothing;
alter table public.orbitx_curators enable row level security;
drop policy if exists orbitx_curators_read on public.orbitx_curators;
create policy orbitx_curators_read on public.orbitx_curators for select using (true);

create or replace function public.orbitx_set_featured(p_wallet text, p_collection uuid, p_featured boolean, p_rank int default null)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.orbitx_curators where wallet = p_wallet) then
    raise exception 'not authorized to curate';
  end if;
  update public.orbitx_nft_collections set featured = p_featured, featured_rank = p_rank where id = p_collection;
  return true;
end $$;
grant execute on function public.orbitx_set_featured(text, uuid, boolean, int) to anon, authenticated;
