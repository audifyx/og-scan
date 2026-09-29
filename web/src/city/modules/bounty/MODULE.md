# OrbitXCity — Bounty Module

GTA-style bounty system for OrbitXCity: post bounties on rival players' heads
(paper CITY for gameplay, real ORBITX burned via backend), browse the board,
claim flow for hunters, full lifecycle (post → escrow → claim / cancel /
expiry). Self-contained under `web/src/city/modules/bounty/**` — no imports
from other modules, core, or `@/tokenomics`.

## Files

| File | What it is |
|---|---|
| `index.ts` | Public API (re-exports everything the integrator needs) |
| `types.ts` | `Bounty`, `BountyStatus`, `BountyCurrency`, `EscrowRecord`, `PaperLedgerPort`, `OrbitxBillingProvider`, result/error unions |
| `store.ts` | Framework-agnostic `BountyStore`: posting, claiming, cancel, expiry sweep, localStorage persistence (`orbitxcity:bounties:v1`) |
| `useBounties.ts` | `useBountyStore()` React binding (single shared instance, revision-snapshot) |
| `BountyBoard.tsx` | Board UI: Open / My bounties / History tabs, bounty cards, claim buttons, post entry point |
| `PostBountyModal.tsx` | Post form: target, amount, currency toggle, duration, note, ORBITX auth gate |
| `ClaimBountyModal.tsx` | Hunter claim flow (confirm → payout) |
| `ui.tsx` | Shared copy/formatting atoms (error text, countdowns, badges) |

## Public API (from `index.ts`)

```tsx
import {
  BountyBoard,            // main UI — mount as modal/panel
  PostBountyModal,        // standalone post form (optional separate mount)
  ClaimBountyModal,       // standalone claim flow (optional separate mount)
  getBountyStore,         // shared BountyStore instance
  useBountyStore,         // React binding
  BOUNTY_DURATIONS,       // 6h / 24h / 3d / 7d
  MIN_CITY_BOUNTY, MAX_CITY_BOUNTY,      // 10 … 1,000,000
  MIN_ORBITX_BOUNTY, MAX_ORBITX_BOUNTY,  // 1 … 10,000
} from "@/city/modules/bounty";
```

## Integration

### 1. Mount the board

```tsx
const [boardOpen, setBoardOpen] = useState(false);

{boardOpen && (
  <BountyBoard
    me={{ playerId, displayName }}   // current player identity
    paper={paperLedgerPort}          // see §2
    billing={orbitxBilling}          // see §3 (optional until tokenomics lands)
    resolvePlayerId={lookupPlayerId} // optional, see §4
    initialTarget="NeonViper"        // optional prefill from a player interaction
    onClose={() => setBoardOpen(false)}
  />
)}
```

