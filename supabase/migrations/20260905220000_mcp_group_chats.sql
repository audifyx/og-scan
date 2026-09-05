-- MCP group chats — named rooms started from Agent MCP.
-- Focus rows (mcp_group_focus) make every subsequent MCP utterance a chat
-- message until the user calls leave GC.

create table if not exists public.mcp_group_chats (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  topic text,
  host_user_id uuid references auth.users (id) on delete set null,
  host_label text,
  status text not null default 'open' check (status in ('open', 'archived')),
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

create index if not exists mcp_group_chats_open_idx
  on public.mcp_group_chats (status, created_at desc)
  where status = 'open';

create table if not exists public.mcp_group_members (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.mcp_group_chats (id) on delete cascade,
  session_key text not null,
  user_id uuid references auth.users (id) on delete set null,
  author_label text,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  unique (chat_id, session_key)
);

create index if not exists mcp_group_members_session_idx
  on public.mcp_group_members (session_key, left_at);

create table if not exists public.mcp_group_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.mcp_group_chats (id) on delete cascade,
  session_key text,
  user_id uuid references auth.users (id) on delete set null,
  author_label text,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists mcp_group_messages_chat_idx
  on public.mcp_group_messages (chat_id, created_at desc);

create table if not exists public.mcp_group_focus (
  session_key text primary key,
  chat_id uuid not null references public.mcp_group_chats (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  author_label text,
  focused_at timestamptz not null default now()
);

alter table public.mcp_group_chats enable row level security;
alter table public.mcp_group_members enable row level security;
alter table public.mcp_group_messages enable row level security;
alter table public.mcp_group_focus enable row level security;

drop policy if exists "mcp_group_chats public open read" on public.mcp_group_chats;
create policy "mcp_group_chats public open read"
  on public.mcp_group_chats for select
  using (status = 'open');

drop policy if exists "mcp_group_messages public open read" on public.mcp_group_messages;
create policy "mcp_group_messages public open read"
  on public.mcp_group_messages for select
  using (
    exists (
      select 1 from public.mcp_group_chats c
      where c.id = chat_id and c.status = 'open'
    )
  );

drop policy if exists "mcp_group_members self read" on public.mcp_group_members;
create policy "mcp_group_members self read"
  on public.mcp_group_members for select
  using (user_id = auth.uid());

drop policy if exists "mcp_group_focus self read" on public.mcp_group_focus;
create policy "mcp_group_focus self read"
  on public.mcp_group_focus for select
  using (user_id = auth.uid());

grant select on public.mcp_group_chats to anon, authenticated;
grant select on public.mcp_group_messages to anon, authenticated;
grant select on public.mcp_group_members to authenticated;
grant select on public.mcp_group_focus to authenticated;
