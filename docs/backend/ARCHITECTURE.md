# OrbitX World — Backend Architecture

Production foundation for a Web3 gaming + trading ecosystem scaling from hundreds to millions of users.

## Stack

| Layer | Choice | Notes |
|-------|--------|-------|
| Auth | Supabase Auth + SIWS (`wallet-auth`) | `auth.uid()` remains the principal |
| DB | Supabase PostgreSQL | `oxw_*` schema namespace |
| Realtime | Supabase Realtime | Presence/chat ephemeral; durable rows in `oxw_*` |
| HTTP API | Vercel Functions (`web/api/orbitx-world.ts`) | Stateless, rate-limited |
| Workers | Supabase Edge Functions (`oxw-*`) | Cron + queue-style ingest |
| Cache | Upstash Redis (existing `api/rate-limit.ts`) + `oxw_token_intel` | Hot token intel |
| Voice | LiveKit (existing `livekit-token` / `voice-token`) | Room metadata in `oxw_voice_rooms` |
| Swaps | Existing Jupiter edge fns | Trade ledger via `oxw_trade_history` |

## Design principles

1. **Additive** — extend `auth.users` / `wallet_identities` / existing Jupiter & scanner services; do not rewrite them.
2. **Default deny** — RLS on every `oxw_*` table; privileged writes through `security definer` RPCs or service-role workers.
3. **Append-only ledgers** — XP events, trades, on-chain events, audit log never mutate history.
4. **Hot vs cold** — Realtime presence is ephemeral; durable lobby/player counts sync via `oxw-lobby-sync`.
5. **Idempotent ingest** — Trade signatures and scan upserts are deduped.
6. **Horizontal scale** — UUID PKs, composite indexes on `(user_id, created_at desc)`, ready for future range partitioning on ledgers.

## Domain map

```
auth.users ──┬── wallet_identities (existing SIWS)
             ├── profiles (existing)
             └── oxw_* platform
                    ├── progression / xp_events / achievements / rewards
                    ├── inventory / item_defs
                    ├── settings / roles
                    ├── friends / notifications
                    ├── communities / posts
                    ├── chat / voice / lobbies / presence
                    ├── trade_history / portfolio_snapshots
                    ├── quests / play_sessions
                    └── token_intel / onchain_events / audit_log
```

## Trust boundaries

| Actor | Can |
|-------|-----|
| Anon | Read public lobbies, quest catalog, achievements, token intel |
| Authenticated player | Own settings/inventory/trades/notifications; public chat; friend flows |
| Staff (`oxw_user_roles`) | Cross-user reads, moderation |
| Workers (`OXW_WORKER_SECRET`) | Award XP, ingest trades, dispatch notifications, write token intel, sync lobby counts |

## Scaling roadmap

| Stage | Users | Actions |
|-------|-------|---------|
| Now | <100k | Single Postgres, indexes as shipped, Vercel Fluid for API |
| Growth | 100k–1M | Partition `oxw_xp_events`, `oxw_chat_messages`, `oxw_trade_history` monthly; read replicas for intel |
| Massive | 1M+ | Move chat hot path to dedicated store or Realtime-only with cold archive; Redis presence; CQRS for portfolio |

See also: `DATABASE.md`, `API_CONTRACTS.md`, `SECURITY.md`, `INFRASTRUCTURE.md`.
