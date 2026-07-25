---
name: orbitx-repo-map
description: >-
  OrbitX / OG Scan repository map and placement rules. Use when deciding where
  to put new routes, APIs, components, or docs; when confused by dual apps
  (main SPA vs ORBITX_DEX); or when starting any non-trivial change.
---

# OrbitX Repo Map

## Layout

```
og-scan/
├── web/                 ← Vite + React (ogscan.fun) — PRIMARY app
│   ├── src/             ← Main SPA (Hub, launchpad, NFT, Spaces, auth)
│   ├── ogdex/           ← Second Vite SPA mounted at /ORBITX_DEX
│   └── api/             ← Production Vercel serverless routes
├── supabase/functions/  ← Deno edge functions (~83)
├── contracts/           ← EVM curve + unused Anchor NFT skeleton
├── api/                 ← Thin auth/rate-limit samples (not primary surface)
├── db/migrations/       ← Ad-hoc admin SQL (not main migration timeline)
├── docs/                ← Domain guides (fees, KOL, NFT coin)
└── .cursor/skills/      ← Repo-trained agent skills
```

## Dual-app rule (non-negotiable)

| Work | Put it here |
|---|---|
| Screener, forensics, KOL market UI, charts, trade panel | `web/ogdex/` + `web/api/ogdex/` |
| Launchpad, NFT marketplace, Spaces/LiveKit, Hub phone shell, SIWS auth UX | `web/src/` |
| Legacy paths (`/scanner`, `/swap`, `/launchpad`, …) | Keep `OgdexRedirect` → `/ORBITX_DEX/...` — do **not** resurrect tools only on old paths |

ogdex uses `basename="/ORBITX_DEX"` and its **own** lightweight wallet layer (`ogdex/src/lib/wallet.tsx`). Do not assume `@solana/wallet-adapter-react` there.

## API homes

| Kind | Location |
|---|---|
| Public DEX / MCP / screener | `web/api/ogdex/` |
| KOL Tracker webhooks/alerts | `web/api/kol/` |
| Pump create, vanity mint, OrbitX helpers | `web/api/*.ts` |
| Long-running bots, AI, Discord/Telegram, Jupiter proxies, wallet-auth | `supabase/functions/` |
| Auth middleware samples | `/api/` (reference only) |

## Provider stack (main app)

Order in `web/src/App.tsx`:

`ErrorBoundary → MaintenanceLock → QueryClient → Auth → SolanaWallet → EvmWallet → Theme → Router (+ WalletAuthBridge)`

Preserve this order when wrapping new providers.

## Identity

- **Primary login:** Solana wallet SIWS → `wallet-auth` edge fn → `supabase.auth.setSession`
- **EVM:** secondary / linked for curve + multi-chain launches (`useEvmWallet`, EIP-6963) — not the session identity
- Email paths exist for merge/recovery only

## Shared DB

Supabase project is shared with mobile. Prefer existing tables/RPCs (`orbitx_tokens`, `orbitx_vamp_check`, `profiles`) over new ad-hoc stores.

## Before you code checklist

1. Main app or ogdex?
2. Client UI, Vercel route, or edge function?
3. Does an existing `lib/orbitx/*` or `api/ogdex/_routes/*` already cover it?
4. Will fees, vanity, or auth change? Read those skills first.
