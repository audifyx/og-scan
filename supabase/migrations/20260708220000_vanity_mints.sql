-- Vanity mint support for the OrbitX / OG Scan token launcher.
--
--  * vanity_mint_pool  — pre-ground keypairs whose address ends with a suffix
--    (needed for long suffixes like "orbit" that can't be ground live).
--  * claim_vanity_mint — atomically hands out ONE unused keypair for a suffix
--    (FOR UPDATE SKIP LOCKED, so concurrent launches never collide).
--  * token_launches    — record of confirmed launches.
--
-- SECURITY: secret_key is sensitive. These tables have RLS enabled with NO
-- public policies, so only the service-role key (server-side) can touch them.

/* ─── Pre-ground vanity keypair pool ─────────────────────────────────── */
create table if not exists public.vanity_mint_pool (
  id           uuid primary key default gen_random_uuid(),
  address      text not null unique,          -- base58 mint pubkey (ends with suffix)
  suffix       text not null,                 -- normalized (lowercase) suffix
  secret_key   jsonb not null,                -- 64-byte secret as JSON array
  claimed_at   timestamptz,                   -- null = available
  created_at   timestamptz not null default now()
);

-- Fast lookup of the next available key for a suffix.
create index if not exists vanity_mint_pool_available_idx
  on public.vanity_mint_pool (suffix)
  where claimed_at is null;

alter table public.vanity_mint_pool enable row level security;
-- No policies → unreachable by anon/authenticated; service role bypasses RLS.

/* ─── Atomic claim RPC ───────────────────────────────────────────────── */
create or replace function public.claim_vanity_mint(p_suffix text)
returns table (address text, secret_key jsonb)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  select id into v_id
  from public.vanity_mint_pool
  where suffix = lower(p_suffix) and claimed_at is null
  order by created_at
  for update skip locked
  limit 1;

  if v_id is null then
    return;  -- pool empty for this suffix
  end if;

  update public.vanity_mint_pool
    set claimed_at = now()
  where id = v_id;

  return query
    select vmp.address, vmp.secret_key
    from public.vanity_mint_pool vmp
    where vmp.id = v_id;
end;
$$;

revoke all on function public.claim_vanity_mint(text) from public, anon, authenticated;

/* ─── Confirmed launch records ───────────────────────────────────────── */
create table if not exists public.token_launches (
  id              uuid primary key default gen_random_uuid(),
  mint_address    text not null unique,
  tx_signature    text not null,
  name            text,
  symbol          text,
  launcher_wallet text,
  metadata_uri    text,
  created_at      timestamptz not null default now()
);

alter table public.token_launches enable row level security;

-- Launches are public info (they're on-chain); allow read, restrict writes to service role.
drop policy if exists token_launches_read on public.token_launches;
create policy token_launches_read on public.token_launches
  for select using (true);