Suggested mount points (integrator's choice):
- A **"Bounty board" kiosk/marker** in the world (e.g. near a bar or garage)
  → opens the board.
- A **HUD button** ("🎯 Bounties") on mobile + desktop.
- A **player context action**: long-press / right-click a rival player or
  their car → "Post bounty on {name}" → board with `initialTarget`.

### 2. Paper-CITY ledger port (required)

The module never touches the economy module's internals. The integrator
implements `PaperLedgerPort` against the paper wallet (economy module's
store), e.g.:

```ts
import type { PaperLedgerPort } from "@/city/modules/bounty";

const paperLedgerPort: PaperLedgerPort = {
  getBalance: () => paperWallet.balance,
  debit: async (amount, label) => tryDebitPaper(amount, label), // false if insufficient
  credit: async (amount, label) => creditPaper(amount, label),
};
```

### 3. ORBITX billing (optional until tokenomics lands)

`OrbitxBillingProvider` in `types.ts` is a verbatim copy of the contract in
`web/src/city/BILLING_CONTRACT.md` (self-containment rule forbids importing
`@/tokenomics`). When `web/src/tokenomics/useOrbitxBilling` exists, inject
it directly — no adapter needed:

```tsx
import { useOrbitxBilling } from "@/tokenomics/useOrbitxBilling";
const billing = useOrbitxBilling();
<BountyBoard me={me} paper={paperLedgerPort} billing={billing} … />
```

Behavior when `billing` is absent or `billing.ready === false`: the ORBITX
currency tab shows the auth gate ("Auth ORBITX billing" → `beginAuth()`), and
posting an ORBITX bounty returns `billing_not_ready`. CITY bounties always work.

### 4. Player identity / name → id resolution (assumption)

`me: BountyPlayer` is required — wire to whatever identity the game has
(wallet pubkey, session id, display name).

`resolvePlayerId` is **optional**; when absent the module falls back to a
deterministic `player_<slug>` of the typed name. If a player directory /
multiplayer roster exists later, pass a real resolver so bounties target real
player ids. The board is fully usable single-player today: targets are
by-name bounties on rivals/bots/NPCs.

### 5. Backend routes for ORBITX escrow (assumption — not built here)

ORBITX posting burns on the client via `billing.spend({ reason:
"city:bounty:<id>", ref: <escrowRef> })` — no wallet popup, backend-signed,
per the billing contract. The backend escrow service indexes by `escrowRef`.
The module calls three JSON routes (all relative to the app origin):

| Route | Body | Purpose |
|---|---|---|
| `POST /api/city/bounties/claim` | `{ bountyId, escrowRef, hunterPlayerId, hunterName, amount }` | backend-signed hunter payout → `{ signature? }` |
| `POST /api/city/bounties/expire` | `{ bountyId, escrowRef }` | backend-signed refund / re-burn per tokenomics policy |
| `POST /api/city/bounties/cancel` | `{ bountyId, escrowRef }` | backend-signed refund to poster |

**Fail-closed by design:** if any route is missing/fails, the store returns
`backend_pending`, the bounty stays OPEN, and nothing is credited locally.
The escrow record keeps `escrowRef` + `burnSignature` so the backend can
settle out of band. If the backend team prefers burn-only semantics
(no hunter payout), the claim route can just return 200 with a re-burn
signature — the module records it as `payoutSignature`.

## Lifecycle summary

1. **Post** — validate (no self-target, whole amounts, limits, open-cap 200) →
   CITY: debit paper → local escrow record · ORBITX: backend-signed burn spend
   (ref = escrowRef) → escrow record with signature.
2. **Claim** — hunter ≠ poster, bounty open → CITY: credit paper immediately ·
   ORBITX: backend claim route must 200 first, then mark claimed (never mark
   without it).
3. **Cancel** — poster only, open bounties → CITY: refund paper ·
   ORBITX: backend cancel route.
4. **Expiry** — `startSweep()` interval (board starts it on mount; the
   integrator can also run it from the main game loop) → CITY: auto-refund
   poster · ORBITX: backend expire route; if unavailable, bounty leaves the
   board but keeps its escrowRef for out-of-band settlement (logged as
   `escrow_failed` event).

Lifecycle events are logged per bounty (`eventsFor(bountyId)`) and shown in
the History tab.

## Props / mount summary

| Prop | Type | Required | Notes |
|---|---|---|---|
| `me` | `BountyPlayer` | yes | `{ playerId, displayName }` |
| `paper` | `PaperLedgerPort` | yes | paper-CITY debit/credit |
| `billing` | `OrbitxBillingProvider` | no | omit → ORBITX path shows auth gate |
| `resolvePlayerId` | `(name) => Promise<string \| null>` | no | default: slug of name |
| `initialTarget` | `string` | no | prefill post form |
| `onClose` | `() => void` | no | board dismiss |

All components are mobile-first (bottom-sheet on small screens, centered
modal on desktop), dark GTA styling, ≥44px touch targets.

## Assumptions (for the integrator)

1. `web/src/tokenomics/` does not exist yet — billing is injected, never
   imported by this module (verified absent 2026-09-29).
2. No global player registry yet — target resolution falls back to a name
   slug; swap in a real resolver when multiplayer identity lands.
3. The three backend escrow routes don't exist yet — ORBITX claim/cancel/
   expiry degrade to `backend_pending` until they do (paper CITY is fully
   functional today).
4. Paper wallet lives in the economy module — the integrator bridges it via
   `PaperLedgerPort`; this module imports nothing from `modules/economy`.
5. Cross-device/multiplayer sync is out of scope — localStorage is the
   mirror; the backend escrow service is the source of truth for ORBITX.

## What was NOT built

- No 3D world markers. The integrator can add a bounty-board kiosk via core's
  module APIs (all on the `GTAWorld` instance from the `useGtaGame` hook's
  `getWorld()`): `world.sceneRef` for additive scene work (kiosk mesh/marker),
  `world.getPlayerState()` for proximity checks (open the board when the
  player is near), `world.teleport(x, z, heading)` if a kiosk should fast-
  travel the player. Do NOT import core from this module — keep the
  self-containment rule; the integrator owns that glue.
- No player context menu (long-press rival → "Post bounty") — integrator's
  call, using the same core APIs above.
- No notification toasts for "bounty claimed on you" (integrator can watch
  `store.subscribe` + `eventsFor`).
- No admin/moderation surface for abusive targets.
