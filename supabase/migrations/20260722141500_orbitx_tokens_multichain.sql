-- Multi-chain token registry: EVM direct-deploy launches land in the same
-- orbitx_tokens table the launchpad already reads.
alter table public.orbitx_tokens add column if not exists chain text not null default 'solana';
alter table public.orbitx_tokens add column if not exists chain_tx_hash text;
create index if not exists idx_orbitx_tokens_chain on public.orbitx_tokens(chain);
