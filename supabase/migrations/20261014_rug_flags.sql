-- Rug siren flags for the OrbitX Social Center.
-- Signed-in users can flag a $cashtag post as a potential rug.
-- At 5+ DISTINCT flaggers the client auto-posts a 🚨 RUG SIREN alert
-- (a social_messages row with a [RUGSIREN] content prefix) to the feed.
--
-- post_id is TEXT (not a FK) on purpose: social_messages.id typing is not
-- pinned in the repo, and a mistyped FK would fail this migration.

create table if not exists public.rug_flags (
  id uuid primary key default gen_random_uuid(),
  post_id text not null,
  flagger_user_id uuid not null,
  created_at timestamptz not null default now(),
  unique (post_id, flagger_user_id)
);

create index if not exists rug_flags_post_id_idx on public.rug_flags (post_id);
create index if not exists rug_flags_flagger_idx on public.rug_flags (flagger_user_id);

alter table public.rug_flags enable row level security;

-- Public feed feature: anyone can read flag counts.
drop policy if exists "Anyone can read rug flags" on public.rug_flags;
create policy "Anyone can read rug flags"
  on public.rug_flags for select
  using (true);

-- Only signed-in users can flag, and only as themselves.
drop policy if exists "Signed-in users can flag" on public.rug_flags;
create policy "Signed-in users can flag"
  on public.rug_flags for insert
  with check (auth.uid() = flagger_user_id);

-- Users can retract their own flag.
drop policy if exists "Users can unflag their own flag" on public.rug_flags;
create policy "Users can unflag their own flag"
  on public.rug_flags for delete
  using (auth.uid() = flagger_user_id);
