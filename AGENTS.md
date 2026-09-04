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

- Production Vercel project is **`rork-og-meme-coin-tracker`**. Set `ADMIN_AUTH` and every other server secret there (Production + Preview). Do **not** target the leftover `og-scan` Vercel project — `web/vercel.json` `ignoreCommand` skips those builds.
- Primary dev app is `web/` (Vite + React SPA). All commands below run from `web/`.
- Package manager is **pnpm** (matches `web/vercel.json` `installCommand`). `npm install` fails on peer-dependency conflicts (`react-native`/`expo` transitive deps pulled by `@react-three/fiber`). Use `pnpm install --no-frozen-lockfile`. pnpm intentionally skips native build scripts (esbuild, swc, etc.) — that is fine; those ship prebuilt binaries and the dev server/build still work.
- Run dev server: `npm run dev` → Vite on `http://localhost:8080`. `/` serves the marketing Splash (`index.html`); the React SPA is served for app routes. Good no-backend smoke test: `/Orbitxcity` (fully client-side playable 3D demo).
- `/api/*` are Vercel serverless functions (in `web/api/` and repo-root `api/`) and are NOT served by `vite dev`; features that call them 404 locally. The app boots fine without env vars — missing `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` etc. just disable auth/data features (secrets live in Vercel env, not git).
- Lint: `npm run lint`. There are pre-existing warnings/errors that predate environment work.
- Tests: `npm test` (vitest). Build: `npm run build` (multi-page: `index.html` + `app.html`).
- `web/ogdex/` is a separate static sub-app built only for the `/ORBITX_DEX` route during the Vercel build; it is not needed for local `web` dev.

<!-- ORBITX PLATFORM + QA SWARM -->
## OrbitX platform (agents must load this)

- Platform map: `docs/ORBITX_PLATFORM.md`
- Team docs: `docs/backend`, `docs/frontend`, `docs/gaming`, `docs/crypto`, `docs/social`
- Primary routes: `/Orbitxcity`, `/os`, `/play`, `/intel`, `/hq`, `/ORBITX_DEX`

## OrbitX QA Swarm (10 agents)

Bug checks, testing, and error triage. Roster + doctrine: `docs/agents/QA_SWARM.md`.
Agent briefs: `docs/agents/qa/` and `.cursor/agents/qa/`.

| Agent | Role |
|-------|------|
| AEGIS | Lead / triage |
| FORGE | Backend / RLS / workers |
| NEON | OS `/os` UX |
| RAID | Gaming `/play` |
| ORACLE | Crypto `/intel` |
| PULSE | Social `/hq` |
| ATLAS | City 3D |
| WARDEN | Security |
| CIRCUIT | CI / Vitest / smoke |
| SCRIBE | Reports / flakes |

Smoke: `bash scripts/qa/run-smoke.sh`

## Full system audit (20-agent review)

- CTO report: `docs/audit/FULL_SYSTEM_AUDIT.md`
- Bug backlog: `docs/audit/BUG_BACKLOG.md`
- 30/60/90 roadmap: `docs/audit/ROADMAP_30_60_90.md`
<!-- ORBITX PLATFORM + QA SWARM END -->
