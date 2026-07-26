# OrbitX Backend Architecture — Team Ownership

**Team:** Backend Architecture (Product Architect + Backend Systems)  
**Scope:** Databases, APIs, security, infrastructure, edge workers, crypto backend services  
**Out of scope:** UI, frontend components, CSS, R3F world meshes

## Owns

| Path | Purpose |
|------|---------|
| `supabase/migrations/2026072519*.sql` | OXW platform schema + RLS + RPCs |
| `supabase/functions/oxw-*` | Background / worker edge functions |
| `supabase/functions/_shared/oxw_*.ts` | Shared edge helpers |
| `web/api/orbitx-world.ts` | Public HTTP API router |
| `web/api/orbitx/world/` | API libs (no React) |
| `docs/backend/**` | Backend architecture docs |
| Existing: `wallet-auth`, Jupiter fns, ogdex APIs | Integrate, do not fork |

## Does not own

- `web/src/components/**`, `web/src/pages/**` (except calling these APIs)
- Design system / HUD / menus

## Contracts for other teams

- Frontend / Multiplayer consume `/api/orbitx-world/*` and Supabase RPCs documented in `API_CONTRACTS.md`
- Blockchain Team writes trades via `oxw_record_trade` or `oxw-trade-ingest`
- Security Team reviews RLS in `20260725190100_oxw_rls_and_rpcs.sql`
