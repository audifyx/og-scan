# OrbitX OMEGA — ops apply status

Last applied: 2026-09-05 (production Supabase project `ffjipnkhcebjvttliptb` / Soltools).

## Done (production Supabase)

| Item | Status |
|------|--------|
| `20260725190000_oxw_world_platform.sql` | Applied + recorded in `schema_migrations` |
| `20260725190100_oxw_rls_and_rpcs.sql` | Applied + recorded |
| `20260725220000_oxw_record_trade_ownership.sql` | Applied + recorded (`oxw_record_trade` rejects cross-user signature reuse) |
| `20260726010000_backend_security_hardening.sql` | Applied + recorded (RLS / grants / membership helpers) |
| `20260905190000_backend_auth_rls_hardening.sql` | Applied + recorded (`wallet_auth_used_nonces`, own-row `profiles` writes, `orbitx_upsert_profile` revoke from anon, OXW private joins, token-chat wallet bind) |
| Edge functions `oxw-award-xp`, `oxw-lobby-sync`, `oxw-trade-ingest`, `oxw-notification-dispatch`, `oxw-token-scan` | Deployed |
| Edge functions `wallet-auth`, `signup-guard`, `auth-signup`, `auth-signin`, `livekit-token`, `voice-token`, `rpc-proxy`, `solana-rpc-proxy` | Deployed 2026-09-05 (`verify_jwt` from `config.toml`) |
| `OXW_WORKER_SECRET` | Set on Supabase project secrets (value not stored in git) |
| Duplicate `[functions.wallet-auth]` in `supabase/config.toml` | Removed (CLI link/push blocker) |

## Blocked from this environment (needs human / Vercel auth)

Vercel CLI is not authenticated here (device OAuth required). Set these on Vercel project **`rork-og-meme-coin-tracker`** only (Production + Preview). Do not set them on the leftover `og-scan` Vercel project.

| Env var | Notes |
|---------|-------|
| `ADMIN_AUTH` | ≥8 chars; **server-only** desk/admin/maintenance PIN on `rork-og-meme-coin-tracker`. Never put this in any `VITE_*` var |
| `CRON_SECRET` | Required for `alerts-run` cron (`Authorization: Bearer …`) |
| `OXW_WORKER_SECRET` | Must match the value set on Supabase secrets |
| `HELIUS_WEBHOOK_SECRET` | Required for `/api/kol/webhook` (fail-closed if unset) |

Cron callers must hit `alerts-run` with `CRON_SECRET` (or `OXW_WORKER_SECRET`). Do not call unprotected.

## Verify

```bash
# Migration versions present remotely
supabase migration list --linked | grep -E '20260725|20260905190000'

# Tables
# oxw_trade_history, oxw_notifications, oxw_progression, … (full oxw_* set)

# Smoke (app)
bash scripts/qa/run-smoke.sh
```

## Security notes

- Never commit Supabase PATs (`sbp_…`), service role keys, or worker secrets.
- Rotate any PAT that was pasted into chat after ops complete.
- Passcode admin UI is still not a JWT/RBAC boundary — treat as soft gate until role-based admin lands.
