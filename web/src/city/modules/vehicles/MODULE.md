# Vehicles Module — OrbitXCity

GTA-style vehicle systems: ownership, fuel, mods, water, air-adjacent
(submarine), gangs, and competitions. **Logic-only, no DOM** — the integrator
(core page shell) renders, ticks per-frame functions, applies `PaperDelta`s
through its ledger, and routes burns through the injected `IBurnProvider`.

## Files

| File | Owns |
|---|---|
| `index.ts` | Public barrel (re-exports everything below) |
| `types.ts` | Shared types: `VehicleDef`, `VehicleInstance`, `ModDef`, `PaperDelta`, `PaperLedger`, `BurnReceipt`, `HandlingParams` |
| `data/catalog.ts` | 16 vehicle defs + 16 chop-shop mods + per-kind `VEHICLE_HANDLING` tunables |
| `economy.ts` | Burn bridge: `IBurnProvider`, `createNullBurnProvider()`, `adaptBillingToBurnProvider()` |
| `garage.ts` | Title ledger (`Garage`), purchase pricing, pink-slip transfer, sellback |
| `dealership.ts` | Premium Motors showroom, two-phase purchase, 60s test drives |
| `fuel.ts` | 6 stations (gas/diesel/EV + fast charge), consumption tick, refuel quotes |
| `mods.ts` | Chop shop: quote + install, one-mod-per-slot, ORBITX burn on performance |
| `gangs.ts` | 3 MC clubhouses, formation-slot math, rep + formation-ride payouts |
| `impound.ts` | Seize/release, paper fine vs ORBITX bribe paths |
| `lowrider.ts` | Hydro Arena contests: 3-round judged scoring, ORBITX entry, paper pot |
| `marina.ts` | Marina del Orbit: jet-ski rentals, boat charters, superyacht berths |
| `trails.ts` | 5 BMX/dirt-bike trails, timed runs, medal payouts, gate checks |
| `submarine.ts` | Sub Dock, 6 wreck sites, 4 guided tours, loot rolls, O2 + crush-depth |
| `diving.ts` | Dive shop (scuba gear), 4 dive sites, 12 treasure chests, O2 tick, 24h respawn |

## Billing (per `web/src/city/BILLING_CONTRACT.md`)

- **Paper CITY** (local ledger, no chain): gameplay earnings and loot —
  trail medals, formation-ride payouts, wreck loot, chest loot, hydro pots,
  sellbacks, refuel, rentals, charters, cosmetic paint/neon, scuba gear,
  impound fines.
