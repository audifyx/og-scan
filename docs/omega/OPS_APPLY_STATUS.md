# OrbitX OMEGA — ops apply status

Last applied: 2026-07-25 (production Supabase project `ffjipnkhcebjvttliptb` / Soltools).

## Done (production Supabase)

| Item | Status |
|------|--------|
| `20260725190000_oxw_world_platform.sql` | Applied + recorded in `schema_migrations` |
| `20260725190100_oxw_rls_and_rpcs.sql` | Applied + recorded |
| `20260725220000_oxw_record_trade_ownership.sql` | Applied + recorded (`oxw_record_trade` rejects cross-user signature reuse) |
| Edge functions `oxw-award-xp`, `oxw-lobby-sync`, `oxw-trade-ingest`, `oxw-notification-dispatch`, `oxw-token-scan` | Deployed |
| `OXW_WORKER_SECRET` | Set on Supabase project secrets (value not stored in git) |
| Duplicate `[functions.wallet-auth]` in `supabase/config.toml` | Removed (CLI link/push blocker) |

## Blocked from this environment (needs human / Vercel auth)

Vercel CLI is not authenticated here (device OAuth required). Set these in the Vercel project (Production + Preview as needed):

| Env var | Notes |
|---------|-------|
| `ADMIN_PASS` | ≥8 chars; required after OMEGA (hardcoded `0129` removed) |
| `VITE_ADMIN_PASS` | Same value as `ADMIN_PASS` for client gate |
| `CRON_SECRET` | Required for `alerts-run` cron (`Authorization: Bearer …`) |
| `OXW_WORKER_SECRET` | Must match the value set on Supabase secrets |

Cron callers must hit `alerts-run` with `CRON_SECRET` (or `OXW_WORKER_SECRET`). Do not call unprotected.

## Verify

```bash
# Migration versions present remotely
supabase migration list --linked | grep 20260725

# Tables
# oxw_trade_history, oxw_notifications, oxw_progression, … (full oxw_* set)

# Smoke (app)
bash scripts/qa/run-smoke.sh
```

## Security notes

- Never commit Supabase PATs (`sbp_…`), service role keys, or worker secrets.
- Rotate any PAT that was pasted into chat after ops complete.
- Passcode admin UI is still not a JWT/RBAC boundary — treat as soft gate until role-based admin lands.
