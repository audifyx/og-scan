-- Launchpad upvotes — one row per token, count of 🚀 upvotes.
-- Read/write from the web client (RLS disabled like other public launchpad tables).
-- One vote per browser per token enforced client-side via localStorage.

create table if not exists public.launchpad_upvotes (
  mint text primary key,
  count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Keep updated_at fresh on upsert
create or replace function public.touch_launchpad_upvotes()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_touch_launchpad_upvotes on public.launchpad_upvotes;
create trigger trg_touch_launchpad_upvotes
  before update on public.launchpad_upvotes
  for each row execute function public.touch_launchpad_upvotes();
