# OrbitX — Trade an NFT like a meme coin (pump.fun-style)

Goal: let a creator attach a **bonding-curve market** to an NFT so it can be
bought/sold like a pump.fun coin, with the **same fee structure** (1% total
per trade) and **creator fees claimable in-app** — identical UX to the
existing token launchpad claim flow (`web/src/lib/orbitx/claim.ts`).

## Fee structure (pump.fun parity)
- Total swap fee: **1.00%** per trade (`NFT_COIN_TOTAL_FEE_BPS = 100`)
- Creator share: **0.50%** → claimable to the wallet that created the NFT (`NFT_COIN_CREATOR_FEE_BPS = 50`)
- Platform share: **0.50%** → OrbitX (`NFT_COIN_PLATFORM_FEE_BPS = 50`)

These are defined in `web/src/pages/nft/nftCoin.ts` so the UI, DB, and
(future) on-chain program agree on one source of truth. Adjust bps
per-market via `orbitx_nft_coin_markets.creator_fee_bps / platform_fee_bps`.

## Layers (what's built vs. what's pending)
1. **App layer — DONE.** Creator "Creator fees" tab (`CreatorProfile.tsx`),
   claim button, live accrual/claimable/lifetime read via
   `orbitx_nft_creator_fee_summary`.
2. **DB layer — DONE (migration written).** `orbitx_nft_coin_markets`,
   `orbitx_nft_coin_trades`, and `orbitx_nft_creator_fee_ledger` in
   `supabase/migrations/*_orbitx_nft_marketplace_v4.sql`. Every trade writes a
   trade row + an `accrual` ledger row for the creator share; claims write a
   `claim` row.
3. **On-chain layer — PENDING (separate, security-critical).** The actual
   bonding-curve program that custodies SOL reserves, prices buys/sells, splits
   fees to a creator vault + platform vault, and lets the creator withdraw.
   Until it ships, `claimCreatorFees()` throws a clear "not live yet" error
   rather than moving funds, and accrual is tracked from DB trade records.

## Recommended on-chain path
- **Fastest, lowest-risk:** reuse pump.fun/pumpswap or Meteora bonding-curve
  primitives and route the creator-vault claim exactly like the token lane does
  today (`buildPumpClaimWithSkim`, `pumpCreatorVaultPda` in `claim.ts`). This
  reuses audited programs and the existing 2.5% skim/claim plumbing.
- **Custom:** an Anchor program with `initialize_market`, `buy`, `sell`,
  `claim_creator_fees` instructions; a constant-product or linear curve; PDAs
  for the SOL reserve vault, creator-fee vault, and platform-fee vault. This
  MUST be audited before mainnet — it custodies user funds.

## Graduation
When `market_cap_sol` crosses the graduation threshold, mark `graduated=true`
and migrate reserves to a Raydium/Meteora pool (mirror the existing token
graduation logic).
