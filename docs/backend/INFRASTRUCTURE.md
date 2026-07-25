# OrbitX World — Infrastructure

## Runtime topology

```
Clients
  │
  ├─ Supabase Auth / Realtime / Storage
  │
  ├─ Vercel Functions
  │     /api/orbitx-world/*
  │     /api/ogdex/* (existing)
  │     Jupiter / share / kol (existing)
  │
  └─ Supabase Edge Functions
        wallet-auth, livekit-token, jupiter-*
        oxw-award-xp, oxw-lobby-sync, oxw-trade-ingest,
        oxw-notification-dispatch, oxw-token-scan
```

## Caching strategy

| Data | Cache | TTL / invalidation |
|------|-------|--------------------|
| Token intel | `oxw_token_intel` row | overwrite on scan |
| Public lobbies | short HTTP cache optional (30s) | lobby-sync worker |
| Jupiter quotes | existing edge cache | seconds |
| Achievement/quest catalogs | CDN or edge 5–15 min | admin publish |
| Presence | Realtime only | heartbeat upsert every 15–30s |

## Background jobs (recommended cron)

| Job | Schedule | Function |
|-----|----------|----------|
| Lobby count sync | `*/1 * * * *` | `oxw-lobby-sync` |
| Stale presence offline | `*/5 * * * *` | SQL: mark `last_seen_at < now()-5m` offline |
| Token rescan hotlist | `*/10 * * * *` | call scanner → `oxw-token-scan` |
| Quest daily reset | `0 0 * * *` | expire daily `oxw_user_quests` |

Configure via Supabase cron or Vercel Cron hitting worker URLs with secret header.

## Logging & errors

- API returns `{ error, retryAfter? }` with appropriate HTTP status.
- Workers return JSON errors; log to Supabase function logs.
- Persist security-relevant events to `oxw_audit_log`.
- Do not log signatures' private keys or raw wallet seed material (N/A — we never hold keys).

## Error handling pattern

```
try → validate auth → rate limit → business logic → json(200)
catch status-aware → json(status, { error })
```

## Multi-chain expansion

`oxw_wallet_links.chain` and `oxw_trade_history.chain` / `oxw_token_intel.chain` are first-class fields. Solana is default; EVM chains add addresses without schema forks. Scanner workers tag `chain` on write.

## Deploy checklist

1. Apply SQL migrations (`20260725190000`, `20260725190100`)
2. Set `OXW_WORKER_SECRET` in Vercel + Supabase function secrets
3. Deploy edge functions `oxw-*`
4. Confirm vercel rewrite for `/api/orbitx-world/(.*)`
5. Smoke: `GET /api/orbitx-world/health`
6. Smoke: authenticated `POST /api/orbitx-world/bootstrap`
