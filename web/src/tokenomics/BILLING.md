# ORBITX Tokenomics — billing integration guide

The official ORBITX utility backbone. All spends are **backend-signed ORBITX
burns** from the user's in-app (desk) wallet — auth once up front, seamless
after. No signing popups, ever. Nothing here custodies keys or holds funds.

## The one primitive

```tsx
import { useOrbitxBilling } from "@/tokenomics";

const { ready, balance, spend, beginAuth } = useOrbitxBilling();
// ready:   auth-once complete, backend spendable
// balance: on-chain ORBITX in the in-app wallet (null while loading)
// spend:   ({amount, reason, ref}) => Promise<{signature}>
// beginAuth: () => void — kicks the dashboard auth-code flow
```

`spend()` calls the existing `orbitx_app_burn` MCP tool with the stored
authCode → backend `prepareBurn` (`createBurnInstruction`, same as
`buildMcpAccessBurnTransaction`) → `signAndSendUserTx` with the sealed
per-user desk key. Every spend is appended to a local ledger
(`getSpendLedger()`) keyed by your `ref`.

## The 20 use-cases → what to import

| # | Use-case | Import / price |
|---|----------|----------------|
| 1 | Boost launch | `BurnButton amount={ORBITX_PRICES.launchBoost} reason={spendReason.launchBoost(mint)}` |
| 2 | Pin post | `<PinButton postId />` |
| 3 | Pro terminal | `useProAccess()` + `unlock(spend)` |
| 4 | Alpha channels | `useAlphaGate()` (10k ORBITX hold) |
| 5 | AgentPlus compute | `spend({amount: ORBITX_PRICES.agentPlusTask, reason: spendReason.agentPlusTask(id)})` |
| 6 | Badge / vanity handle | `BurnButton` + `spendReason.verifiedBadge()` / `vanityHandle(h)` |
| 7 | Tips | `<TipButton recipient={handle} />` |
| 8 | Bounties | `<BountyBoard />` |
| 9 | Competitions | `<CompetitionBoard />` |
| 10 | Fee discounts | `useFeeDiscount()` (`feeDiscountBpsFor(balance)`) |
| 11 | Voting | `<VoteWidget proposalId title options />` |
| 12 | Ticker / profile URL | `BurnButton` + `spendReason.tickerReserve(t)` / `profileUrl(s)` |
| 13 | Priority support | `useSupportPriority()` |
| 14 | API metering | `useApiMetering(keyId)` |
| 15 | Referral rewards | `spend({reason: spendReason.referralReward(pool)})` |
| 16 | NFT mint fees | `spend({amount: ORBITX_PRICES.nftMintFee, reason: spendReason.nftMint(c)})` |
| 17 | Theme marketplace | `<ThemeMarketplace />` (registry is read-only) |
| 18 | Auctions | `useAuctions()` / `settleAuctionPure()` — bids burn at bid time, losers burned by construction |
| 19 | Builds board | `BurnButton` + `spendReason.buildsFeature(projectId)` |
| 20 | City burn engine | `billing.spend({amount, reason: spendReason.cityPremium(itemId)})` |

## Game team (city)

See `web/src/city/BILLING_CONTRACT.md`. Currency split: paper CITY for
gameplay (local), real ORBITX for premium via `spend()` with
`reason: "city-bank:<itemId>"`. Every in-game purchase burns.

## BLOCKED (needs backend work — frontend is wired, do not invent)

- **Tip recipient payout**: no `orbitx_app_send` transfer tool exists; tips
  burn tagged to the recipient until the backend transfer tool ships.
- **Governance tally**: burns are the ballots; no on-chain vote program /
  backend tally endpoint yet.
- **API metering**: client counter only; needs a server-side per-key usage
  ledger + auto-burn.
- **Prize-pool / theme escrow**: burn-verified local ledgers; needs backend
  escrow for trustless pools.
- **Ticker / profile-URL registry**: needs a backend uniqueness registry.
- **Referral rewards pool**: needs a funded rewards wallet + payout job.
