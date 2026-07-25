<!-- VERCEL BEST PRACTICES START -->
## Best practices for developing on Vercel

These defaults are optimized for AI coding agents (and humans) working on apps that deploy to Vercel.

- Treat Vercel Functions as stateless + ephemeral (no durable RAM/FS, no background daemons), use Blob or marketplace integrations for preserving state
- Edge Functions (standalone) are deprecated; prefer Vercel Functions
- Don't start new projects on Vercel KV/Postgres (both discontinued); use Marketplace Redis/Postgres instead
- Store secrets in Vercel Env Variables; not in git or `NEXT_PUBLIC_*`
- Provision Marketplace native integrations with `vercel integration add` (CI/agent-friendly)
- Sync env + project settings with `vercel env pull` / `vercel pull` when you need local/offline parity
- Use `waitUntil` for post-response work; avoid the deprecated Function `context` parameter
- Set Function regions near your primary data source; avoid cross-region DB/service roundtrips
- Tune Fluid Compute knobs (e.g., `maxDuration`, memory/CPU) for long I/O-heavy calls (LLMs, APIs)
- Use Runtime Cache for fast **regional** caching + tag invalidation (don't treat it as global KV)
- Use Cron Jobs for schedules; cron runs in UTC and triggers your production URL via HTTP GET
- Use Vercel Blob for uploads/media; Use Edge Config for small, globally-read config
- If Enable Deployment Protection is enabled, use a bypass secret to directly access them
- Add OpenTelemetry via `@vercel/otel` on Node; don't expect OTEL support on the Edge runtime
- Enable Web Analytics + Speed Insights early
- Use AI Gateway for model routing, set AI_GATEWAY_API_KEY, using a model string (e.g. 'anthropic/claude-sonnet-4.6'), Gateway is already default in AI SDK
  needed. Always curl https://ai-gateway.vercel.sh/v1/models first; never trust model IDs from memory
- For durable agent loops or untrusted code: use Workflow (pause/resume/state) + Sandbox; use Vercel MCP for secure infra access
<!-- VERCEL BEST PRACTICES END -->

## Cursor Cloud specific instructions

This is a single Vercel-deployed product (OrbitX / OG Scan). All app code, dependencies, and dev servers live under `web/`. There is a nested sub-app in `web/ogdex/` (the OrbitX DEX SPA served at `/ORBITX_DEX/`).

### Package manager
- Dependency install is handled by the startup update script, so you normally don't need to reinstall.
- If you must install `web/` deps manually, use `pnpm install --frozen-lockfile` (matches Vercel and resolves cleanly). Plain `npm install` in `web/` FAILS on a `@react-three` / `react-native` peer-dep conflict — use `npm install --legacy-peer-deps` if you must use npm.
- `web/ogdex/` installs cleanly with plain `npm install` (this is what `vercel.json` uses for the sub-build).

### Services (dev commands, from `web/`)
- Main hub SPA: `npm run dev` → Vite on port `8080` (SPA entry is `/app.html`; `/` is a marketing splash). Lint: `npm run lint`. Tests: `npm run test` (Vitest). Build: `npm run build`.
- OrbitX DEX SPA (`web/ogdex/`): `npm run dev` → Vite on port `5173` at `/ORBITX_DEX/`.

### Non-obvious gotchas
- The main hub at `:8080/app.html` is gated by a mandatory "Connect to enter" wallet-auth modal — you cannot reach hub features in a headless browser without a Solana wallet. The DEX SPA (`:5173`) is the app you can exercise without auth.
- `.env.example` uses legacy `REACT_APP_*` names, but the code reads `VITE_*`. Missing `VITE_SUPABASE_*` only logs a warning; a hosted Supabase fallback is compiled in, so the app still runs. Lint/test/dev do not require any secrets.
- The DEX frontend fetches `/api/ogdex/*`, which in prod is the Vercel function `web/api/ogdex.js`. Under plain `vite` those calls 404 (screener/scanner/search show no data). There is no local `vercel dev` flow (the CLI isn't installed and would require login). To get live data locally, run the two dev helpers together (see below).

### Running the DEX with live data locally (no keys needed)
From `web/ogdex/`, run both:
- `node dev-api-server.mjs` — serves `web/api/ogdex.js` on `http://localhost:3001`. Most routes (health, screener, token, search, ath, chart) work against public APIs (Jupiter/GeckoTerminal/DexScreener) with no secrets.
- `npm run dev -- --config vite.config.proxy.ts` — same as the normal DEX dev server but proxies `/api` → `:3001`.
Then open `http://localhost:5173/ORBITX_DEX/`; the screener populates with live tokens. (`vite.config.proxy.ts` and `dev-api-server.mjs` are dev-only helpers used only for this local flow.)
