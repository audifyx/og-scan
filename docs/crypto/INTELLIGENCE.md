# OrbitX Crypto Intelligence

Professional Solana token intelligence, trading, and launchpad tooling.

## Surface

| Route | Purpose |
|-------|---------|
| `/intel` | Command center |
| `/intel/scan/:mint` | Token scanner — overview, contract, liquidity, holders, rug/clone risk, safety rating |
| `/intel/trade` | Live trading terminal (Jupiter + charts + balances) |
| `/intel/portfolio` | Wallet portfolio tracking |
| `/intel/trending` | Velocity-ranked trending tokens |
| `/intel/whales` | Whale alerts + smart money / KOL tracking |
| `/intel/sentiment` | X + Reddit sentiment proxies |
| `/intel/launch` | Launchpad studio — anti-clone, authorities, creator fees |
| `/intel/wallet/:address` | Wallet tracker |

Also wires the legacy `/terminal/trade` mock into the real `TradingTerminal`.

## Architecture

- **UI:** `web/src/crypto/**` — Intel Command Center (no social/game systems)
- **Risk engine:** `web/src/crypto/risk/composeRisk.ts` — explainable 0–100 score → A–F rating
- **APIs composed:** `/api/ogdex/{safety,forensics,token,screener,signals,kols,wallet}` + `/api/orbitx/anti-vamp-check`
- **Aggregator:** `/api/orbitx/crypto-scan?mint=` — one-shot safety + forensics + token
- **Primitives reused:** `web/src/lib/intelligence.ts` (velocity, clones, entropy)

## Ownership

Crypto Intelligence Team owns scanner, trading terminal surfaces, launchpad intel UX, and risk scoring.
Does **not** own social feeds, games, or City meshes.
