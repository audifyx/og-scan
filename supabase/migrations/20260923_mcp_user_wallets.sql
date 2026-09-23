-- Per-user MCP trading wallets. Not agent_delegated_wallets.
create table if not exists public.mcp_user_wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  public_key text not null,
  encrypted_secret text not null,
  iv text not null,
  auth_tag text not null,
  revoked boolean not null default false,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists mcp_user_wallets_user_live on public.mcp_user_wallets (user_id, created_at desc) where revoked = false;
alter table public.mcp_user_wallets enable row level security;
