-- Paper mode for the agents desk: same agents, same scans, same real prices; simulated fills, mock bank.
alter table public.ox_live_desk add column if not exists paper boolean not null default false;
alter table public.ox_live_desk add column if not exists paper_start_usd numeric not null default 10000;
alter table public.ox_live_positions add column if not exists paper boolean not null default false;
alter table public.ox_live_fills add column if not exists paper boolean not null default false;
alter table public.ox_live_events add column if not exists paper boolean not null default false;
create index if not exists ox_live_positions_paper_status_idx on public.ox_live_positions (paper, status);
create index if not exists ox_live_fills_paper_created_idx on public.ox_live_fills (paper, created_at desc);
create index if not exists ox_live_events_paper_created_idx on public.ox_live_events (paper, created_at desc);

-- Pause real trading, start the paper desk with a $10k mock bank.
insert into public.ox_live_desk (id, armed, paused, paper, paper_start_usd)
values ('main', false, false, true, 10000)
on conflict (id) do update set armed = false, paused = false, paper = true, paper_start_usd = 10000, updated_at = now();
