# OrbitX World — Security

## Authentication

1. **Wallet SIWS** via existing `wallet-auth` edge function → Supabase session (`auth.uid()`).
2. **API routes** validate Bearer token with anon client `auth.getUser()`.
3. **Workers** never use end-user JWT; they require `OXW_WORKER_SECRET`.

## Authorization model

- Row Level Security enabled on all `oxw_*` tables.
- Players: own-row CRUD where applicable.
- Staff: `oxw_is_staff()` (roles admin/moderator/ops, not revoked).
- XP mutation: `oxw_award_xp` granted **only** to `service_role` (revoked from anon/authenticated).
- Private lobbies: readable by host, members, or staff — not by global `status=open`.

## Threat mitigations

| Threat | Mitigation |
|--------|------------|
| XP inflation | Service-only RPC; audit via `oxw_xp_events` |
| Trade spoofing | Prefer worker ingest after on-chain confirm; signature uniqueness |
| Private lobby leak | RLS membership check |
| Notification spam | Worker secret + API rate limit |
| IDOR on settings | `user_id = auth.uid()` policies |
| Admin escalation | Roles table; no self-grant policy for admin |
| Scanner abuse | Worker secret on intel write; public read of cached intel only |

## Rate limiting

- Per-route memory limiter in `orbitx-world` API (120/min/IP).
- Production: wire `api/rate-limit.ts` (Upstash) for auth-sensitive actions.
- Recommend: trade record 30/min/user; bootstrap 10/min/user; lobby create 5/min/user.

## Secrets

| Name | Where |
|------|-------|
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel + Edge (never client) |
| `OXW_WORKER_SECRET` | Vercel + Edge workers |
| `UPSTASH_REDIS_*` | Global rate limit |
| LiveKit / Jupiter keys | Existing env — unchanged |

## Audit

Write sensitive admin actions to `oxw_audit_log` (staff select only). Expand callers as ops tooling lands.

## RLS review checklist

- [ ] No table without `ENABLE ROW LEVEL SECURITY`
- [ ] No `WITH CHECK (true)` on privileged tables
- [ ] Security definer functions set `search_path = public`
- [ ] Grants minimal (`revoke all` then grant service_role where needed)
