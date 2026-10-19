-- Launchpad comments — per-token comment thread.
-- Read/write from the web client (RLS disabled like other public launchpad tables).
-- Anonymous posting with a username field; delete-own enforced client-side via localStorage.

create table if not exists public.launchpad_comments (
  id uuid primary key default gen_random_uuid(),
  mint text not null,
  username text not null,
  body text not null check (char_length(body) <= 280),
  created_at timestamptz not null default now()
);

create index if not exists idx_launchpad_comments_mint_created
  on public.launchpad_comments (mint, created_at desc);

-- Keep anon writes open like the other public launchpad tables
alter table public.launchpad_comments disable row level security;
