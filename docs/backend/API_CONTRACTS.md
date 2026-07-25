# OrbitX World — API Contracts

Base URL (prod): `/api/orbitx-world/<path>`  
Rewrite: `/api/orbitx-world/(.*) → /api/orbitx-world?path=$1`

Auth: `Authorization: Bearer <supabase_access_token>` (SIWS session)  
Worker auth: `x-oxw-worker-secret: $OXW_WORKER_SECRET`

Rate limit: 120 req/min/IP/route (in-function); use Upstash for global limits.

## Endpoints

### `GET /health`
Public. Service liveness + module list.

### `POST /bootstrap`
Auth required. Calls `oxw_ensure_player`. Returns progression, inventory, settings.

### `GET /me/progression`
Auth. Current XP/level.

### `GET /me/inventory`
Auth. Inventory joined to item defs.

### `GET|PATCH /me/settings`
Auth. Read/update prefs (`display_prefs`, `privacy`, `notifications`, `gameplay`, `locale`, `timezone`).

### `GET /me/notifications?unread=1`
Auth. Latest 50 notifications.

### `POST /me/notifications/read`
Auth. Body `{ ids?: uuid[] }` — null/omit marks all unread.

### `GET /lobbies?city=nyc`
Public directory of open public lobbies.

### `POST /lobbies`
Auth. Body:
```json
{
  "label": "Friends Night",
  "cityId": "nyc",
  "visibility": "public|private",
  "channelId": "oxc-lobby-...",
  "passwordHash": "optional",
  "maxPlayers": 64
}
```

### `POST /presence`
Auth. Body `{ cityId, lobbyId?, status?, meta? }`.

### `GET /quests`
Public active quest catalog.

### `GET /me/quests`
Auth. User quest progress.

### `POST /trades/record`
Auth. Body maps to `oxw_record_trade` params (`wallet`, `side`, `inputMint`, `outputMint`, amounts, `signature`, `venue`, usd fields).

### `GET /trades/history`
Auth. Last 100 trades.

### `GET /token-intel/:mint`
Cached risk/holder intel.

### `POST /token-intel/:mint`
Worker secret. Upsert scanner payload.

### `GET /achievements`
Public achievement catalog.

## Edge workers

| Function | Method | Purpose |
|----------|--------|---------|
| `oxw-award-xp` | POST | Service XP grants |
| `oxw-lobby-sync` | POST/GET | Recompute lobby player_count |
| `oxw-trade-ingest` | POST | Confirmed swap ingest + optional XP |
| `oxw-notification-dispatch` | POST | Insert notifications |
| `oxw-token-scan` | POST | Write `oxw_token_intel` |

All workers require `x-oxw-worker-secret`.

## Existing integrations (do not duplicate)

- SIWS: `supabase/functions/wallet-auth`
- Jupiter: `jupiter-quote`, `jupiter-swap`, `jupiter-order`, …
- LiveKit: `livekit-token`, `voice-token`
- Scanners: `og-scan-token`, `token-safety`, `ogdex-*`, `web/api/orbitx/anti-vamp-check.ts`
