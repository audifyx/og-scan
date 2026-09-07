/** DDL for ox_calls_* — inlined so Vercel can apply without the migrations folder. */
export const CALLS_PROJECT_REF = "ffjipnkhcebjvttliptb";

export const CALLS_DDL = `
create table if not exists public.ox_calls_desk (
  id text primary key default 'main',
  bot_token text,
  bot_username text,
  bot_id text,
  bot_name text,
  webhook_secret text,
  channel_id text,
  channel_title text,
  channel_username text,
  broadcast_groups boolean not null default true,
  armed boolean not null default false,
  max_calls_per_tick integer not null default 2,
  cooldown_hours numeric not null default 12,
  win_multiple numeric not null default 1.5,
  last_tick_at timestamptz,
  last_agent_id text,
  last_error text,
  last_posted_at timestamptz,
  post_ats jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.ox_calls_desk add column if not exists post_ats jsonb not null default '[]'::jsonb;
insert into public.ox_calls_desk (id) values ('main') on conflict (id) do nothing;
create table if not exists public.ox_calls_chats (
  chat_id text primary key,
  title text,
  username text,
  chat_type text,
  members integer,
  status text not null default 'member',
  is_channel_target boolean not null default false,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create table if not exists public.ox_calls_ledger (
  id uuid primary key default gen_random_uuid(),
  mint text not null,
  symbol text,
  name text,
  url text,
  agent_id text,
  agent_name text,
  thesis text,
  analysis jsonb not null default '{}'::jsonb,
  mc_at_call numeric,
  liq_at_call numeric,
  vol_24h_at_call numeric,
  vol_1h_at_call numeric,
  price_at_call numeric,
  mc_ath numeric,
  mc_atl numeric,
  mc_now numeric,
  price_now numeric,
  ath_at timestamptz,
  atl_at timestamptz,
  multiple_now numeric,
  multiple_ath numeric,
  status text not null default 'open',
  called_at timestamptz not null default now(),
  resolved_at timestamptz,
  telegram_posts jsonb not null default '[]'::jsonb,
  unique (mint, called_at)
);
create index if not exists ox_calls_ledger_called_at_idx on public.ox_calls_ledger (called_at desc);
create index if not exists ox_calls_ledger_mint_idx on public.ox_calls_ledger (mint);
create index if not exists ox_calls_ledger_status_idx on public.ox_calls_ledger (status);
alter table public.ox_calls_desk enable row level security;
alter table public.ox_calls_chats enable row level security;
alter table public.ox_calls_ledger enable row level security;
revoke all on public.ox_calls_desk from anon, authenticated;
revoke all on public.ox_calls_chats from anon, authenticated;
revoke all on public.ox_calls_ledger from anon, authenticated;
grant all on public.ox_calls_desk to service_role;
grant all on public.ox_calls_chats to service_role;
grant all on public.ox_calls_ledger to service_role;
`;
