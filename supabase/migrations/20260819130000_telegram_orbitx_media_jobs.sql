-- Official @theorbitxmcpbot async Grok Imagine jobs (/img /vid /check).
-- Service role writes via /api/telegram-orbitx. No public access.

create table if not exists public.telegram_orbitx_media_jobs (
  id uuid primary key default gen_random_uuid(),
  chat_id text not null,
  telegram_user_id text,
  task_id text not null,
  kind text not null default 'image',
  prompt text,
  eta_seconds int not null default 180,
  started_at timestamptz not null default now(),
  status text not null default 'waiting'
);

create index if not exists telegram_orbitx_media_jobs_chat_started_idx
  on public.telegram_orbitx_media_jobs (chat_id, started_at desc);

create index if not exists telegram_orbitx_media_jobs_task_idx
  on public.telegram_orbitx_media_jobs (task_id);

comment on table public.telegram_orbitx_media_jobs is
  'Latest Grok Imagine jobs for official Telegram /check countdown polling.';

alter table public.telegram_orbitx_media_jobs enable row level security;

revoke all on public.telegram_orbitx_media_jobs from anon, authenticated;
