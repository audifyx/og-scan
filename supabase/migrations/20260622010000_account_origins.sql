-- Enforce account limits (1/device, 3/IP). Written/read only by the signup-guard
-- edge function via service role; RLS enabled with no policies = clients denied.
create table if not exists public.account_origins (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  fingerprint text,
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists account_origins_fingerprint_idx on public.account_origins (fingerprint);
create index if not exists account_origins_ip_idx on public.account_origins (ip);
create unique index if not exists account_origins_user_uidx on public.account_origins (user_id);
alter table public.account_origins enable row level security;
