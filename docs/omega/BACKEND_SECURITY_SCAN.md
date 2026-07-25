# Backend security scan — 2026-07-25

Branch: `cursor/orbitx-backend-security-scan-6aed`

## Fixes landed

| Severity | Issue | Fix |
|----------|-------|-----|
| S0 | Alerts/watchlist IDOR | Solana `signMessage` proof (`orbitx-dex:ogdex-wallet:…`) |
| S0 | Webhook SSRF via alerts | HTTPS-only + private IP block on create + deliver |
| S0 | `launch-digest` fail-open + TG token relay | Require `CRON_SECRET`; POST uses `botId` from DB only |
| S0 | `orbitx_tokens` open insert | Dropped; authenticated insert only |
| S1 | Redesign `PasswordGate` hardcoded `0129` | `VITE_REDESIGN_PASS` or open |
| S1 | KOL Helius webhook fail-open | Require `HELIUS_WEBHOOK_SECRET` |
| S1 | OXW RLS `USING (true)` holes | Membership helpers + tightened policies |
| S1 | Inventory self-mint | INSERT policy removed |
| S1 | `orbitx_mark_graduated` anon execute | `service_role` only |
| S1 | Token chat open insert | Authenticated only |
| S1 | `track` unlimited | Rate-limited; soft keys capped ×5 |
| S1 | PostgREST filter injection | `eqFilter()` on admin/kols |
| S1 | Open RPC proxy | Method allowlist + batch≤10 |
| S1 | Admin pass in query string | Prefer `Authorization` / `x-admin-pass` |
| S1 | `alerts-run` `?secret=` | Header-only |
| S1 | Client ping to `alerts-run` | Removed |
| S2 | Docs told ops to mirror `ADMIN_PASS` into `VITE_*` | Corrected in `OPS_APPLY_STATUS.md` |
| S2 | `wallet_identities` public read | Self-only |

## SQL

`supabase/migrations/20260726010000_backend_security_hardening.sql` — apply to prod.

## Remaining (not in this PR)

- True JWT/RBAC admin (passcode is still soft)
- Durable Upstash rate limits
- Bind `orbitx_token_chat.wallet` to `wallet_identities` for the session user
- Remove hardcoded anon JWT fallback in `_lib.js` (public key; low risk)
