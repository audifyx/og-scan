---
name: orbitx-skill-finder
description: >-
  Route OrbitX / OG Scan work to the right repo-trained skill. Use at the start
  of any task in this repository (websites, coding, games, web3, launchpad,
  backend, DEX, wallets, AI bots) when unsure which skill applies.
---

# OrbitX Skill Finder

This repo ships project skills under `.cursor/skills/`. Read the matching skill **before** editing.

## Pick one (or more)

| Task smells like… | Read this skill |
|---|---|
| Where does this code go? dual app? redirect? | `orbitx-repo-map` |
| UI, splash, themes, Tailwind, shadcn, glass, launchpad CSS | `orbitx-websites-ui` |
| React patterns, hooks, Query, routing, Hub `*-20x` plugins | `orbitx-coding-conventions` |
| Launchpad, fees, pump.fun, vanity mint, Jupiter, EVM curve, NFT settle | `orbitx-web3-launchpad` |
| Supabase edge, Vercel `web/api`, RLS, JWT, Grim AI, KOL webhooks | `orbitx-backend-edge` |
| Games page, BackgroundFX, phone shell, canvas FX, vibe-code HTML | `orbitx-games-interactive` |

## Hard rules (always)

1. **Two frontends:** main SPA `web/src/` vs DEX `web/ogdex/` at `/ORBITX_DEX`.
2. **Fee source of truth:** `web/src/lib/platformFee.ts` — never invent rates from stale markdown.
3. **Auth = Solana SIWS → Supabase session.** Do not invent parallel logins.
4. **Non-custodial:** users sign; never ship service keys or marketplace authority to the client.
5. **Vanity suffix is `obx`** in live code (`web/api/vanity-mint.ts`). Docs saying otherwise are stale.

## Product glossary (quick)

- **OrbitX** — product umbrella (DEX, social, live, games, launchpad)
- **OG Scan / ogscan.fun** — live site
- **OGDEX / OrbitX DEX** — screener + forensics (`/ORBITX_DEX`, `/api/ogdex/*`)
- **Grim** — sarcastic on-chain AI persona
- **Pump lane / custom lane** — pump.fun launch vs Token-2022 OrbitX mint
- **Anti-vamp** — lookalike name/ticker protection on launches
