-- OrbitX OS theme gallery: community-shared theme packs.
-- Public read, owner-only writes. Idempotent: safe to re-apply.
create table if not exists public.os_themes (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null,
  name text not null,
  pack jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.os_themes enable row level security;

drop policy if exists os_themes_public_read on public.os_themes;
create policy os_themes_public_read on public.os_themes
  for select using (true);

drop policy if exists os_themes_owner_write on public.os_themes;
create policy os_themes_owner_write on public.os_themes
  for all using (auth.uid() = owner) with check (auth.uid() = owner);

create index if not exists os_themes_created_idx on public.os_themes (created_at desc);
