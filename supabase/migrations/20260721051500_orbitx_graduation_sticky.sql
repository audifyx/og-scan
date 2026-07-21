-- Sticky, permanent graduation for OrbitX launchpad tokens.
-- A token graduates when its market cap first reaches the graduation threshold
-- ($35,000, enforced in the app). Once set, graduated_at NEVER clears — even if
-- market cap later falls below the threshold, the token stays graduated forever.
-- Idempotent: safe to re-run against the live project.

alter table public.orbitx_tokens
  add column if not exists graduated_at timestamptz;

create index if not exists orbitx_tokens_graduated_idx
  on public.orbitx_tokens (graduated_at)
  where graduated_at is not null;

-- Backfill: any token that already has a live LP pool is considered graduated.
update public.orbitx_tokens
   set graduated_at = coalesce(graduated_at, created_at)
 where lp_pool_address is not null
   and graduated_at is null;

-- Client RLS only allows select/insert on orbitx_tokens, so this SECURITY DEFINER
-- RPC is the one sanctioned, idempotent way to set graduation. It only ever sets
-- graduated_at when it is currently null, guaranteeing permanence.
create or replace function public.orbitx_mark_graduated(p_mint text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.orbitx_tokens
     set graduated_at = now()
   where mint_address = p_mint
     and graduated_at is null;
$$;

grant execute on function public.orbitx_mark_graduated(text) to anon, authenticated;
