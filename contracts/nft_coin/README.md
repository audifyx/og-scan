# OrbitX NFT-coin program (reference, NOT deployed)

Pump.fun-style bonding curve bound to an NFT. Fees: 1.00% per trade = 0.50%
creator (claimable via `claim_creator_fees`) + 0.50% platform. See
`../../docs/NFT_COIN_TRADING.md`.

## Before mainnet
1. `anchor build && anchor deploy` (needs Rust + Anchor + a program keypair + SOL).
2. Add SPL token mint/transfer for curve tokens in `buy`/`sell` (skeleton omits it).
3. Implement `sell` (mirror of `buy`).
4. Graduation: migrate `sol_vault` to a Raydium/Meteora pool.
5. INDEPENDENT SECURITY AUDIT — this custodies user funds.

## Wiring to the app
`web/src/pages/nft/nftCoin.ts` already tracks markets/trades/fees in Supabase and
exposes `claimCreatorFees()`. Point it at this program's instructions once deployed.
