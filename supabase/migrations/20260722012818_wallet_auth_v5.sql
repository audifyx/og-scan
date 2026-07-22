-- OrbitX v5 — wallet-native auth (Sign-In-With-Solana) + one-time account merge.
--
-- Strategy: wallet login issues a real Supabase session bound to an auth user
-- keyed to the wallet. This preserves auth.uid() so ALL existing RLS, profiles,
-- and features keep working unchanged — the wallet just becomes how you get a
-- session. First-time users can merge a legacy email/password account: every
-- row keyed on user_id is repointed to the wallet's user_id.
create extension if not exists pgcrypto;

create table if not exists public.wallet_identities (
  wallet     text primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create unique index if not exists uq_wallet_identities_user on public.wallet_identities(user_id);
alter table public.wallet_identities enable row level security;
drop policy if exists wallet_identities_read on public.wallet_identities;
create policy wallet_identities_read on public.wallet_identities for select using (true);

-- short-lived sign-in nonces (service role only; RLS on, no public policy)
create table if not exists public.wallet_auth_nonces (
  pubkey     text primary key,
  nonce      text not null,
  expires_at timestamptz not null
);
alter table public.wallet_auth_nonces enable row level security;

-- Dynamic, defensive merge: repoint every public.user_id row from old -> new.
-- profiles handled specially (backfill then drop old). One failing table never
-- aborts the whole merge; conflicts fall back to keeping the new user's rows.
create or replace function public.orbitx_merge_user_data(p_old uuid, p_new uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r record; moved int; total int := 0; notes text[] := '{}';
  v_old_username text; v_new_username text;
begin
  if p_old is null or p_new is null or p_old = p_new then
    return jsonb_build_object('ok', false, 'error', 'invalid ids');
  end if;

  -- profiles: backfill non-unique fields onto the new profile, free the old username, drop old
  begin
    select username into v_old_username from public.profiles where user_id = p_old;
    select username into v_new_username from public.profiles where user_id = p_new;
    update public.profiles n set
      avatar_url   = coalesce(n.avatar_url, o.avatar_url),
      banner_url   = coalesce(n.banner_url, o.banner_url),
      display_name = coalesce(n.display_name, o.display_name)
    from public.profiles o where n.user_id = p_new and o.user_id = p_old;
    delete from public.profiles where user_id = p_old;
    if v_new_username is null and v_old_username is not null then
      update public.profiles set username = v_old_username where user_id = p_new;
    end if;
    notes := notes || 'profiles:merged';
  exception when others then
    notes := notes || 'profiles:skip';
  end;

  for r in
    select c.table_name
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema and t.table_name = c.table_name and t.table_type = 'BASE TABLE'
    where c.table_schema = 'public' and c.column_name = 'user_id'
      and c.table_name not in ('wallet_identities', 'profiles')
  loop
    begin
      execute format('update public.%I set user_id = $1 where user_id = $2', r.table_name) using p_new, p_old;
      get diagnostics moved = row_count;
      total := total + moved;
    exception when others then
      begin
        execute format('delete from public.%I where user_id = $1', r.table_name) using p_old;
        notes := notes || (r.table_name || ':fallback_delete');
      exception when others then
        notes := notes || (r.table_name || ':skip');
      end;
    end;
  end loop;

  return jsonb_build_object('ok', true, 'rows_moved', total, 'notes', to_jsonb(notes));
end $$;

revoke all on function public.orbitx_merge_user_data(uuid, uuid) from public, anon, authenticated;
