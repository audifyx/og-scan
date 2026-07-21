-- OrbitX Launchpad — per-token community chat (SocialFi). Wallet-native: posting
-- requires a connected wallet (client supplies its address). Public read.
create table if not exists public.orbitx_token_chat (
  id uuid primary key default gen_random_uuid(),
  mint text not null,
  wallet text not null,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists orbitx_token_chat_mint_idx on public.orbitx_token_chat (mint, created_at);

alter table public.orbitx_token_chat enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='orbitx_token_chat' and policyname='orbitx_token_chat_read_all') then
    create policy orbitx_token_chat_read_all on public.orbitx_token_chat for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='orbitx_token_chat' and policyname='orbitx_token_chat_insert_all') then
    create policy orbitx_token_chat_insert_all on public.orbitx_token_chat for insert with check (char_length(body) between 1 and 500);
  end if;
end $$;

-- enable realtime (idempotent)
do $$ begin
  alter publication supabase_realtime add table public.orbitx_token_chat;
exception when duplicate_object then null; when others then null;
end $$;
