# OrbitX Owner Command Center

Central owner dashboard at `/ox-desk-m4k9q`. The desk code and UI hide are **not** authorization. Owner APIs require a Supabase JWT whose Auth email/wallet matches `web/shared/token-gate-exempt.js`.

## Metric definitions

| Term | Rule |
|------|------|
| Online | `ox_admin_presence.last_heartbeat_at` within 60s |
| Away | heartbeat 60s–5 minutes |
| Offline | no heartbeat in 5 minutes (ignore stuck `is_online`) |
| Completed tx | `ox_admin_ledger.status = completed` **and** `verified_onchain = true` |
| Burn | `ox_admin_burns.verified_onchain` or confirmed `mcp_burn_ledger` row |
| Fee | `min(tx_usd × 0.012, $10)` from `web/shared/platform-tx-fee.js` |
| DAU | distinct `user_activity.user_id` since UTC midnight |

Zeros mean no verified rows. The UI never invents numbers.

## Database (apply this migration)

`supabase/migrations/20260821120000_orbitx_owner_command.sql`

Tables:

- `ox_admin_presence` — one row per user, heartbeat + path/app/device
- `ox_admin_events` — append-only platform events
- `ox_admin_ledger` — transactions; unique `tx_signature`
- `ox_admin_burns` — verified burns only
- `ox_admin_audit` — owner actions; no UPDATE/DELETE for `authenticated`
- `ox_admin_daily` — reserved rollups

RLS: users may upsert **their own** presence and insert **their own** events. Ledger, burns, audit, and daily are service-role only.

## APIs

| Endpoint | Who | Purpose |
|----------|-----|---------|
| `POST /api/orbitx-owner` | owner JWT | overview, search, user, presence, events, ledger, jupiter, burns, health, audit |
| `POST /api/orbitx-presence` | any signed-in user | heartbeat for **that** uid only |
| `POST /api/orbitx-tx-report` | session optional | RPC-verify signature, recompute fee, write ledger |

## Fee + burn flow

```
OrbitX app → computePlatformTxFee (backend)
  → Jupiter / SystemProgram.transfer to 45YR6f…
  → user signs
  → /api/orbitx-tx-report verifies Solana
  → ox_admin_ledger completed only if meta.err is null
  → FEE_COLLECTED event
```

Jupiter `platformFeeBps` cannot enforce a USD cap. SOL buys attach a `SystemProgram.transfer` sized from the $10 cap. Token-output Jupiter fee bps is a backup and may exceed/under the cap; the ledger records actual fee from on-chain balance change when the desk wallet is in the tx.

**Buy-and-burn of collected fee SOL** is not atomic in this revision. MCP access burns already verify on-chain and then `recordVerifiedBurn`. A fee-SOL → buy $ORBITX → burn worker is the remaining processor TODO.

Launchpad **creator** trading fee (0.45% with 1.3% platform skim) is a separate product fee and was not replaced.

## Presence

`usePresence` still heartbeats `profiles` every 15s and now POSTs `/api/orbitx-presence` with path/app/device. `PAGE_VIEW` is emitted only when the path changes.

## Admin permissions

Owner email and wallets are allowlisted in `TOKEN_GATE_EXEMPT_*`. The desk PIN lives only in Vercel `OWNER_DESK_CODE` (or `ADMIN_PASS`) and is checked at `/api/orbitx-desk-unlock`. The old client PIN is revoked.

## Event types

`USER_REGISTERED`, `USER_LOGIN`, `USER_LOGOUT`, `USER_ONLINE`, `USER_OFFLINE`, `PAGE_VIEW`, `APP_OPENED`, `SWAP_STARTED`, `SWAP_COMPLETED`, `SWAP_FAILED`, `JUPITER_TRANSACTION`, `FEE_COLLECTED`, `ORBITX_PURCHASED`, `ORBITX_BURNED`, `TOKEN_LAUNCHED`, `REFERRAL_CREATED`, `COMMUNITY_CREATED`

## Remaining risks / TODOs

1. Apply the SQL migration in production (Supabase MCP was unauthenticated in this environment).
2. Fee-SOL buy-and-burn processor (atomic where possible).
3. Populate `ox_admin_daily` via cron for large-table analytics.
4. Wire remaining apps (predictions, shop, launch buys) through `orbitx-tx-report`.
5. Jupiter output-token bps path cannot USD-cap; prefer SOL transfer attach.
