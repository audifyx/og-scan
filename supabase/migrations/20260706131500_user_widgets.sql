create table if not exists public.user_widgets (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  widgets    jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.user_widgets enable row level security;
drop policy if exists "user_widgets_select_own" on public.user_widgets;
create policy "user_widgets_select_own" on public.user_widgets for select using ((select auth.uid()) = user_id);
drop policy if exists "user_widgets_insert_own" on public.user_widgets;
create policy "user_widgets_insert_own" on public.user_widgets for insert with check ((select auth.uid()) = user_id);
drop policy if exists "user_widgets_update_own" on public.user_widgets;
create policy "user_widgets_update_own" on public.user_widgets for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "user_widgets_delete_own" on public.user_widgets;
create policy "user_widgets_delete_own" on public.user_widgets for delete using ((select auth.uid()) = user_id);
create or replace function public.touch_user_widgets_updated_at()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists trg_user_widgets_updated_at on public.user_widgets;
create trigger trg_user_widgets_updated_at before update on public.user_widgets for each row execute function public.touch_user_widgets_updated_at();
grant select, insert, update, delete on public.user_widgets to authenticated;
