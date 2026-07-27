-- Bagwork v2 — categories, difficulty, payout ledger, platform stats

alter table public.bagwork_tasks
  add column if not exists category text not null default 'general',
  add column if not exists difficulty text not null default 'easy'
    check (difficulty in ('easy', 'medium', 'hard', 'expert')),
  add column if not exists slots integer,
  add column if not exists deadline_at timestamptz,
  add column if not exists tags text[] not null default '{}';

do $$ begin
  alter table public.bagwork_tasks
    add constraint bagwork_tasks_category_check
    check (category in ('general', 'social', 'content', 'qa', 'onchain', 'design', 'research'));
exception when duplicate_object then null; end $$;

create table if not exists public.bagwork_payouts (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.bagwork_submissions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  wallet_address text not null,
  amount_usdc numeric(12, 2) not null check (amount_usdc >= 0),
  tx_signature text,
  note text,
  paid_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (submission_id)
);
create index if not exists bagwork_payouts_user_idx on public.bagwork_payouts (user_id, created_at desc);

alter table public.bagwork_payouts enable row level security;

drop policy if exists "bagwork_payouts_select" on public.bagwork_payouts;
create policy "bagwork_payouts_select" on public.bagwork_payouts
  for select using ((select auth.uid()) = user_id or public.bagwork_is_owner());

drop policy if exists "bagwork_payouts_owner_write" on public.bagwork_payouts;
create policy "bagwork_payouts_owner_write" on public.bagwork_payouts
  for all using (public.bagwork_is_owner()) with check (public.bagwork_is_owner());

-- Seed starter tasks if empty
insert into public.bagwork_tasks (title, description, instructions, reward_usdc, category, difficulty, sort_order, active)
select * from (values
  (
    'Follow OrbitX on X',
    'Follow the official OrbitX account and submit a screenshot of your following list.',
    '1) Follow @orbitx_wrldbackup on X\n2) Screenshot your Following list showing OrbitX\n3) Paste your X handle in the proof notes',
    2.00, 'social', 'easy', 100, true
  ),
  (
    'Join the Telegram',
    'Join the OrbitX Telegram community and verify with a screenshot.',
    '1) Join t.me/ogscan\n2) Screenshot the chat with your username visible\n3) Submit the screenshot',
    2.00, 'social', 'easy', 90, true
  ),
  (
    'Launchpad product review',
    'Write a short honest review of the OrbitX launchpad experience (100+ words).',
    '1) Visit /orbitxlaunch\n2) Write 100+ words covering board, create, or claim\n3) Paste the review text as proof',
    8.00, 'content', 'medium', 80, true
  ),
  (
    'Bug hunt — launchpad UI',
    'Find and document a real UI/UX bug on the launchpad. Highest quality reports get approved.',
    '1) Reproduce the bug\n2) Describe steps, expected vs actual\n3) Attach screenshot/video',
    15.00, 'qa', 'hard', 70, true
  )
) as v(title, description, instructions, reward_usdc, category, difficulty, sort_order, active)
where not exists (select 1 from public.bagwork_tasks limit 1);
