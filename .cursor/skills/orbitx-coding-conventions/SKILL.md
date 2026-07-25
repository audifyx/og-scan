---
name: orbitx-coding-conventions
description: >-
  OrbitX / OG Scan coding patterns: React hooks, TanStack Query, routing,
  wallet auth bridge, Hub plugins, env usage, tests. Use when writing or
  refactoring TypeScript/React in web/, adding hooks, pages, or client libs.
paths:
  - "web/**/*.{ts,tsx}"
  - "web/ogdex/**/*.{ts,tsx}"
---

# OrbitX Coding Conventions

## Defaults

- TypeScript strict; ESM; Vite
- React 18 function components
- TanStack Query: default `staleTime: 30s`, `retry: 2` (match `App.tsx` client)
- Forms: `react-hook-form` + `zod` + `@hookform/resolvers`
- Path alias: `@/...` only (main app)
- Solana needs node polyfills — already via `vite-plugin-node-polyfills` + `buffer`; do not remove

## Auth / wallet pattern (main app)

```ts
// Connect → signMessage → SIWS
// useWalletSignIn + lib/walletAuth.ts → edge wallet-auth → supabase.auth.setSession
// WalletAuthBridge: connected && !user → auto SIWS once (sessionStorage guard)
```

- Prefer `useWalletSignIn` / `WalletPickerModal` for connect UX
- Modals that must center: portal to `document.body` (see wallet modal fix history)
- `ProtectedRoute`: spinner while auth loads; else `/auth?next=...`
- ogdex wallets: `listWallets()` / injected providers — separate stack

## Data fetching

| Context | Pattern |
|---|---|
| Main app Supabase | `web/src/lib/supabase.ts` (`sol-tools-auth` storage key) |
| Edge invoke | `supabase.functions.invoke("name")` or raw `fetch` to `/functions/v1/...` |
| ogdex market data | `web/ogdex/src/lib/api.ts` → `/api/ogdex/*` |
| ogdex DB reads | `web/ogdex/src/lib/supa.ts` REST anon (no supabase-js) |

Keep API helpers thin and typed. Prefer extending `ogdex/src/lib/api.ts` over scattering `fetch` calls.

## Hub plugin pattern (`*-20x`)

Feature packs under `components/<name>-20x/` are lazy plugins for `Index.tsx`'s slug → component `switch`.

When adding a Hub tool:
1. Create the pack folder
2. Wire a lazy import + case in `Index.tsx`
3. Add nav entry only if product wants it discoverable

Do not dump Hub tools into ogdex, and do not put DEX screener features into Hub packs.

## Domain libs (extend, don't fork)

| Area | Lib |
|---|---|
| Fees | `web/src/lib/platformFee.ts` |
| Launchpad client | `web/src/lib/orbitx/*` |
| EVM curve / wallets | `web/src/lib/evm/*` |
| Scan card PNG | `web/src/lib/scanCardImage.ts` |
| Wallet auth | `web/src/lib/walletAuth.ts` |

## Env

- Client: `VITE_*` (and some legacy `REACT_APP_*`)
- Never put `SUPABASE_SERVICE_ROLE_KEY`, marketplace authority, or webhook secrets in `VITE_*`
- Guard missing Supabase env with the existing placeholder client pattern

## Tests

- Vitest + Testing Library (`npm test` in `web/`)
- Prefer focused unit tests for fee math, pure libs, and redirect helpers
- Do not add exploit PoCs or live mainnet keys in tests

## Error / UX polish

- Wrap risky trees in existing `ErrorBoundary`
- Use `sonner` toasts for launch/trade feedback
- Keep copy non-custodial: "sign in your wallet", never "we will transfer for you" unless marketplace authority co-sign is the documented NFT flow

## Anti-patterns

- Parallel auth systems
- Duplicating fee constants in components
- Importing `@solana/web3.js` into hot paths that intentionally avoided it (e.g. vanity-mint server constraints)
- `useMemo`/`useCallback` by default — only when neighbors already do, or profiling demands it
