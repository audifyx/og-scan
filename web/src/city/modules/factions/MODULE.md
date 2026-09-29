# Factions module — `web/src/city/modules/factions`

Trading firms, turf wars, graffiti crews, graffiti wars, and mayoral elections
for OrbitXCity. Four firms (Neon Bulls, Crimson Bears, Violet Whales, Gold
Apes) run the streets; players join one, rep its colors, fight for districts,
tag walls, and vote for mayor.

## Files

| File | Role |
|---|---|
| `index.ts` | Public barrel — the ONLY import point for integrators |
| `types.ts` | All shared types |
| `factions.ts` | The 4 firms: defs, colors, buffs, SVG logos, ranks, join/leave/rep rules |
| `turf.ts` | 5 districts on the 5×5 core grid, fee skim, turf-war rounds (deterministic) |
| `graffiti.ts` | Walls, tags, overpainting, wall buffs, graffiti wars, 3D decal builders |
| `elections.ts` | Mayoral terms, candidates, votes, burn-tax / fee-mult, settlement hook |
| `store.ts` | `FactionsStore` singleton: persisted state (localStorage), catch-up ticks |
| `useFactions.ts` | `useFactions()` React binding (`[state, store]`), player label helpers |
| `FactionsUI.tsx` | `<FactionsRoot/>` tabbed panel (Firms / Turf / Walls / Mayor) + `<FirmBadge/>` HUD chip |

## Core API needs (from `web/src/city/core/index.ts`)

- **Nothing required at boot.** The module is self-contained: its own store,
  persistence, economy accrual, and React UI. It does not fight the core
  loop for player/vehicle control.
- Optional integration points (integrator's choice, all documented in code):
  - Mount `<FactionsRoot onClose={…}/>` as a phone-menu tab or pause screen.
  - Drop `<FirmBadge/>` into the HUD to show the player's firm + turf count.
  - On load (and whenever walls change), add `placeWallDecal(wall)` meshes
    to the scene for each wall — position/rotation applied by the helper.
    Remove + dispose the old decal before re-adding (mesh is flagged with
    `userData.factionWallId`).
  - Geometry constants in `turf.ts` mirror core `CityBuilder` (BLOCKS=5,
    BLOCK=64, ROAD_W=14, PITCH=78, HALF=202). If the core grid ever changes,
    update these by hand — there are NO core imports by design.
- Graffiti-war clocks: call `store.tickWarClocks()` on an interval (~5s)
  and/or when the module UI opens so expired live wars get judged without
  needing another tag. Turf-war rounds advance only via explicit "Fight round"
  UI (player-driven, like GTA territory fights).

## Billing assumptions (per `web/src/city/BILLING_CONTRACT.md`)

- **Paper CITY for gameplay.** All wagers, war bonds, tag costs, fee skims,
  and war pots are paper. `store.tag()` / `contribute()` return the paper
  cost owed so the CALLER deducts from their own paper ledger — this module
  owns no wallet UI or balance.
- **Real ORBITX for premium: votes.** Casting a vote pledges real ORBITX
  (1 vote = 1 ORBITX, burned) per tokenomics #11. Until the tokenomics
  billing primitive lands, votes sit in `candidate.pendingVotes` and the UI
  says "pending settlement" — nothing on-chain, nothing burned.
- **Integration point:** `settleVotes(election, burn)` in `elections.ts`.
  When `useOrbitxBilling` exists, the integrator passes
  `(amount, reason) => billing.spend({ amount, reason })` and moves
  pendingVotes → votes on success. This module will NEVER import
  `@/tokenomics/*` directly — the burn fn is injected.
- The mayor's `burnTaxPct` (0–5%) is the lever that will apply to premium
  burns city-wide once the billing primitive lands; until then it is
  displayed and stored as policy only.
- Game never custodies keys or funds. No per-transaction popups.

## Assumptions / open notes

1. **Single-player local world.** State persists to localStorage
   (`orbitx-city-factions-v1`); district yields accrue on load (capped at
   24h catch-up). There is no server, no cross-player sync — NPC firms
   (candidate endorsements, rival crews) are deterministic seeds, not live
   opponents.
2. **Deterministic judging.** Turf-war rounds seed off `(war.id, round)`;
   graffiti wars seed off `war.id`. Same inputs → same verdict on every
   client, which keeps a future multiplayer honest.
3. **War bonds are sunk by the caller.** `declareTurfWar`/`stakeWar`
   record bonds but the paper deduction happens outside (integrator's
   ledger); on a "nobody takes it" resolution the bonds are returned to
   nobody automatically — caller should refund if they deducted.
4. **Mayor = policy only.** The burn tax and fee-share multiplier affect
   this module's math; they do not reach the real billing primitive yet.
   When billing lands, the integrator applies `office.burnTaxPct` inside
   their `spend()` wrapper.
5. **Player-as-mayor is cosmetic.** `runForMayor` lets the player stand;
   "isMayor" for the policy setters is determined by the integrator
   (pass `true` only when the player actually holds office) — there is no
   trusted identity check in this module.
6. **Wall buffs stack with firm buffs** in the UI display only; the module
   does not own the player's earnings pipeline, so buffs are advisory
   numbers for the integrator's economy to honor.
7. **Mobile-first UI.** All inline styles, no external CSS, 460px max panel,
   numeric-input filters on stake/vote fields.

## 3D placement notes

- `placeWallDecal(wall)` returns a positioned, rotated plane mesh — add it
  to the scene. Use `makeTagDecal`/`makeBlankDecal` directly for custom
  sizes. Decals are transparent, `depthWrite: false`, renderOrder 1–2 so
  they sit on building faces without z-fighting.
- District tint overlays (turf map in 3D): use `districtAt(bi, bj,
  districts)` + `blockCenter(bi, bj)` to tint block groups by controller
  color — left to the integrator's scene pass.
