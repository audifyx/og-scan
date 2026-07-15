-- Orbitx Launchpad token registry (anti-vamp backed).
-- Backs web/src/lib/orbitx/registry.ts: unique CA / normalized name / normalized
-- ticker at the DB level + orbitx_vamp_check RPC for look-alike detection.
-- Idempotent: safe if the table already exists in the live project.

create extension if not exists pg_trgm;

create table if not exists public.orbitx_tokens (
  id uuid primary key default gen_random_uuid(),
  mint_address text not null,
  name text not null,
  ticker text not null,
  creator_wallet text not null,
  decimals integer not null default 9,
  supply numeric not null default 0,
  dex text,
  lp_pool_address text,
  lp_signature text,
  mint_signature text,
  metadata_uri text,
  logo_url text,
  is_vamp boolean not null default false,
  fee_route text not null default 'creator' check (fee_route in ('creator','orbitx_buyback','og')),
  cluster text not null default 'mainnet-beta',
  launch_type text not null default 'custom' check (launch_type in ('custom','pump')),
  created_at timestamptz not null default now()
);

-- Leetspeak-normalized identity (anti-vamp): lowercase, strip non-alnum,
-- map common substitutions so "0RB1T" == "orbit".
create or replace function public.orbitx_normalize(txt text)
returns text
language sql immutable
set search_path = ''
as $$
  select translate(regexp_replace(lower(coalesce(txt, '')), '[^a-z0-9]', '', 'g'),
                   '013457$', 'oleast');
$$;

create unique index if not exists orbitx_tokens_mint_key on public.orbitx_tokens (mint_address);
create unique index if not exists orbitx_tokens_norm_name_key on public.orbitx_tokens (public.orbitx_normalize(name));
create unique index if not exists orbitx_tokens_norm_ticker_key on public.orbitx_tokens (public.orbitx_normalize(ticker));
create index if not exists orbitx_tokens_creator_idx on public.orbitx_tokens (creator_wallet);
create index if not exists orbitx_tokens_created_idx on public.orbitx_tokens (created_at desc);
create index if not exists orbitx_tokens_name_trgm_idx on public.orbitx_tokens using gin (name gin_trgm_ops);
create index if not exists orbitx_tokens_ticker_trgm_idx on public.orbitx_tokens using gin (ticker gin_trgm_ops);

-- Look-alike (vamp) pre-check: normalized exact hits OR trigram similarity.
create or replace function public.orbitx_vamp_check(p_name text, p_ticker text)
returns table (id uuid, name text, ticker text, mint_address text, is_vamp boolean, sim real)
language sql stable
set search_path = ''
as $$
  select t.id, t.name, t.ticker, t.mint_address, t.is_vamp,
         greatest(
           similarity(lower(t.name), lower(coalesce(p_name, ''))),
           similarity(lower(t.ticker), lower(coalesce(p_ticker, ''))),
           case when public.orbitx_normalize(t.name) = public.orbitx_normalize(p_name)
                  or public.orbitx_normalize(t.ticker) = public.orbitx_normalize(p_ticker)
                then 1.0 else 0.0 end
         )::real as sim
  from public.orbitx_tokens t
  where public.orbitx_normalize(t.name) = public.orbitx_normalize(p_name)
     or public.orbitx_normalize(t.ticker) = public.orbitx_normalize(p_ticker)
     or similarity(lower(t.name), lower(coalesce(p_name, ''))) >= 0.55
     or similarity(lower(t.ticker), lower(coalesce(p_ticker, ''))) >= 0.55
  order by sim desc
  limit 20;
$$;

alter table public.orbitx_tokens enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'orbitx_tokens' and policyname = 'orbitx_tokens_read_all') then
    create policy orbitx_tokens_read_all on public.orbitx_tokens for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'orbitx_tokens' and policyname = 'orbitx_tokens_insert_all') then
    create policy orbitx_tokens_insert_all on public.orbitx_tokens for insert with check (true);
  end if;
end $$;

grant execute on function public.orbitx_vamp_check(text, text) to anon, authenticated;
