-- Wallet sign-in nonce storage.
-- The edge function uses the service role to create, read, and delete one
-- short-lived nonce per wallet before verifying a signed login message.
create table if not exists public.wallet_auth_nonces (
  pubkey text primary key,
  nonce text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists wallet_auth_nonces_expires_at_idx
  on public.wallet_auth_nonces (expires_at);

alter table public.wallet_auth_nonces enable row level security;

revoke all on public.wallet_auth_nonces from anon, authenticated;
grant all on public.wallet_auth_nonces to service_role;
