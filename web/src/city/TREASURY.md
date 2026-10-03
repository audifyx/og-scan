# OrbitX City — Job Payout Treasury

**Status (2026-10-03): UNFUNDED — no treasury address is configured.**

Until this changes, every ORBITX reward line in the job board honestly reads
"⏸ paused — treasury empty". CITY point payouts are unaffected (they're
off-chain game points paid immediately by the client).

## What the treasury is

A Solana wallet, owned and funded by the owner, that pays real ORBITX to
players who complete city jobs (cashier shift, delivery run, security patrol).
The game client can never move treasury funds — it only *queues* payout
requests in the player's browser (`localStorage` key `oxc-payouts-pending`).

## Funding it (owner steps)

1. Create (or pick) a Solana wallet to act as the city treasury.
   Recommended: a fresh wallet, not your main trading wallet.
2. Fund it with the ORBITX you want to pay out over time, plus a little SOL
   for transaction fees.
3. Set the address so the game knows where the money comes from — either:
   - build-time: `VITE_CITY_TREASURY=<address>` in the Vercel env for
     `prj_zq0S9PT1758Gc2BlSa1R3Uumjao1`, or
   - runtime (per device): the game reads `localStorage` key `oxc-treasury`
     (see `setTreasuryAddress` in `web/src/city/jobs/treasury.ts`).
4. Sweep the payout queue: read `oxc-payouts-pending` entries
   (`{ wallet, jobId, amountOrbitx, at }`) and send the ORBITX. A small
   operator script can do this on a schedule; clear entries as they're paid.

## Payout flow (code)

- `web/src/city/jobs/Jobs.ts` → `completeJob()`:
  - CITY: `addCityPoints()` immediately, always.
  - ORBITX: if `getTreasuryStatus().funded` → `queuePayout(...)` and the UI
    shows "+X ORBITX · queued for treasury sweep". If not funded → the UI
    shows "+X ORBITX · ⏸ paused — treasury empty" and nothing is queued.
- `web/src/city/jobs/treasury.ts` → `getTreasuryAddress()`:
  `localStorage` override first, then `VITE_CITY_TREASURY`.

## Treasury address

```
(not set — owner to fund; see steps above)
```

## Honesty rule

ORBITX rewards must never be displayed, implied, or logged as paid unless a
real on-chain transfer from the funded treasury confirms it. "Paused" is a
valid permanent state — never fake it.
