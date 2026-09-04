# OrbitX World — Database Documentation

Migrations:

1. `supabase/migrations/20260725190000_oxw_world_platform.sql` — tables, indexes, seeds
3. `supabase/migrations/20260821120000_orbitx_owner_command.sql` — owner command presence, events, ledger, burns, audit

See also [OWNER_COMMAND_CENTER.md](./OWNER_COMMAND_CENTER.md).

## Tables (summary)

### Identity & admin
- `oxw_user_roles` — player/creator/moderator/admin/ops/analyst
- `oxw_user_settings` — privacy, notifications, gameplay prefs
- `oxw_wallet_links` — multi-chain linked wallets (primary remains `wallet_identities`)

### Progression
- `oxw_progression` — xp, level, title, prestige
- `oxw_xp_events` — append-only ledger
- `oxw_achievements` / `oxw_user_achievements`
- `oxw_rewards` / `oxw_user_rewards`

Level curve: `level = floor(sqrt(xp / 100)) + 1` via `oxw_level_for_xp`.

### Inventory
- `oxw_item_defs` — catalog
- `oxw_inventory` — per-user stacks / equipped flags

### Social
- `oxw_friend_requests` / `oxw_friendships` (canonical `user_a < user_b`)
- `oxw_notifications`
- `oxw_communities` / `oxw_community_members` / `oxw_community_posts`

### Realtime durable layer
- `oxw_chat_channels` / `oxw_chat_messages` / `oxw_chat_members`
- `oxw_voice_rooms` / `oxw_voice_participants`
- `oxw_lobbies` / `oxw_lobby_members`
- `oxw_presence_sessions` — last-write-wins per user

### Trading & crypto intel
- `oxw_trade_history` — unique signature when present
- `oxw_portfolio_snapshots`
- `oxw_token_intel` — scanner cache
- `oxw_onchain_events` — listener / ingest log

### Gaming
- `oxw_quests` / `oxw_user_quests`
- `oxw_play_sessions`

### Security
- `oxw_audit_log` — staff-readable

## RPCs

| Function | Caller | Purpose |
|----------|--------|---------|
| `oxw_ensure_player(user_id)` | authenticated | Bootstrap settings, progression, starter inventory |
| `oxw_award_xp(...)` | service_role only | Ledger + progression update |
| `oxw_accept_friend_request(id)` | authenticated | Accept + notify |
| `oxw_record_trade(...)` | authenticated / service | Idempotent trade insert |
| `oxw_upsert_presence(...)` | authenticated | Heartbeat |
| `oxw_mark_notifications_read(ids)` | authenticated | Bulk mark read |
| `oxw_is_staff(uid)` | internal | Role gate |
| `oxw_level_for_xp(xp)` | internal | Level curve |

## Apply

```bash
supabase db push
# or link + migration up in CI
```

Idempotent: safe to re-run `IF NOT EXISTS` / `drop policy if exists` patterns.
