-- Ensure DM conversations always have participant rows.
-- Fixes message inserts blocked by dm_messages RLS policies when a conversation
-- exists but matching dm_participants rows were never created.

begin;

create or replace function public.dm_conversations_ensure_participants()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if new.user_a is not null then
    insert into public.dm_participants (conversation_id, user_id)
    values (new.id, new.user_a)
    on conflict (conversation_id, user_id) do nothing;
  end if;

  if new.user_b is not null then
    insert into public.dm_participants (conversation_id, user_id)
    values (new.id, new.user_b)
    on conflict (conversation_id, user_id) do nothing;
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_dm_conversations_ensure_participants on public.dm_conversations;

create trigger trg_dm_conversations_ensure_participants
after insert on public.dm_conversations
for each row
execute function public.dm_conversations_ensure_participants();

insert into public.dm_participants (conversation_id, user_id)
select id, user_a
from public.dm_conversations
where user_a is not null
on conflict (conversation_id, user_id) do nothing;

insert into public.dm_participants (conversation_id, user_id)
select id, user_b
from public.dm_conversations
where user_b is not null
on conflict (conversation_id, user_id) do nothing;

commit;
