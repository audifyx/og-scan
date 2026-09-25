-- AgentPlus mind loop columns: per-agent model override, daily think budget,
-- and think scheduling (event-driven next_think_at + heartbeat last_think_at).
alter table public.ap_agents add column if not exists model text;
alter table public.ap_agents add column if not exists think_budget_per_day int not null default 50;
alter table public.ap_agents add column if not exists thinks_today int not null default 0;
alter table public.ap_agents add column if not exists think_day date;
alter table public.ap_agents add column if not exists next_think_at timestamptz;
alter table public.ap_agents add column if not exists last_think_at timestamptz;
create index if not exists ap_agents_think_due on public.ap_agents (user_id, status, next_think_at);
