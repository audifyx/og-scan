---
name: orbitx-token-launcher
description: Launch Solana tokens through OrbitX — pump.fun launches, vanity mints, launchpad flows, metadata, LP locking, and fee claims. Use when the user wants to create a token, launch on pump.fun, or manage a launch. The platform never funds launches.
---

# OrbitX Token Launcher

## Product law

- **The platform never funds user launches.** The user pays gas from their own wallet, the token deploys from their own dev wallet, and fee claims accrue to them. No platform desk-wallet funding of launches, ever.
- **Launchpad API access is gated, not open.** Developers buy and burn ORBITX for timed access, then get an API key connecting to their project.
- **No private keys, ever.** Signing happens via the user's connected wallet. The MCP server never asks for, sees, or stores a seed phrase or private key.

## Launch flow

1. **Confirm the plan first** — name, symbol (≤13 chars on pump.fun), decimals, supply, metadata (image + description URI), and whether there is a dev buy. Show the full plan and wait for explicit confirmation. Never launch on a vague "make a coin".
2. **Launch** — `orbitx_app_launch` (pump.fun) or `orbitx_launchpad` (launchpad flow). For vanity mints, confirm the vanity pattern and that the user understands the grind cost.
3. **Verify on-chain** — mint address + creation signature + Solscan link. The launch is done only when it confirms on-chain.
4. **Post-launch** — LP lock status, fee-claim instructions (fees accrue to the user's dev wallet), and the trading links (DexScreener, Solscan, Jupiter). Do not promise liquidity, volume, or price action.

## Metadata rules

- Names ≤32 chars, symbols ≤13 chars, metadata URIs ≤200 chars (pump.fun limits).
- Images must be real files the user provided or approved. Never generate a fake "official" logo and never claim an unverified social link.
- If metadata upload fails (Pinata/IPFS), stop and report — do not launch with broken metadata.

## What to report

Mint address, creation signature, Solscan + DexScreener links, LP lock status, and fee-claim info. If a launch is blocked (auth, metadata, gas), name the blocker in one line.
