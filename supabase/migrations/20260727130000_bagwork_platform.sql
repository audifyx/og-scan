-- Bagwork — task marketplace (earn USDC for completed work)
-- Prefix: bagwork_*

create extension if not exists pgcrypto;

create or replace function public.bagwork_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.bagwork_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  instructions text not null default '',
  reward_usdc numeric(12, 2) not null check (reward_usdc >= 0),
  active boolean not null default true,
  max_submissions_per_user integer check (max_submissions_per_user is null or max_submissions_per_user > 0),
  sort_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bagwork_tasks_active_sort_idx
  on public.bagwork_tasks (active, sort_order desc, created_at desc);

create table if not exists public.bagwork_submissions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.bagwork_tasks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  wallet_address text not null,
  proof_text text,
  proof_url text,
  proof_file_name text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'paid')),
  admin_note text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bagwork_submissions_task_idx on public.bagwork_submissions (task_id);
create index if not exists bagwork_submissions_user_idx on public.bagwork_submissions (user_id, created_at desc);
create index if not exists bagwork_submissions_status_idx on public.bagwork_submissions (status, created_at desc);

drop trigger if exists bagwork_tasks_updated on public.bagwork_tasks;
create trigger bagwork_tasks_updated
  before update on public.bagwork_tasks
  for each row execute function public.bagwork_set_updated_at();

drop trigger if exists bagwork_submissions_updated on public.bagwork_submissions;
create trigger bagwork_submissions_updated
  before update on public.bagwork_submissions
  for each row execute function public.bagwork_set_updated_at();

-- Owner gate for admin RLS (desk UI + owner email)
create or replace function public.bagwork_is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select lower(coalesce(auth.jwt()->>'email', '')) = 'audifyx@gmail.com';
$$;

revoke all on function public.bagwork_is_owner() from public;
grant execute on function public.bagwork_is_owner() to authenticated;

alter table public.bagwork_tasks enable row level security;
alter table public.bagwork_submissions enable row level security;

drop policy if exists "bagwork_tasks_read" on public.bagwork_tasks;
create policy "bagwork_tasks_read" on public.bagwork_tasks
  for select using (active = true or public.bagwork_is_owner());

drop policy if exists "bagwork_tasks_owner_write" on public.bagwork_tasks;
create policy "bagwork_tasks_owner_write" on public.bagwork_tasks
  for all using (public.bagwork_is_owner()) with check (public.bagwork_is_owner());

drop policy if exists "bagwork_submissions_insert_own" on public.bagwork_submissions;
create policy "bagwork_submissions_insert_own" on public.bagwork_submissions
  for insert with check ((select auth.uid()) = user_id);

drop policy if exists "bagwork_submissions_select" on public.bagwork_submissions;
create policy "bagwork_submissions_select" on public.bagwork_submissions
  for select using ((select auth.uid()) = user_id or public.bagwork_is_owner());

drop policy if exists "bagwork_submissions_update_owner" on public.bagwork_submissions;
create policy "bagwork_submissions_update_owner" on public.bagwork_submissions
  for update using (public.bagwork_is_owner()) with check (public.bagwork_is_owner());

-- Proof uploads (images / screenshots)
insert into storage.buckets (id, name, public)
values ('bagwork-proofs', 'bagwork-proofs', true)
on conflict (id) do nothing;

do $$ begin
  create policy "bagwork_proofs_upload" on storage.objects
    for insert to authenticated
    with check (
      bucket_id = 'bagwork-proofs'
      and (storage.foldername(name))[1] = (select auth.uid())::text
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "bagwork_proofs_read" on storage.objects
    for select to public using (bucket_id = 'bagwork-proofs');
exception when duplicate_object then null; end $$;
