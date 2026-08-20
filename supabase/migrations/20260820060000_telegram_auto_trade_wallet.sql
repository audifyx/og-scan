-- Dedicated Telegram auto-buy wallet (server-signed Jupiter swaps).
-- Toggle lives on MCP dashboard /telegram. Secrets are AES-GCM blobs;
-- the wrap key is TELEGRAM_AUTO_TRADE_KEY (or service role) on Vercel.

create table if not exists public.telegram_auto_trade_wallets (
  user_id uuid primary key references auth.users (id) on delete cascade,
  public_key text not null,
  secret_cipher text not null,
  secret_iv text not null,
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.telegram_auto_trade_wallets is
  'Per-user hot wallet for official-bot auto-buy. API (service role) only — never expose secret_cipher to the client.';

create unique index if not exists telegram_auto_trade_wallets_public_key_idx
  on public.telegram_auto_trade_wallets (public_key);

alter table public.telegram_auto_trade_wallets enable row level security;

revoke all on public.telegram_auto_trade_wallets from anon, authenticated;

comment on column public.telegram_orbitx_links.auto_buy is
  'When true, official bot /buy executes immediately from telegram_auto_trade_wallets (no Sign link). Fund that wallet from the MCP dashboard.';
