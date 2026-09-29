# ORBITXCITY — buy-and-burn call pattern (for module teams)

**For the districts team** (and any module adding a new premium purchase):
every in-game ORBITX purchase MUST route through the canonical burn API in
`web/src/tokenomics/burnFlow.ts`. Do not call `billing.spend()` directly and
do not build a parallel burn path.

## The exact call pattern (two lines)

```ts
import { burnPurchase, burnReason } from "@/tokenomics/burnFlow";

// inside your purchase handler:
const res = await burnPurchase(billing, {
  amount,                                  // whole ORBITX tokens (floored automatically)
  itemId: "deed:penthouse-3",              // SKU — stable per purchase path
  label: "Penthouse deed",                 // human label for the burn ledger
  reason: burnReason("districts", "deed", "penthouse-3"), // → "city:districts:deed:penthouse-3"
  ref,                                     // optional idempotency ref; auto-generated when omitted
  module: "districts",
});
if (!res.ok) {
  // res.code: "not-authed" | "invalid-amount" | "failed" — show res.message, DO NOT grant the item
  return;
}
// res.signature — burn tx signature (or "dryrun:<ref>" in dry-run mode)
// res.dryRun — true when the test hook is active (no chain tx happened)
grantItem(); // only AFTER ok === true
```

In a React component, the hook version reads the shared billing from the city host:

```ts
import { useBurnPurchase } from "@/city/integration/cityPorts";
const { ready, balance, burning, buy, beginAuth } = useBurnPurchase();
const res = await buy({ amount, itemId, label, reason, module: "districts" });
```

## Rules

- **Reason namespace is mandatory**: `city:<module>:<action>[:<itemId>]`.
  Legacy dash-forms (`city-districts:x`, `city:police-bribe`) are normalized
  automatically by `burnPurchase`, but write the canonical form.
- **Guard before granting**: never grant the item on `!res.ok`.
- **Dry-run (test hook only)**: `setBurnDryRun(true)` in the console, or open
  any city URL with `?burnDryRun=1`. The purchase reaches the burn invocation
  with exact params, is recorded in the dry-run ledger
  (`getBurnDryRunLog()`), and `billing.spend()` is never called — no on-chain
  transaction. The user test-fires small real amounts himself.
- **Burn ledger**: real burns append to the shared ledger
  (`getBurnLedger()`, localStorage `orbitxcity:burn-log:v1`) — the bank UI
  reads it. Do not write your own parallel ledger.
- Currency split (per BILLING_CONTRACT.md): **paper CITY** for gameplay
  earnings/loot/wagers (local ledger) · **real ORBITX** for premium —
  everything premium burns.

## Registry-injection modules (reference)

Three modules can't take a `billing` prop, so the city host injects billing
into them instead (`registerModuleBilling` in `cityPorts.ts`):
heists (`setBillingProvider`), social (`injectSocialBilling`), sports
(`window.__orbitxBilling`). All three route through `burnPurchase` too.

## Backend gaps — bounty escrow API routes (DEFERRED, not in scope for client work)

Bounty escrow funding burns client-side today (`city:bounty:<bountyId>`), but
holding/paying out the escrow value needs server-side routes. Do NOT create
these in `web/api/` from the game side — the backend team owns them. Exact
routes needed:

1. `POST /api/city/bounty/escrow` — register an escrow after the funding burn.
   Body: `{ escrowRef, bountyId, amount (ORBITX), burnSignature }`. The
   backend verifies `burnSignature` on-chain (createBurnInstruction on the
   poster's ORBITX ATA, amount ≥ bounty amount, reason/index matches
   `escrowRef`), then records the escrow as funded. 409 on duplicate
   `escrowRef` (idempotent replay).
2. `POST /api/city/bounty/claim` — hunter claims a completed bounty.
   Body: `{ bountyId, hunterWallet }`. Backend checks bounty status/eligibility
   (expired, claimed, poster-cancelled rules from `bounty/store.ts`), then
   releases the escrowed value: either a backend-signed ORBITX transfer to the
   hunter, or credit to their in-app balance. Returns the payout signature.
3. `POST /api/city/bounty/cancel` — poster cancels an unclaimed bounty.
   Body: `{ bountyId, posterAuth }`. Backend returns the escrowed ORBITX to
   the poster (transfer or in-app credit) and marks the escrow released.
4. `GET /api/city/bounty/escrow?ref=<escrowRef>` — read escrow state
   (`funded` | `released` | `expired`) for the BountyBoard UI; the client
   must not trust localStorage for escrow state.

Until these land: escrow records stay local-only (`BountyStore.escrow`,
browser storage) and payouts cannot be enforced — the board should render
ORBITX bounties as "escrow pending backend" once funded.
