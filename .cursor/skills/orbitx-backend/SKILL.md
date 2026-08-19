---
name: orbitx-backend
description: Use when writing or modifying backend code in this repo — Supabase Edge Functions (supabase/functions), Vercel serverless functions (api/ and web/api, including the /api/ogdex single-entry router), SQL migrations with RLS, auth (wallet auth, signup guard), and rate limiting. Trigger for "add an API endpoint", "new edge function", "new table/migration", "rate limit", "auth check" tasks.
---

# OrbitX Backend Patterns

Three backend surfaces: **Supabase Edge Functions** (Deno, `supabase/functions/*/index.ts`), **Vercel serverless** (`/workspace/api/*` and `web/api/*`), and **Postgres migrations** (`supabase/migrations/YYYYMMDDHHMMSS_name.sql`).

## Supabase Edge Function anatomy

Canonical shape (see `supabase/functions/wallet-auth/index.ts`, `token-data`, `ogdex-chat`):

```ts
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
  "Content-Type": "application/json",
};
const admin = () => createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: cors });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { action, ...params } = await req.json();
    // switch (action) { ... }
    return json({ ok: true /* result */ });
  } catch (e) {
    return json({ error: String(e?.message ?? e) }, 400);
  }
});
```

House rules:
- Top-of-file comment documenting actions and JWT policy (`verify_jwt=false` for webhooks; deploy those with `--no-verify-jwt`).
- Env vars read once at module scope. Imports via `jsr:` or `esm.sh`; npm packages via `npm:` (e.g. `npm:tweetnacl`, `npm:bs58`).
- **Service role** client for privileged DB writes and `auth.admin.*`; **anon** client only to mint user sessions (`signInWithPassword`).
- Success payloads are flat (`{ ok: true, ... }` or `{ success: true, ... }`); errors `{ error: msg }`.
- Webhook handlers (Telegram/Discord) return HTTP 200 even on errors to avoid retry storms; heavy work goes in `EdgeRuntime.waitUntil(...)` after the ACK.
- Wrap upstream fetches with a timeout helper (`tfetch` pattern in `ogdex-chat`) so a hung upstream never stalls the isolate.
- Shared helpers live in `supabase/functions/_shared/` (`models.ts` = bot model catalog + `resolveModel()`, `grim_base.ts` = persona base). Put new cross-function helpers there.

## Vercel serverless — the /api/ogdex router

`web/vercel.json` rewrites `/api/ogdex/(.*)` → `/api/ogdex?path=$1`. The single entry `web/api/ogdex.js` dispatches on the last path segment via a `ROUTES` map; each route is a default-export `(req, res)` handler in `web/api/ogdex/_routes/*.js`.

To add an endpoint: create `web/api/ogdex/_routes/foo.js`, then **register it in the `ROUTES` map in `web/api/ogdex.js`** — an unregistered file 404s (this bit the MCP route: `web/api/mcp.js` works at `/api/mcp`, but `_routes/mcp.js` was never registered).

Use the shared lib `web/api/ogdex/_lib.js`:
- `send(res, status, data)` — JSON + CORS + `Cache-Control: no-store` default
- `cache(res, s, swr)` — CDN `s-maxage` + `stale-while-revalidate` for cacheable GETs
- `callFn(name, body)` — POST to a Supabase Edge Function with the anon key
- `jup(path)` — Jupiter lite API; `dbSelect/Insert/Update/Delete` — PostgREST with service role; `kvGet/kvPut` — Storage-bucket JSON KV (`ogdex-kv`)

Rate limiting in the router: in-memory Map buckets, default 60 req/10s (stricter for chat/forensics/report), bypass via `x-ogdex-key` header matching `ORBITX_DEX_API_KEYS`. Returns 429 with `Retry-After` + `X-RateLimit-*`.

Upstream data source policy for public ogdex routes: **Jupiter (lite-api.jup.ag) + DexScreener + GeckoTerminal + pump.fun frontend API**; Helius only via the `rpc-proxy` edge function; Birdeye is legacy/keyed (avoid on public paths). PumpPortal for unsigned trade/create txs.

Standalone TS functions (`web/api/pump-create.ts`, `web/api/vanity-mint.ts`) set `maxDuration` in config (Vercel functions default to 30s via `vercel.json`) and keep a soft time budget below it (vanity-mint: 60s max, 55s budget → 504).

## Auth

- **Wallet auth (SIWS)** is the primary login: `supabase/functions/wallet-auth` — `nonce` (row in `wallet_auth_nonces`, 5 min TTL) → `verify` (tweetnacl ed25519 + bs58, synthetic email `{pubkey}@wallet.orbitx.app`, password rotation, returns real Supabase JWTs) → optional `merge` (legacy email account via `orbitx_merge_user_data` RPC).
- **Email signup** goes only through `supabase/functions/signup-guard` (origin allowlist, 1 account per fingerprint, 3 per IP via `account_origins`, service-role `auth.admin.createUser`). Public GoTrue signup is treated as disabled.
- **Vercel-side auth**: `api/auth-middleware.ts` — `requireAuth` (verifies `Authorization: Bearer` via `supabase.auth.getUser(jwt)` with service role), `requireVerifiedEmail`, `requireRole` (hierarchy on `user_metadata.role`).
- **Rate limits** for the `/workspace/api` functions: `api/rate-limit.ts` — Upstash sliding window (`UPSTASH_REDIS_REST_URL/TOKEN`), fail-open on Redis errors. Presets: login 5/15m, signup 3/h, password reset 3/h, API 100/min.

## SQL migrations & RLS

New migration file: `supabase/migrations/<timestamp>_<snake_name>.sql`. Conventions:

- `public.*` snake_case tables, UUID PK `gen_random_uuid()`, `timestamptz default now()`.
- **Always** `alter table ... enable row level security` immediately after create.
- Public read: `create policy "x public read" on public.x for select using (true);` Owner writes: `for all using (user_id = auth.uid()) with check (user_id = auth.uid())`. Service-role-only tables get RLS enabled with **no** policies.
- Idempotent DDL: `create table if not exists`, `drop policy if exists`, `do $$ ... if not exists (select from pg_policies ...) $$`.
- RPCs: `security definer` + `set search_path = public` (or `''`), explicit `grant execute ... to anon, authenticated`, `revoke` for sensitive ones.

## Env vars (names)

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_FN_URL`, `VITE_SUPABASE_URL`; `HELIUS_API_KEY`, `BIRDEYE_API_KEY`, `JUPITER_API_KEY`; `NVIDIA_API_KEY/BASE_URL/MODEL`, `GROQ_API_KEY`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY`; `ORBITX_DEX_API_KEYS`, `ORBITX_DEX_INTEL_FN`, `ADMIN_PASS`; `PINATA_JWT`; `UPSTASH_REDIS_REST_URL/TOKEN`; `DISCORD_PUBLIC_KEY`, `DISCORD_APP_ID`. Never expose keyed providers to the browser — proxy through an edge function or ogdex route.
