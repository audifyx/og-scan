# OrbitX Platform — Render + Cloudflare Pages migration

Moves orbitx.world off Vercel (team paused, 402) to free Cloudflare Pages
(frontend) + a free Render Node service (API), same pattern as OrbitX City.

## Layout

- **Frontend:** `web/` Vite multi-page build (`index.html` + `app.html`) +
  `web/ogdex/` sub-app (builds into `web/dist/ORBITX_DEX/`). Deployed to a
  Cloudflare Pages project (`orbitx-world`). The frontend calls the API via
  `VITE_API_URL` at build time (see `web/src/lib/apiBase.ts`).
- **API:** `web/server.mjs` (plain `node:http`, run under `tsx` so the `.ts`
  handlers load). It routes `/api/*` to the EXISTING `web/api/` handlers —
  the same files Vercel runs, untouched — plus `/health`. Routing mirrors
  `web/vercel.json` rewrites. No new files under `web/api/` (12-function cap).
- **Render service:** `orbitx-platform-api`, free, Oregon, build `npm ci` (repo
  root), start `node_modules/.bin/tsx web/server.mjs`. The root package.json
  carries the API runtime deps (tsx, supabase-js, solana web3/spl-token,
  noble/curves, bs58, @vercel/kv) + package-lock.json; the api/ handlers
  resolve them from the repo-root node_modules. A dead dep `fal-client`
  (imported nowhere, 404 on npm) was removed from the root package.json —
  it broke every root `npm install`/`npm ci`. Render `pnpm install` of web/
  fails (exit 226) and lockfile-less `npm install` fails (exit 1); `npm ci`
  with the lockfile is the working path.
  No keep-alive cron — it sleeps after 15 min idle, wakes on demand.

## Key facts

- All 8 top-level api handlers import cleanly under tsx (verified locally):
  `auth-login.ts`, `auth-web3.ts`, `mcp.js`, `ogdex.js`, `orbitx-hub.js`,
  `telegram-mcp.js`, `web.js`, `x-mcp.js`.
- The server buffers the request body once and re-exposes it as a readable
  stream, so handlers using `req.body` (172 uses) and handlers reading the
  raw stream (`for await`, `req.on('data')`) both work. The res shim supports
  Node style (`statusCode`/`setHeader`/`end`) and Express style
  (`status(n).json(obj)`).
- `/api/auth-login` and `/api/auth/signup` proxy to the Supabase edge
  functions (`auth-signin`, `signup-guard`) — same as the Vercel rewrites.
  `/predictions/*` proxies to `https://orbitx-prediction.fun`.
- Paused trading/on-chain routes return 503 `paused` exactly as on Vercel.
- Telegram webhook is `/api/ogdex?path=tg-webhook` (ogdex.js route).

## DNS (orbitx.world)

- Registrar: **Name.com** (nameservers mix Vercel + Name.com today).
- Cloudflare zone creation is BLOCKED on the current token: the stored
  Cloudflare API token is Pages-scoped and returns 403 on POST /zones.
  Needs a token with Zone:Edit + DNS:Edit, or the zone created in the
  Cloudflare dashboard. Once the zone exists, set its 2 nameservers at
  Name.com and add: `@` + `www` CNAME to the Pages project, the Titan MX
  records (`mx1.titan.email` pri 10, `mx2.titan.email` pri 20 — email lives
  there, must be preserved), and `_dmarc` TXT `v=DMARC1; p=none`.
- `www.orbitx.world` currently has no DNS record (NXDOMAIN).

## Env vars

56 vars on Vercel project `orbitx` (`prj_zq0S9PT1758Gc2BlSa1R3Uumjao1`).
Vercel returns sensitive values masked/empty and the "plain" ones are
Vercel-encrypted blobs — NOT usable directly. Recoverable: Supabase keys via
the Supabase Management API `projects api-keys` (green-ball
`ibojtmeqgzabgeiwbvhf`); `SUPABASE_URL` is plain. The rest need the user or
the chat history. See the migration report for the SET vs MISSING list.
