-- First-class reposts for social_messages
alter table public.social_messages add column if not exists repost_of uuid references public.social_messages(id) on delete cascade;
create index if not exists social_messages_repost_of_idx on public.social_messages(repost_of);
