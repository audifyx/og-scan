-- MCP LiveKit voice rooms — named VCs started from Agent MCP.
create table if not exists public.mcp_voice_rooms (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  topic text,
  livekit_room text not null,
  host_user_id uuid references auth.users (id) on delete set null,
  host_label text,
  status text not null default 'live' check (status in ('live', 'ended')),
  is_private boolean not null default false,
  speakers_count integer not null default 0,
  created_at timestamptz not null default now(),
  ended_at timestamptz
);

create index if not exists mcp_voice_rooms_live_idx
  on public.mcp_voice_rooms (status, created_at desc)
  where status = 'live';

alter table public.mcp_voice_rooms enable row level security;

drop policy if exists "mcp_voice_rooms public live read" on public.mcp_voice_rooms;
create policy "mcp_voice_rooms public live read"
  on public.mcp_voice_rooms for select
  using (status = 'live' and is_private = false);

drop policy if exists "mcp_voice_rooms host read" on public.mcp_voice_rooms;
create policy "mcp_voice_rooms host read"
  on public.mcp_voice_rooms for select
  using (host_user_id = auth.uid());

-- Writes go through service-role MCP; authenticated hosts may end their own room.
drop policy if exists "mcp_voice_rooms host end" on public.mcp_voice_rooms;
create policy "mcp_voice_rooms host end"
  on public.mcp_voice_rooms for update
  using (host_user_id = auth.uid())
  with check (host_user_id = auth.uid());

grant select on public.mcp_voice_rooms to anon, authenticated;
grant update on public.mcp_voice_rooms to authenticated;
