-- Reports feed + webhook alert rules.
create table if not exists public.reports (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid,
  query         text,
  instructions  text,
  token_name    text,
  token_symbol  text,
  token_mint    text,
  source        text not null default 'telegram',
  html_path     text,
  public_url    text,
  created_at    timestamptz not null default now()
);
create index if not exists idx_reports_created on public.reports (created_at desc);
create index if not exists idx_reports_mint on public.reports (token_mint);
alter table public.reports enable row level security;
drop policy if exists "reports public read" on public.reports;
create policy "reports public read" on public.reports for select using (true);

create table if not exists public.alert_rules (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid,
  name          text,
  type          text not null default 'token' check (type in ('token','migrations')),
  mint          text,
  symbol        text,
  conditions    jsonb not null default '[]'::jsonb,
  nl_request    text,
  channel_type  text not null default 'discord' check (channel_type in ('discord','webhook')),
  webhook_url   text not null,
  enabled       boolean not null default true,
  last_value    jsonb,
  last_fired_at timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists idx_alert_rules_enabled on public.alert_rules (enabled);
alter table public.alert_rules enable row level security;
drop policy if exists "own alert rules" on public.alert_rules;
create policy "own alert rules" on public.alert_rules for all using (user_id = auth.uid()) with check (user_id = auth.uid());
