-- Desk shop orders: Jupiter buy $ORBITX + burn, then a copy-paste note to the team.

create table if not exists public.orbitx_shop_orders (
  id uuid primary key default gen_random_uuid(),
  wallet text not null,
  sku text not null,
  item_name text,
  usd numeric,
  sol numeric,
  orbitx_burned numeric,
  signature text not null,
  mint text,
  project_name text,
  ticker text,
  project_details text,
  created_at timestamptz not null default now(),
  unique (signature)
);

create index if not exists orbitx_shop_orders_wallet_idx
  on public.orbitx_shop_orders (wallet, created_at desc);

comment on table public.orbitx_shop_orders is
  'OrbitX /shop buy-and-burn checkouts. Fulfillment is via the copy-paste note to t.me/orbitxwrld.';

alter table public.orbitx_shop_orders enable row level security;

revoke all on public.orbitx_shop_orders from anon, authenticated;
