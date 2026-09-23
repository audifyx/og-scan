-- Same shape as orbitxtrade.world desk wallets.
create table if not exists public.wallet_secrets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  chain text not null default 'solana',
  address text not null,
  ciphertext text not null,
  created_at timestamptz not null default now(),
  unique (user_id, chain)
);
create index if not exists wallet_secrets_user on public.wallet_secrets (user_id);
alter table public.wallet_secrets enable row level security;
