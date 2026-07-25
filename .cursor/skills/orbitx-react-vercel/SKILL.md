---
name: orbitx-react-vercel
description: Implement, debug, or review OrbitX React, Vite, Supabase, and Vercel features. Use for routes, components, hooks, serverless APIs, database access, deployment configuration, caching, authentication, or build failures.
---

# OrbitX React, Supabase, and Vercel

## Map the execution surface first

- Main SPA: `web/src`, built from `web/app.html`.
- Marketing entry: `web/index.html`.
- OG DEX sub-app: `web/ogdex`, built into `/ORBITX_DEX`.
- Vercel functions: `web/api` and root `api`.
- Supabase Edge Functions: `supabase/functions`.
- Schema and RLS: `supabase/migrations`.

Do not move logic between these surfaces without checking `web/vercel.json`, both Vite configs, and the deployed URL contract.

## Client conventions

- TypeScript + React 18 + Vite; use the `@/` alias in the main app.
- Reuse existing UI primitives and `cn` patterns.
- Use TanStack Query for server state and existing context/hooks for auth, theme, Solana, and EVM wallets.
- Avoid new global state when URL state, query state, or a local component state is sufficient.
- Lazy-load expensive routes with the repository's retry helper.
- Keep render paths side-effect free; subscriptions and browser APIs belong in effects with cleanup.
- Treat wallet addresses, mint addresses, API payloads, and URL parameters as untrusted input.

## Data and secrets

- Browser code may use the Supabase anon key and must rely on RLS.
- Never place service-role keys, private RPC keys, bot tokens, signing secrets, or AI provider keys in `VITE_*`, `NEXT_PUBLIC_*`, source, logs, or responses.
- Perform privileged operations in a server-side function.
- Add migrations for schema changes and make policies explicit.
- Gracefully handle absent public environment configuration so one integration cannot white-screen the app.

## Vercel functions

- Functions are stateless and have ephemeral filesystems. Persist through Supabase, Blob, or another configured durable service.
- Validate method, content type, body/query parameters, and upstream responses.
- Bound external requests with timeouts and return stable JSON errors.
- Apply rate limits to expensive or abuse-prone public routes.
- Cache public immutable or slow-changing data deliberately; never publicly cache personalized responses.
- Keep work inside configured `maxDuration`; use platform-supported post-response work when appropriate.
- Preserve route ordering: broad rewrites can shadow specific routes.

## Supabase Edge Functions

- Centralize shared logic in `supabase/functions/_shared`.
- Handle CORS and `OPTIONS` consistently.
- A function with `verify_jwt = false` is public at the gateway; implement the actual authentication or signed-webhook check in code.
- Use service-role access only inside the function and return the minimum required fields.
- Make retries idempotent for webhooks, payments, launches, and scheduled jobs.

## Change checklist

1. Trace browser → rewrite → function → data source.
2. Preserve response shapes consumed by both apps and public API users.
3. Add focused tests around extracted domain logic.
4. Run relevant tests and lint on changed files.
5. Build the main app; if OG DEX changed, build it too.
6. Verify no secret entered the browser bundle or git diff.

## Source patterns

- `web/vite.config.ts`
- `web/vercel.json`
- `web/src/App.tsx`
- `web/src/lib/supabase.ts`
- `web/api/ogdex/index.js`
- `supabase/config.toml`
