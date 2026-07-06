-- Threaded replies for social_messages
alter table public.social_messages add column if not exists reply_to uuid references public.social_messages(id) on delete cascade;
create index if not exists social_messages_reply_to_idx on public.social_messages(reply_to);
