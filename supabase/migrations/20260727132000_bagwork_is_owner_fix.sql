-- Fix bagwork_is_owner: JWT email claim is often missing; use auth.users

create or replace function public.bagwork_is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from auth.users u
    where u.id = auth.uid()
      and lower(coalesce(u.email, '')) = 'audifyx@gmail.com'
  )
  or lower(coalesce(auth.jwt()->>'email', '')) = 'audifyx@gmail.com';
$$;

revoke all on function public.bagwork_is_owner() from public;
grant execute on function public.bagwork_is_owner() to authenticated;
