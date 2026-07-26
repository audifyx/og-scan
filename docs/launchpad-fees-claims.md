# OrbitX Launchpad — Fees & Creator Claims

## Fee structure (both lanes)
| Fee | Amount | Where it goes | Enforced by |
|---|---|---|---|
| Launch fee | $1.50 flat (in SOL, live-priced; promo may set $0) | `PLATFORM_WALLET` (45YR…2VrE) | `SystemProgram.transfer` inside the launch tx (both lanes) |
| Trading fee | **0.45%** of every buy/sell | Split at claim: **75% creator** · **25% platform** | Custom lane: Token-2022 `TransferFeeConfig` at 45 bps. Pump lane: pump.fun accrues creator fees; OrbitX skims 25% at claim time (`DEFAULT_ROUTED_FEE_BPS = 2500`) |
| Platform swap fee | 0.95% on in-app swaps | `PLATFORM_WALLET` ATA (Jupiter feeAccount) | `PLATFORM_FEE_BPS = 95` |

**Of every $1 in trading fees claimed:** $0.75 → creator (Claim Fees) · $0.25 → admin (Launchpad Admin / `ROUTED_FEE_WALLET`).

Constants: `CREATOR_FEE_BPS = 45`, `TRADE_FEE_CREATOR_SHARE_PCT = 75`, `TRADE_FEE_PLATFORM_SHARE_PCT = 25` in `web/src/lib/platformFee.ts`.

## In-app claims — /orbitxlaunch/claim
Connect the SAME wallet that created the token.
- **Pump lane**: PumpPortal `/api/trade-local` `action: "collectCreatorFee"` builds the Pump program's own claim tx (creator-vault PDA `["creator-vault", creator]`). One signature claims across ALL the wallet's pump coins. Claimable balance shown from the vault PDA. Platform 25% is skimmed atomically in the same signed claim tx.
- **Custom lane**: 0.45% withheld on-chain by the transfer-fee extension. Claim = `WithdrawWithheldTokensFromAccounts` + `...FromMint`, signed by the creator (withdraw authority), then swap to SOL with the same 25% platform skim.
- **Anti-vamp**: flagged look-alike launches are minted with fee authority = platform wallet, so copycat fees fund OBX buybacks, not the copycat.

## Custom lane on-chain launch (mainnet)
Single transaction: launch fee -> mint account (TransferFeeConfig + MetadataPointer) -> **45 bps** fee config -> mint init -> on-chain metadata (name/symbol/uri; Metaplex-compatible display in Phantom/Solscan/Jupiter/Raydium; editable via Token Manager) -> creator ATA + full supply -> optional burn % -> optional revoke mint/freeze. Vanity "OBX…" mint keypair used when ground in the UI.
Optional: Raydium CPMM pool (supports Token-2022 transfer-fee tokens) seeded at the configured initial price, plus LP burn to the incinerator.
Every launch (both lanes) registers in `orbitx_tokens` (Supabase) — powers the Home feed, anti-vamp, and the Claim page.

> Note: Existing custom tokens minted at 30 bps stay at 30 bps on-chain. New launches use 45 bps. Pump.fun’s native curve fee remains protocol-controlled; OrbitX’s 75/25 split applies at claim time.
