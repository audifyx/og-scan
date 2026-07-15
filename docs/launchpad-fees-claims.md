# OrbitX Launchpad — Fees & Creator Claims (pump.fun parity)

## Fee structure (both lanes, identical)
| Fee | Amount | Where it goes | Enforced by |
|---|---|---|---|
| Launch fee | $1.50 flat (in SOL, live-priced) | `PLATFORM_WALLET` (45YR…2VrE) | `SystemProgram.transfer` inside the launch tx (both lanes) |
| Creator trading fee | 0.30% of every buy/sell | Token creator | Pump lane: pump.fun native creator fee (0.30% bonding curve, dynamic after graduation). Custom lane: Token-2022 `TransferFeeConfig` at 30 bps |
| Platform swap fee | 0.95% on in-app swaps | `PLATFORM_WALLET` ATA (Jupiter feeAccount) | `PLATFORM_FEE_BPS = 95` — pump.fun's protocol-fee rate |

Rates mirror pump.fun/docs/fees (May 2026): bonding curve = 0.30% creator + 0.95% protocol.

## In-app claims — /orbitxlaunch/claim
Connect the SAME wallet that created the token.
- **Pump lane**: PumpPortal `/api/trade-local` `action: "collectCreatorFee"` builds the Pump program's own claim tx (creator-vault PDA `["creator-vault", creator]`). One signature claims across ALL the wallet's pump coins. Claimable balance shown from the vault PDA.
- **Custom lane**: 0.30% withheld on-chain by the transfer-fee extension. Claim = `WithdrawWithheldTokensFromAccounts` + `...FromMint`, signed by the creator (withdraw authority). Paid in the token itself.
- **Anti-vamp**: flagged look-alike launches are minted with fee authority = platform wallet, so copycat fees fund OBX buybacks, not the copycat.

## Custom lane on-chain launch (mainnet)
Single transaction: $1.50 fee -> mint account (TransferFeeConfig + MetadataPointer) -> 30 bps fee config -> mint init -> on-chain metadata (name/symbol/uri; Metaplex-compatible display in Phantom/Solscan/Jupiter/Raydium; editable via Token Manager) -> creator ATA + full supply -> optional burn % -> optional revoke mint/freeze. Vanity "OBX…" mint keypair used when ground in the UI.
Optional: Raydium CPMM pool (supports Token-2022 transfer-fee tokens) seeded at the configured initial price, plus LP burn to the incinerator.
Every launch (both lanes) registers in `orbitx_tokens` (Supabase) — powers the Home feed, anti-vamp, and the Claim page.
