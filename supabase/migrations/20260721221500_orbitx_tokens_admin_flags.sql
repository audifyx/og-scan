-- OrbitX Launchpad admin flags: feature + hide tokens from the /orbitxlaunch/admin
-- dashboard. Idempotent. Writes happen server-side via the service role
-- (see web/api/admin-tokens.ts); public reads stay under the existing
-- read-all RLS policy. Hidden tokens are filtered out of public feeds
-- client-side (web/src/lib/orbitx/registry.ts).
alter table public.orbitx_tokens add column if not exists is_featured boolean not null default false;
alter table public.orbitx_tokens add column if not exists is_hidden   boolean not null default false;
create index if not exists orbitx_tokens_featured_idx on public.orbitx_tokens (is_featured) where is_featured;
create index if not exists orbitx_tokens_hidden_idx   on public.orbitx_tokens (is_hidden)   where is_hidden;
