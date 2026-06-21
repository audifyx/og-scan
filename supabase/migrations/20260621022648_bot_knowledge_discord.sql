-- RAG: per-bot uploaded knowledge (full-text retrieval, no embedding dep)
create table if not exists public.bot_knowledge (
  id uuid primary key default gen_random_uuid(),
  bot_id uuid references public.telegram_bots(id) on delete cascade,
  user_id uuid,
  filename text,
  chunk_index int not null default 0,
  content text not null,
  tsv tsvector generated always as (to_tsvector('english', content)) stored,
  created_at timestamptz not null default now()
);
create index if not exists idx_bot_knowledge_tsv on public.bot_knowledge using gin(tsv);
create index if not exists idx_bot_knowledge_bot on public.bot_knowledge(bot_id);
alter table public.bot_knowledge enable row level security;
drop policy if exists "own bot knowledge" on public.bot_knowledge;
create policy "own bot knowledge" on public.bot_knowledge for all
  using (exists (select 1 from public.telegram_bots b where b.id = bot_knowledge.bot_id and b.user_id = auth.uid()))
  with check (exists (select 1 from public.telegram_bots b where b.id = bot_knowledge.bot_id and b.user_id = auth.uid()));

-- Discord: migration alerts via incoming webhook URL
create table if not exists public.discord_integrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade unique,
  webhook_url text not null,
  channel_name text,
  alerts_migrations boolean not null default true,
  min_marketcap numeric default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.discord_integrations enable row level security;
drop policy if exists "own discord" on public.discord_integrations;
create policy "own discord" on public.discord_integrations for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
