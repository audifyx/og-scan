-- OrbitX Launchpad V2 — launches, flywheel, fee jobs, bagworking.
-- Service role writes via /api/launchpad-v2. RLS on; no public grants.

create table if not exists public.ox_lp_launches (
  id uuid primary key default gen_random_uuid(),
  mint text not null unique,
  creator_wallet text not null,
  user_id uuid,
  name text not null,
  ticker text not null,
  launch_kind text not null check (launch_kind in ('standard', 'flywheel', 'bagworking')),
  lane text not null default 'pump' check (lane in ('pump', 'custom')),
  mint_signature text,
  metadata_uri text,
  bagworking_eligible boolean not null default false,
  auto_fee_claim boolean not null default false,
  status text not null default 'live' check (status in ('pending', 'live', 'failed', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ox_lp_launches_creator_idx on public.ox_lp_launches (creator_wallet, created_at desc);
create index if not exists ox_lp_launches_kind_idx on public.ox_lp_launches (launch_kind, created_at desc);

create table if not exists public.ox_lp_flywheel_configs (
  launch_id uuid primary key references public.ox_lp_launches(id) on delete cascade,
  community_bps int not null,
  buy_burn_bps int not null,
  creator_bps int not null,
  rewards_bps int not null,
  check (community_bps + buy_burn_bps + creator_bps + rewards_bps = 10000),
  check (community_bps >= 0 and buy_burn_bps >= 0 and creator_bps >= 0 and rewards_bps >= 0)
);

create table if not exists public.ox_lp_fee_jobs (
  id uuid primary key default gen_random_uuid(),
  launch_id uuid references public.ox_lp_launches(id) on delete set null,
  creator_wallet text not null,
  mint text,
  threshold_usd numeric not null default 25,
  claimable_sol numeric,
  claimable_usd numeric,
  status text not null default 'pending'
    check (status in ('pending','claiming','claimed','buying','burning','completed','failed','awaiting_creator_sign')),
  claim_signature text,
  buy_signature text,
  burn_signature text,
  error text,
  locked_at timestamptz,
  lock_token text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ox_lp_fee_jobs_open_creator_idx
  on public.ox_lp_fee_jobs (creator_wallet)
  where status in ('pending','claiming','claimed','buying','burning','awaiting_creator_sign');

create table if not exists public.ox_lp_fee_events (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.ox_lp_fee_jobs(id) on delete cascade,
  mint text,
  kind text not null,
  signature text,
  amount_usd numeric,
  amount_sol numeric,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists ox_lp_fee_events_mint_idx on public.ox_lp_fee_events (mint, created_at desc);

create table if not exists public.ox_lp_bagworking_rules (
  id text primary key default 'global',
  short_reward_usd numeric not null default 1.50,
  long_reward_usd numeric not null default 3.00,
  long_min_chars int not null default 200,
  max_posts_per_day int not null default 10,
  require_ticker boolean not null default true,
  require_ca boolean not null default false,
  require_hashtag boolean not null default false,
  replies_count boolean not null default false,
  quotes_count boolean not null default false,
  reposts_count boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into public.ox_lp_bagworking_rules (id) values ('global') on conflict (id) do nothing;

create table if not exists public.ox_lp_campaigns (
  id uuid primary key default gen_random_uuid(),
  mint text not null,
  launch_id uuid references public.ox_lp_launches(id) on delete set null,
  creator_wallet text not null,
  title text,
  status text not null default 'draft'
    check (status in ('draft','active','paused','completed','expired')),
  budget_usd numeric not null default 0,
  spent_usd numeric not null default 0,
  short_reward_usd numeric,
  long_reward_usd numeric,
  max_posts int,
  max_per_user_day int not null default 10,
  required_ticker text,
  required_keywords text[] not null default '{}',
  required_hashtag text,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ox_lp_campaigns_mint_idx on public.ox_lp_campaigns (mint, status);
create index if not exists ox_lp_campaigns_status_idx on public.ox_lp_campaigns (status, ends_at);

create table if not exists public.ox_lp_posts (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.ox_lp_campaigns(id) on delete cascade,
  user_id uuid not null,
  wallet text,
  x_user_id text not null,
  x_username text,
  x_post_id text not null unique,
  post_url text,
  post_text text,
  post_kind text not null check (post_kind in ('short','long')),
  reward_usd numeric not null,
  status text not null default 'verified'
    check (status in ('pending','verified','rejected','paid')),
  reject_reason text,
  created_at timestamptz not null default now()
);

create index if not exists ox_lp_posts_user_day_idx on public.ox_lp_posts (user_id, created_at desc);
create index if not exists ox_lp_posts_campaign_idx on public.ox_lp_posts (campaign_id, created_at desc);

create table if not exists public.ox_lp_rewards (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null unique references public.ox_lp_posts(id) on delete cascade,
  user_id uuid not null,
  campaign_id uuid not null,
  amount_usd numeric not null,
  status text not null default 'pending' check (status in ('pending','reserved','credited','paid','void')),
  created_at timestamptz not null default now()
);

create table if not exists public.ox_lp_balances (
  user_id uuid primary key,
  pending_usd numeric not null default 0,
  paid_usd numeric not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.ox_lp_daily_limits (
  user_id uuid not null,
  day date not null,
  posts int not null default 0,
  earned_usd numeric not null default 0,
  primary key (user_id, day)
);

create table if not exists public.ox_lp_abuse_flags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  x_user_id text,
  risk text not null default 'review' check (risk in ('normal','review','restricted','banned')),
  reason text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.ox_lp_audit (
  id uuid primary key default gen_random_uuid(),
  actor text,
  action text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.ox_lp_launches enable row level security;
alter table public.ox_lp_flywheel_configs enable row level security;
alter table public.ox_lp_fee_jobs enable row level security;
alter table public.ox_lp_fee_events enable row level security;
alter table public.ox_lp_bagworking_rules enable row level security;
alter table public.ox_lp_campaigns enable row level security;
alter table public.ox_lp_posts enable row level security;
alter table public.ox_lp_rewards enable row level security;
alter table public.ox_lp_balances enable row level security;
alter table public.ox_lp_daily_limits enable row level security;
alter table public.ox_lp_abuse_flags enable row level security;
alter table public.ox_lp_audit enable row level security;

revoke all on public.ox_lp_launches from anon, authenticated;
revoke all on public.ox_lp_flywheel_configs from anon, authenticated;
revoke all on public.ox_lp_fee_jobs from anon, authenticated;
revoke all on public.ox_lp_fee_events from anon, authenticated;
revoke all on public.ox_lp_bagworking_rules from anon, authenticated;
revoke all on public.ox_lp_campaigns from anon, authenticated;
revoke all on public.ox_lp_posts from anon, authenticated;
revoke all on public.ox_lp_rewards from anon, authenticated;
revoke all on public.ox_lp_balances from anon, authenticated;
revoke all on public.ox_lp_daily_limits from anon, authenticated;
revoke all on public.ox_lp_abuse_flags from anon, authenticated;
revoke all on public.ox_lp_audit from anon, authenticated;

comment on table public.ox_lp_launches is 'Launchpad V2 records — kinds standard/flywheel/bagworking on top of existing orbitx_tokens.';
