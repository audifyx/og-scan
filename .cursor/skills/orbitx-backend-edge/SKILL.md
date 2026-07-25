---
name: orbitx-backend-edge
description: >-
  OrbitX Supabase Edge Functions, Vercel web/api routes, RLS migrations, Grim
  AI models, Discord/Telegram bots, KOL Helius webhooks, secrets. Use when
  adding or changing APIs, edge functions, crons, bots, or database policies.
paths:
  - "supabase/**"
  - "web/api/**"
  - "api/**"
  - "db/**"
  - "docs/kol-tracker.md"
---

# OrbitX Backend & Edge

## Two server surfaces

| Surface | Use for |
|---|---|
| `web/api/` | Vercel serverless: OGDEX, KOL, pump-create, vanity-mint, admin |
| `supabase/functions/` | Deno edge: AI, bots, Jupiter proxies, wallet-auth, NFT settle, long work |

Prefer extending neighbors in the same surface. `/api/` at repo root is a thin auth/rate-limit **sample**, not the primary production API.

## Edge function conventions

Mirror existing folders under `supabase/functions/<name>/index.ts`:

- `Deno.serve(async (req) => …)`
- Handle `OPTIONS` with CORS (`Access-Control-Allow-Origin` pattern used by siblings)
- Secrets: `Deno.env.get(...)` only
- Service role: `createClient(SUPABASE_URL, SERVICE_ROLE)` — never ship to client
- JSON shape: `{ success/ok, … }` or `{ error }` consistent with neighbors
- Shared AI: `_shared/models.ts` (`resolveModel`) + Grim base (`_shared/grim_base.ts`)
- Long work: Discord deferred ACK + `EdgeRuntime.waitUntil`; `vibe-code` isolate for long HTML gen

### `verify_jwt` matrix

Check `supabase/config.toml` before changing auth:

- Many webhook/bot functions are `verify_jwt = false` and **must** verify Discord Ed25519 / Telegram secrets / `CRON_SECRET` / Helius webhook secrets themselves
- Do not disable JWT on RPC proxies or privileged routes casually

## Vercel `web/api` conventions

- OGDEX: `web/api/ogdex/_routes/*` + `_lib.js`
- KOL: `web/api/kol/*` — needs `HELIUS_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, optional `HELIUS_WEBHOOK_SECRET`
- Rate limits: Upstash patterns exist — reuse rather than inventing
- **Do not extend** hardcoded anon JWT fallbacks or default admin passwords if present in `_lib.js`; require env

## Public MCP

`GET/POST /api/ogdex/mcp` — external agents query token lookup, screener, forensics, ATH, wallet PnL, charts. Extend carefully; keep read-oriented and non-custodial.

## Migrations

Prefer `supabase/migrations/YYYYMMDDHHMMSS_name.sql`:

- Idempotent (`if not exists`, `drop policy if exists`)
- RLS on by default
- Wrap `auth.uid()` as `(select auth.uid())` (initplan)
- Sensitive columns: **column GRANTs** (e.g. hide `bot_token` on SELECT)
- Service-role-only tables: RLS on, **no client policies**
- SQL helpers: `set search_path = ''`
- `/db/migrations/` = ad-hoc SQL editor scripts — not the main timeline
- Do not blindly apply `*_REVIEW.sql` hardening without review

## AI / bots

- Model allowlist lives in `supabase/functions/_shared/models.ts` — add models there, not ad-hoc in one function
- Default model: `meta/llama-3.3-70b-instruct` via NVIDIA Integrate API
- Grim persona: reuse shared base; keep tone consistent across Discord/Telegram/intelligence

## KOL Tracker

Architecture: Hub UI + `web/api/kol/*` + Helius enhanced webhooks + Telegram alerts. See `docs/kol-tracker.md`. Never expand SELECT policies that would leak `bot_token`.

## Secrets cheat sheet

| Kind | Examples | Rule |
|---|---|---|
| Client | `VITE_SUPABASE_*`, public RPC | OK in Vite |
| Vercel server | `HELIUS_SECRET`, service role, webhook secrets, Pinata | Server only |
| Edge | NVIDIA, Jupiter, Discord, Telegram, marketplace authority, LiveKit, CRON | Edge only |

`.env.example` is incomplete vs production — discover real secret names from neighboring function code.

## Security pitfalls (repo-specific)

1. Vanity mint API returns `secretKey` — short-lived, never log
2. Marketplace authority can move delegated NFTs — server only
3. Open CORS + `verify_jwt=false` = abuse surface → pair with signature checks / rate limits
4. `orbitx_tokens` public insert — keep anti-vamp uniqueness
5. Fee wallet ≠ pay/boost wallet in OGDEX `_lib.js`
6. RPC proxies must stay auth-gated

## New endpoint checklist

1. Vercel vs Edge?
2. JWT or custom signature?
3. Anon+RLS vs service role?
4. Rate limit / cron secret?
5. Matching frontend client helper updated?
6. No secrets in client responses (except intentional short-lived vanity launch keys)
