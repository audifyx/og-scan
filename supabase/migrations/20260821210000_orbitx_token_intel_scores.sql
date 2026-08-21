-- OrbitX Token Intelligence score snapshots.
-- Historical tracking for changing risk. Missing rows mean "no previous score",
-- never a fabricated zero.

create table if not exists public.ox_token_intel_scores (
  id bigserial primary key,
  mint text not null,
  overall_score integer,
  safety_score integer,
  maturity_score integer,
  quality_score integer,
  risk_level text,
  confidence text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ox_token_intel_scores_mint_created_idx
  on public.ox_token_intel_scores (mint, created_at desc);

alter table public.ox_token_intel_scores enable row level security;
