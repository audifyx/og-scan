-- OrbitX Social Center — token_calls table (caller leaderboard).
-- Run once in Supabase (Dashboard SQL editor or psql). Track 1, 2026-10-14.
-- Indexed scan-on-read: GET /api/social/leaderboard writes rows here.

create table if not exists public.token_calls (
  id uuid primary key default gen_random_uuid(),
  post_id text not null,
  symbol text not null,
  mint text not null,
  user_id uuid,
  username text,
  avatar_url text,
  entry_price_usd double precision not null,
  entry_at timestamptz not null,
  entry_source text not null default 'ohlcv', -- 'ohlcv' = candle at post time, 'current' = fallback
  created_at timestamptz not null default now(),
  unique (post_id, symbol)
);

create index if not exists token_calls_username_idx on public.token_calls (username);
create index if not exists token_calls_mint_idx on public.token_calls (mint);
create index if not exists token_calls_created_idx on public.token_calls (created_at desc);

alter table public.token_calls enable row level security;

-- Public read for the leaderboard API.
drop policy if exists "public read token_calls" on public.token_calls;
create policy "public read token_calls"
  on public.token_calls for select
  using (true);

-- The /api/social/leaderboard indexer writes via the anon key. Insert-only
-- (no update/delete), and unique(post_id, symbol) prevents dupes/races.
drop policy if exists "anon insert token_calls" on public.token_calls;
create policy "anon insert token_calls"
  on public.token_calls for insert
  with check (true);
