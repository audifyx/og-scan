-- Links a Solana login pubkey to a preferred EVM wallet address.
create table if not exists public.orbitx_wallet_links (
  solana_pubkey text primary key,
  evm_address   text not null,
  evm_rdns      text,
  updated_at    timestamptz not null default now(),
  created_at    timestamptz not null default now()
);
create index if not exists idx_orbitx_wallet_links_evm on public.orbitx_wallet_links(evm_address);

alter table public.orbitx_wallet_links enable row level security;
drop policy if exists "public read wallet links" on public.orbitx_wallet_links;
create policy "public read wallet links" on public.orbitx_wallet_links for select using (true);
drop policy if exists "public upsert wallet links" on public.orbitx_wallet_links;
create policy "public upsert wallet links" on public.orbitx_wallet_links for insert with check (true);
drop policy if exists "public update wallet links" on public.orbitx_wallet_links;
create policy "public update wallet links" on public.orbitx_wallet_links for update using (true) with check (true);
