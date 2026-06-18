-- ============================================================
-- OG Scan Intelligence Layer (spec sections 6 & 10)
-- - Explainable 4-tier classification scan log (append-only)
-- - Public transparency audit log (append-only)
-- - Token registry graph (nodes + clone-lineage edges)
-- - Aggregated public metrics views
-- All new objects are namespaced ogi_* to avoid colliding with
-- the existing scan_history / tokens tables.
-- ============================================================

create extension if not exists pgcrypto;

-- ── 1. Token registry graph: nodes ──────────────────────────
create table if not exists public.ogi_token_node (
  mint            text primary key,
  chain           text not null default 'solana',
  symbol          text,
  name            text,
  narrative_id    text,                 -- narrative fingerprint cluster id
  first_seen_at   timestamptz not null default now(),
  first_deploy_at timestamptz,          -- earliest known on-chain deployment
  is_og           boolean default false,
  metadata        jsonb default '{}'::jsonb,
  updated_at      timestamptz not null default now()
);
create index if not exists ogi_token_node_narrative_idx on public.ogi_token_node (narrative_id);

-- ── 2. Token graph edges (clone lineage) ────────────────────
create table if not exists public.ogi_token_edge (
  id           uuid primary key default gen_random_uuid(),
  src_mint     text not null,           -- clone / child
  dst_mint     text not null,           -- OG / parent reference
  relationship text not null check (relationship in
                 ('clone_of','migration_of','revival_of','same_narrative','contested_with')),
  similarity   numeric check (similarity >= 0 and similarity <= 1),
  created_at   timestamptz not null default now(),
  unique (src_mint, dst_mint, relationship)
);
create index if not exists ogi_token_edge_src_idx on public.ogi_token_edge (src_mint);
create index if not exists ogi_token_edge_dst_idx on public.ogi_token_edge (dst_mint);

-- ── 3. Append-only scan log (immutable) ─────────────────────
create table if not exists public.ogi_scan_log (
  id             uuid primary key default gen_random_uuid(),
  mint           text not null,
  chain          text not null default 'solana',
  symbol         text,
  name           text,
  tier           text not null check (tier in
                   ('OG_TOKEN','SAFE_CLONE','RISKY_TOKEN','DANGEROUS_TOKEN')),
  confidence     numeric not null check (confidence >= 0 and confidence <= 100),
  risk_score     numeric,
  signals        jsonb not null default '[]'::jsonb,   -- explainability trace
  rationale      text,
  scanned_by     uuid,                  -- auth.users id (nullable for anon scans)
  scanner_handle text,                  -- attribution handle for share cards
  engine_version text not null default 'v1',
  created_at     timestamptz not null default now()
);
create index if not exists ogi_scan_log_mint_idx    on public.ogi_scan_log (mint, created_at desc);
create index if not exists ogi_scan_log_created_idx  on public.ogi_scan_log (created_at desc);
create index if not exists ogi_scan_log_tier_idx     on public.ogi_scan_log (tier);
create index if not exists ogi_scan_log_scanner_idx  on public.ogi_scan_log (scanned_by);

-- ── 4. Public transparency / audit log (append-only) ────────
create table if not exists public.ogi_audit_log (
  id           uuid primary key default gen_random_uuid(),
  event_type   text not null,          -- scan | classification_change | og_promoted | flag
  mint         text,
  actor        uuid,
  actor_handle text,
  detail       jsonb default '{}'::jsonb,
  created_at   timestamptz not null default now()
);
create index if not exists ogi_audit_log_created_idx on public.ogi_audit_log (created_at desc);
create index if not exists ogi_audit_log_mint_idx    on public.ogi_audit_log (mint);

-- ── 5. Immutability guard (defence in depth beyond RLS) ─────
create or replace function public.ogi_block_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'append-only table %: % not permitted', tg_table_name, tg_op;
end; $$;

drop trigger if exists ogi_scan_log_immutable on public.ogi_scan_log;
create trigger ogi_scan_log_immutable
  before update or delete on public.ogi_scan_log
  for each row execute function public.ogi_block_mutation();

drop trigger if exists ogi_audit_log_immutable on public.ogi_audit_log;
create trigger ogi_audit_log_immutable
  before update or delete on public.ogi_audit_log
  for each row execute function public.ogi_block_mutation();

-- ── 6. Row Level Security ───────────────────────────────────
alter table public.ogi_token_node enable row level security;
alter table public.ogi_token_edge enable row level security;
alter table public.ogi_scan_log   enable row level security;
alter table public.ogi_audit_log  enable row level security;

-- public read everywhere (transparency layer)
drop policy if exists ogi_node_read   on public.ogi_token_node;
drop policy if exists ogi_edge_read   on public.ogi_token_edge;
drop policy if exists ogi_scan_read   on public.ogi_scan_log;
drop policy if exists ogi_audit_read  on public.ogi_audit_log;
create policy ogi_node_read  on public.ogi_token_node for select using (true);
create policy ogi_edge_read  on public.ogi_token_edge for select using (true);
create policy ogi_scan_read  on public.ogi_scan_log  for select using (true);
create policy ogi_audit_read on public.ogi_audit_log for select using (true);

-- inserts allowed for anyone (public scanner); updates/deletes intentionally absent
drop policy if exists ogi_node_write  on public.ogi_token_node;
drop policy if exists ogi_node_update on public.ogi_token_node;
drop policy if exists ogi_edge_write  on public.ogi_token_edge;
drop policy if exists ogi_scan_write  on public.ogi_scan_log;
drop policy if exists ogi_audit_write on public.ogi_audit_log;
create policy ogi_node_write  on public.ogi_token_node for insert with check (true);
create policy ogi_node_update on public.ogi_token_node for update using (true) with check (true);
create policy ogi_edge_write  on public.ogi_token_edge for insert with check (true);
create policy ogi_scan_write  on public.ogi_scan_log  for insert with check (true);
create policy ogi_audit_write on public.ogi_audit_log for insert with check (true);

-- ── 7. Aggregated public metrics views ──────────────────────
create or replace view public.ogi_public_metrics as
select
  (select count(*)               from public.ogi_scan_log)                                          as total_scans,
  (select count(distinct mint)   from public.ogi_scan_log)                                          as unique_tokens,
  (select count(*)               from public.ogi_scan_log where created_at > now() - interval '24 hours') as scans_24h,
  (select count(*)               from public.ogi_scan_log where tier = 'OG_TOKEN')                  as og_count,
  (select count(*)               from public.ogi_scan_log where tier = 'SAFE_CLONE')               as safe_count,
  (select count(*)               from public.ogi_scan_log where tier = 'RISKY_TOKEN')              as risky_count,
  (select count(*)               from public.ogi_scan_log where tier = 'DANGEROUS_TOKEN')          as dangerous_count;

create or replace view public.ogi_top_scanned as
select mint,
       max(symbol)                              as symbol,
       max(name)                                as name,
       count(*)                                 as scan_count,
       mode() within group (order by tier)      as common_tier,
       round(avg(confidence))                   as avg_confidence,
       max(created_at)                          as last_scanned
from public.ogi_scan_log
group by mint
order by scan_count desc
limit 100;

create or replace view public.ogi_trending_scans as
select mint,
       max(symbol)                              as symbol,
       max(name)                                as name,
       count(*)                                 as scans_24h,
       mode() within group (order by tier)      as common_tier
from public.ogi_scan_log
where created_at > now() - interval '24 hours'
group by mint
order by scans_24h desc
limit 50;

grant select on public.ogi_public_metrics, public.ogi_top_scanned, public.ogi_trending_scans to anon, authenticated;
