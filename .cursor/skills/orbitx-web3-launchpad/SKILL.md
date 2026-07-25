---
name: orbitx-web3-launchpad
description: >-
  OrbitX Solana/EVM launchpad, fees, vanity mints, Jupiter swaps, pump.fun,
  Token-2022 claims, EVM bonding curve, NFT marketplace settlement. Use for any
  trading, minting, launch, fee, wallet-tx, or web3 contract work.
paths:
  - "web/src/lib/platformFee.ts"
  - "web/src/lib/orbitx/**"
  - "web/src/lib/evm/**"
  - "web/src/pages/orbitx/**"
  - "web/api/**"
  - "contracts/**"
  - "docs/launchpad-fees-claims.md"
  - "docs/NFT_COIN_TRADING.md"
  - "VANITY_MINT*.md"
---

# OrbitX Web3 & Launchpad

## Source of truth: fees

Read `web/src/lib/platformFee.ts` before any fee/UI/tx change:

| Fee | Value | Notes |
|---|---|---|
| Platform wallet | `45YR6fWxtc8uceNazGKMoX2KgK698rQsnPN4x8vD2VrE` | Launch + Jupiter `feeAccount` ATA |
| Swap fee | `PLATFORM_FEE_BPS = 95` (0.95%) | Kill-switch: `PLATFORM_FEE_ENABLED` |
| Creator fee | `CREATOR_FEE_BPS = 30` (0.30%) | Pump native / Token-2022 transfer fee |
| Launch fee | `$1.50` flat → `0` while promo active | `LAUNCH_FEE_PROMO_END` = 2026-08-16 |

Keep UI, txs, docs, and DB aligned. Prefer updating `platformFee.ts` then propagating — never hardcode rates in JSX.

**Stale docs:** older markdown may say free forever or vanity suffix `orbit`. Live vanity suffix is **`obx`**.

## Two Solana launch lanes

| Lane | How | Claim |
|---|---|---|
| **Pump** | PumpPortal `/api/pump-create` → pump.fun | PumpPortal claim flow |
| **Custom** | Token-2022 + transfer fee (`lib/orbitx/token22.ts`) | In-app `/orbitxlaunch/claim` withdraw withheld |

Both register in `orbitx_tokens`. Run anti-vamp (`orbitx_vamp_check` / normalize) before mint branding.

## Vanity mints

- Server: `web/api/vanity-mint.ts` grinds CA ending in `obx`
- Returns mint `secretKey` for short-lived launch signing — **never log/store**; treat as highly sensitive
- Avoid pulling heavy `@solana/web3.js` into that route if the existing implementation intentionally stayed light

## Swaps / trading

- Jupiter quotes + swaps with platform `feeAccount` via `deriveFeeAccount(mint)`
- In-app panels: launchpad token page + `TradingTerminal`
- Non-custodial: wallet signs every trade

## EVM OrbitX Curve

- Contracts: `contracts/evm/OrbitXCurve.sol` + `OrbitXCurveMigrator.sol` (CREATE2, **beta / unaudited**)
- Client: `web/src/lib/evm/*`
- Env: `VITE_ORBITX_FEE_WALLET`, `VITE_ORBITX_CURVE_MIGRATOR`, `VITE_DEX_ROUTER_<chainId>`
- Do not hardcode unverified routers; do not “promote to audited” in UI copy
- Solana remains login identity; EVM wallet is linked for launches

## NFT coin / marketplace

- Product path for NFT-as-meme-coin: **pump.fun collection coin + Jupiter** (see `docs/NFT_COIN_TRADING.md`)
- `contracts/nft_coin` Anchor skeleton is **not deployed** — do not wire claims to it without an explicit deploy decision
- Marketplace: seller approves `MARKETPLACE_AUTHORITY`; edge `nft-execute-sale` partially signs — authority secret stays server-only

## UI entry points

- Layout: `pages/orbitx/LaunchpadLayout.tsx`
- Create: `LaunchpadPump.tsx`, `LaunchpadCreate.tsx`, EVM curve create routes
- Token trade: `LaunchpadToken.tsx`
- Terminal skin: `LaunchpadTerminal.tsx` / `/terminal/*`
- Shared: `_shared.tsx` (`TokenLogo`, `shortAddr`, Orbit Score)

## Security checklist (web3)

1. No private keys / service role / marketplace authority in client bundles
2. Fee wallet ≠ boost/listing pay wallet (do not conflate)
3. Label EVM curve beta/unaudited in user-facing copy when relevant
4. Public `orbitx_tokens` insert exists — do not weaken uniqueness / anti-vamp further
5. Validate mint addresses before deriving ATAs or building txs

## Implementation workflow

1. Confirm lane (pump / custom / EVM / NFT market)
2. Read `platformFee.ts` + the matching `lib/orbitx/*` or `lib/evm/*` module
3. Mirror neighboring tx-build + toast + explorer-link UX
4. If fees change, update constants first, then UI + docs in the same PR
5. Never invent a third fee path