- **Real ORBITX** (backend-signed burn, auth-once, no popups): premium
  purchases (Serape '62, Warlord Bagger, Neptune 88, Nautilus Mini-Sub),
  **every performance mod** (engine/turbo/tires/suspension/armor/hydraulics/
  hull/ballast), hydro contest entries, impound bribes.
- Until `@/tokenomics/useOrbitxBilling` exists, the integrator injects
  `createNullBurnProvider()`; every premium action resolves a
  `paperOnly: true` receipt logged on `provider.log` as **pending billing** —
  nothing silently pretends to burn. Never import `@/tokenomics/*` here.
- Game never custodies keys/funds; `adaptBillingToBurnProvider` maps the
  tokenomics hook shape 1:1 (documented in `economy.ts`).

## Core needs (from `web/src/city/core/index.ts`)

Core owns base car driving (`CarPhysics`, `GTAWorld.toggleEnterExit`,
`inCar` drivable). This module needs the following from core/the integrator —
**flagged, not built here**:

1. **Drivable registration** — a way to spawn module vehicles (esp.
   jetski/yacht/submarine, choppers, lowriders) as core `Drivable`s so the
   existing enter/exit flow picks them up. `toggleEnterExit()` currently takes
   the nearest untaken drivable within 4.5m; the module needs the `Drivable`
   shape / a `registerDrivable()` hook.
2. **Enter/exit notifications** — callbacks when the player enters/exits a
   vehicle so the module can sync fuel (`consumeFuel`), mileage/condition,
   impound gating (`isDrivable`), and rental expiry.
3. **Water physics** — `CarPhysics` is land-only (circle colliders). Watercraft
   need a water-plane drive mode; the submarine needs dive/surface + depth.
   Either core adds a water mode, or core yields vehicle control while the
   active drivable is flagged watercraft (additive per core's rule — the
   module never fights the core loop).
4. **Underwater scene** — wrecks (`WRECKS`), dive sites (`DIVE_SITES`), and
   chest markers (`chestWorldPos`) need 3D placement plus a water
   volume/underwater fog. Core owns the scene; the module supplies positions.
5. **NPC riders** — formation riding needs AI wingman bikes. Core exposes
   `createTrafficCar`/`updateTrafficCar` for cars; the module needs an
   equivalent bike spawn or a generic NPC-rider hook (formation targets come
   from `formationTarget()`).
6. **Hydraulics visual** — lowrider bounce needs a body-offset hook on the
   vehicle mesh, driven by `bounceFromTiming()`; cosmetics (paint/neon) need a
   material hook on `createCarMesh`.
7. **Handling application** — `VEHICLE_HANDLING` per-kind tunables
   (`HandlingParams`) are meant to be multiplied into core's driving
   constants per active vehicle kind.

World access path: `useGtaGame().getWorld()` returns the live `GTAWorld`
(player state via `getPlayerState()`, teleport, scene).

## Assumptions

- Map coordinates (`x`/`z` on every `MapPoint`, wreck, trail, chest) are
  module-local guesses on the core city grid — the integrator remaps them to
  the real layout (`CITY_SPAN`/`HALF` in core). Water sites sit at +x/+z
  offshore by convention.
- The paper-CITY wallet lives in the **economy module** (not built here).
  This module only emits `PaperDelta`s; the integrator applies them via the
  structural `PaperLedger` interface (earn/spend/balance).
- No persistence in-module except `Garage.serialize()`/`restore()`; the
  integrator owns save/load. `CHESTS` `lootedAt` is mutated via the
  `openChest` return value — the integrator persists it.
- `Math.random()` loot rolls are gameplay rolls, not consensus randomness;
  fine for paper payouts.
- Mobile: the module creates no DOM and runs no per-frame allocations beyond
  small object spreads; touch controls and HUD are core's. Blip labels are
  kept short for the minimap.
- Product law: **premium never drops as loot** — chests and wrecks pay paper
  only; every ORBITX movement is a player-authorized burn.

## Feature status

| Idea | Status | Notes |
|---|---|---|
| Car dealership | BUILT | Showroom, two-phase purchase, test drives (`dealership.ts`) |
| Chop shop (perf mods, burned ORBITX) | BUILT | 13 perf mods, all ORBITX-burn; cosmetics paper (`mods.ts`) |
| Gas stations + EV chargers | BUILT | 6 stations, consumption tick, refuel quotes (`fuel.ts`) |
| Impound lot | BUILT | Seize/release, fine vs ORBITX bribe (`impound.ts`) |
| Yacht marina | BUILT | Charters, berths for owned superyachts (`marina.ts`) |
| Jet skis | BUILT | Timed rentals, fleet sessions (`marina.ts`) |
| Biker gangs (MC clubhouses, formation riding) | BUILT | 3 clubs, formation-slot math, rep/payouts (`gangs.ts`) |
| Lowrider hydraulics competitions | BUILT | Judged 3-round contests, ORBITX entry, paper pot (`lowrider.ts`) |
| BMX / dirt bike trails | BUILT | 5 trails, medals, gate checks (`trails.ts`) |
| Submarine tours (underwater wrecks with loot) | BUILT | 6 wrecks, 4 tours, O2 + crush-depth gating (`submarine.ts`) |
| Deep sea diving (treasure chests) | BUILT | 4 sites, 12 chests, scuba gear, 24h respawn (`diving.ts`) |

BLOCKED: nothing in-module. Integration items 1–7 above are core/integrator
work (vehicle spawning, water physics, underwater scene, NPC riders,
enter/exit hooks) — flagged here, not built here, per the no-cross-module
rule.
