# OrbitX DEX Redesign Swarm — 10 Agents

Mission: full metal redesign of `/ORBITX_DEX` (ogdex) — black / gold / blue / silver chrome matching Launchpad + Bagwork.

## Roster

| # | Codename | Owns |
|---|----------|------|
| 01 | **HELIX** | Lead / IA / merge order |
| 02 | **CHROME** | Shell: theme, header, tabs, footer |
| 03 | **BOARD** | Home / Screener token rows |
| 04 | **PAD** | Launchpad tab → `/orbitxlaunch` |
| 05 | **HOOD** | Robinhood |
| 06 | **PULSE** | Pulse |
| 07 | **XRAY** | Scanner |
| 08 | **GEAR** | Tools (+ relocated create) |
| 09 | **VAULT** | Wallets + KOL |
| 10 | **GRID** | More + TokenDetail polish |

## IA decisions (locked)

- **Launchpad tab** → gateway to real OrbitX Launchpad at `/orbitxlaunch` (not embedded DEX launcher).
- **Multi-chain create** (`Launch.tsx`) → moved to **Tools** under "Create token".
- **Theme**: `--ox-gold`, `--ox-blue`, `--ox-silver`, `--ox-black` — no purple / pump-green.

## Merge order

1. CHROME (blocks all)
2. BOARD + PAD + HOOD + PULSE + XRAY + GEAR + VAULT (parallel)
3. GRID + HELIX review

## Key paths

- Shell: `web/ogdex/src/components/Layout.tsx`, `index.css`, `tailwind.config.js`
- Routes: `web/ogdex/src/main.tsx`
- Pages: `web/ogdex/src/pages/*`
