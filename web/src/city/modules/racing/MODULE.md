# OrbitXCity — Racing Module (MODULE.md)

**Team:** Racing module · **Area:** `web/src/city/modules/racing/**` (exclusive)

GTA-style street racing, midnight pink-slip duels, and desert rally raids.
Third-person, realistic (not blocky), mobile-friendly. All races run **paper
CITY pools**; entry fees burn **real ORBITX** via the backend once the
tokenomics primitives land — until then the module degrades gracefully to
paper-only mode. The game never custodies keys or funds.

## What was built

| # | Idea | Status | Notes |
|---|------|--------|-------|
| 1 | Street racing circuit — PvP races (multiplayer-ready; AI/crew simulation v1), entry fees burned, winner takes paper pool | **BUILT** | `races.ts` `RaceSession`: lobby → countdown → racing → finished state machine, checkpoint/lap timing, live positions, wrong-way detection, DNF grace, paper-CITY pool settle. Bots via `ai.ts`; `createRemoteRacer` reserves the netcode slot. Races burn entry ORBITX through `IBurnProvider` (null provider = paper-only until billing lands). |
| 2 | Midnight pink-slip races — lose the race, lose the car | **BUILT** | `pinkSlip.ts`: proposed → accepted → racing → settled duel flow. Duels race on the `night-market` circuit only inside the 22:00–04:00 game-time window (`isMidnightWindow`; `dayTToHour` converts core's `dayT`, verified 0 = midnight in `core/World.ts`). `createDuelRaceSession(duel, circuit, challenger, challenged, opts)` wires an accepted duel into a real 2-racer `RaceSession`; after `session.settle()`, call `settleDuel(reg, duel, result.winnerId)` to transfer the loser's title. `CarTitleRegistry` is a local title ledger — loser forfeits their staked car on settle. |
| 3 | Desert rally raids outside the city | **BUILT** | `rally.ts` + 3 routes in `tracks.ts` (Dust Bowl Dash, Cactus Run, Mirage Crossing, all out in the dunes at ±240–1080 m — city spans ±202 m, verified from `core/CityBuilder.ts` HALF=202). Time-trial discipline: `RallyStageRun` times the player's live checkpoints with co-driver pace notes; rival times simulated from skill+noise; multi-stage cumulative standings. `RallyRaid.settle()` returns per-racer CITY deltas (overall winner +`prizeCity`) for `paperWallet` crediting, mirroring `RacePool.payout`. |

Multiplayer/PvP is **multiplayer-ready, AI-simulated in v1** per the approved
scope: `IRacer` treats player / bot / remote identically, so real netcode can
be swapped in later without touching the session logic.

## Public API (`index.ts`)

- **Tracks:** `buildStreetCircuits(nodes)` (5 circuits from the core road
  grid: Downtown GP, Inner Ring, Night Market Circuit, Financial Sprint,
  Harbor Run), `buildRallyRoutes()` (3 desert routes), `startGridSlots()`,
  `startHeading()`.
- **Session:** `RaceSession` (`payEntryFees`, `startCountdown`,
  `update(dt)` → `RaceEvents`, `standings()`, `settle()` → `RaceResult`),
  `RaceConfig`. Throws on zero entrants.
- **Racers:** `createBotRacer` (pure-pursuit AI w/ curvature lookahead,
  rubber-banding, wrong-way recovery), `createPlayerRacer` (+`setCommand`),
  `createRemoteRacer` (netcode placeholder), `randomBotProfile`.
- **Economy:** `RacePool` (paper-CITY pot, winner-takes-all), `collectEntryBurns`,
  `createNullBurnProvider`, `IBurnProvider`, `BurnOpts`, `BurnReceipt`.
- **Pink slip:** `CarTitleRegistry`, `proposeDuel`, `acceptDuel`,
  `declineDuel`, `beginDuelRace`, `createDuelRaceSession` (+`DuelRaceOpts`),
  `settleDuel`, `isMidnightWindow`, `dayTToHour`.
- **Rally:** `RallyRaid` (incl. `settle()` → per-racer CITY deltas),
  `RallyStageRun`, `fmtRaceTime`.
- **Billing adapter:** `adaptBillingToBurnProvider(billing)` — maps the
  tokenomics hook shape to `IBurnProvider` (structural, no `@/tokenomics/*`
  import). Also exports `BillingLike` for typing the adapter input.

No imports from other modules. Only external dep: `three` (types only —
`Vector3` in `VehicleLike`).

## Integration points — exact needs from core

### 1. Road grid → circuits
`buildStreetCircuits` takes the core grid nodes (`core` `CityData.nodes`:
`Vec2[][]`, indexed `[i][j]` 0..5 — core's BLOCKS=5 grid) and returns the
circuit catalogue. It must be called once with the live grid:
```ts
import { buildStreetCircuits } from "@/city/modules/racing";
const circuits = buildStreetCircuits(world.city.nodes /* Vec2[][] [i][j] 0..5 */);
```
**Verified against core source (2026-09-29):** `core/CityBuilder.ts` —
`BLOCKS = 5`, `RoadNode { x: number; z: number }` (structurally satisfies
`Vec2`), `nodes: RoadNode[][]` indexed `[i][j]` for i,j in 0..BLOCKS;
`HALF = 202` (city spans ±202 m, so rally routes at ±240–1080 m are clear of
the city).

### 2. Vehicle physics hooks (player)
Core owns the player car through `CarPhysics` (`pos: THREE.Vector3`,
`heading: number`, `speed: number`), which satisfies `VehicleLike`
structurally — the module never constructs or drives the player car.
**Verified against `core/Vehicle.ts` (2026-09-29):** `CarPhysics` exposes
`pos: THREE.Vector3`, `heading: number`, `speed: number`, with
`maxSpeed = 36` / `maxReverse = 12` / `accel = 16` / `brake = 30` — the
module's `integrateKinematic` mirrors exactly these constants for bots, so
bot pace matches core player-car feel.
Integration per frame while a race is live:
- Feed core driving input into the racer: `playerRacer.setCommand({ throttle, steer, handbrake })` from WASD / touch joystick.
- Race loop: `session.update(dt)` every tick; the module integrates only
  `kind !== "player"` cars internally (`integrateKinematic`) — **never fight
  the core loop for player control**.
- Grid placement: `teleport(x, z, heading)` the player (and spawn/warp bot
  cars) onto `startGridSlots(circuit, entrantCount)`; `startHeading(circuit)`
  gives the grid facing.
- Checkpoint FX: additive scene work via `sceneRef` (checkpoint beacons,
  finish banners). Render the events from `RaceEvents`
  (`countdownTick`, `go`, `checkpointHits`, `lapCompletions`, `finishes`,
  `wrongWay`, `raceOver`) into SFX/HUD.
- HUD: `session.standings()` each frame for the live tower; `fmtRaceTime`
  formats stage/lap times.

### 3. Bot car meshes
The integrator spawns bot cars for each `IRacer` (`kind: "bot"`); the module
integrates their kinematics but the integrator owns meshes (e.g.
`createCarMesh` + `botProfile.color` as paint) and must sync mesh transform
from `vehicle.pos/heading` every frame.

### 4. Day/night for pink-slip gating
Pink-slip duels race only in the midnight window. The integrator passes a
game hour: `getPlayerState().dayT` → `dayTToHour(dayT)` → `isMidnightWindow(h)`
before calling `beginDuelRace`. Proposal/acceptance can happen anytime.
**Verified against `core/World.ts` (2026-09-29):** `GTAWorld.getPlayerState()`
exposes `dayT` (0 = midnight, confirmed by the lighting comment at
World.ts:415); `dayTToHour` assumes exactly this convention.

### 5. Rally stage teleport
Rally stages are outside the city (±240–1080 m). Teleport the player to
`route.checkpoints[0]` per stage; the module times checkpoints via
`RallyStageRun` — the integrator calls `checkpoint(nowSec)` as the car (core
physics) crosses each checkpoint.

### 6. Paper-CITY payouts
`session.settle()` / `RallyRaid` produce paper-CITY pots. Credit them through
the economy module's shared wallet:
```ts
import { paperWallet } from "@/city/modules/economy";
paperWallet.earn(result.potCity, `Race win — ${result.circuitName}`, "racing:win");
```
(Imports flow from other modules *into* economy; racing never imports it.)
For raids, `raid.settle()` returns the same per-racer delta shape as
`RacePool.payout()` (overall winner +`prizeCity`, others 0) — `null` until the
raid `isComplete()`. For pink-slip duels the stakes are the cars themselves
(`settleDuel` transfers titles); optional CITY side-bets come through the
same `session.settle()` pool path.

### 7. Garage titles for pink slip
The garage module seeds `CarTitleRegistry.register(car)` with the player's
owned cars; after `settleDuel` it applies `transfers` to the real garage.
v1: local title ledger only, no chain transfers.

### 8. Billing (real ORBITX entry fees)
Until `@/tokenomics/useOrbitxBilling` exists, the page shell passes
`createNullBurnProvider()` — races run, burns are recorded locally, and the
race UI must render the entry-fee burn as "pending billing"
(`session.paperOnlyFees === true`). Once the primitive lands:
```ts
import { useOrbitxBilling } from "@/tokenomics/useOrbitxBilling";
import { adaptBillingToBurnProvider, createNullBurnProvider } from "@/city/modules/racing";
const billing = useOrbitxBilling();
const burnProvider = billing?.ready ? adaptBillingToBurnProvider(billing) : createNullBurnProvider();
```
Billing rules honored: auth-once up front (existing dashboard auth-code flow),
every spend seamless backend-signed `createBurnInstruction` burn, no wallet
popups ever, game never custodies keys. Entry-fee burn reason:
`"city:racing:entry-fee"` (see BILLING_CONTRACT #20 — every in-game purchase
burns).

## Assumptions about not-yet-existing shared code (marked per instructions)

- **`@/tokenomics/useOrbitxBilling` DOES NOT EXIST YET — HARD RULE honored:**
  nothing in this module imports `@/tokenomics/*` (it would break the
  production build). `adaptBillingToBurnProvider` takes a structural
  `BillingLike` instead. Verified: `web/src/tokenomics/` does not exist in
  the current tree.
- **Expected interface** mirrors `web/src/city/BILLING_CONTRACT.md` exactly
  (`ready`, `balance`, `spend({amount, reason, ref?})` → `{ signature }`).
- **Netcode:** `createRemoteRacer` behaves as a mid-skill bot locally so
  lobby/session paths are exercised; real packet interpolation swaps in later.
- **Garage module:** doesn't exist yet — `CarTitleRegistry` is the module's
  own local title ledger until the garage team provides the real one.

## Assumptions / caveats

- Paper CITY pools are a local ledger (`RacePool`); the economy module's
  `paperWallet` is the shared source of truth for balances — racing reports
  deltas, the integrator credits them.
- Bot kinematics (`integrateKinematic` in `races.ts`) mirror the *feel* of
  core's `CarPhysics` (top speed 36 m/s) without duplicating collision code;
  bots race on closed circuits and the integrator may add collider resolution
  around the module step if needed.
- Rally rivals are simulated times (skill-scaled base pace ~92–130 km/h +
  noise, ~4% DNF for rookies) so raids work fully offline in v1.
- Score/position model: laps × checkpoints + fractional progress; finished
  racers always outrank unfinished.
- Checkpoint radius 14 m on city circuits, 18 m on desert stages; start grid
  staggers 2-wide, 9 m rows behind the line, player in slot 0 (back of pack,
  GTA style).
- `RaceSession` id uses `Date.now()` + a sequence — unique per session, but
  not collision-proof across tabs; burn `ref`s include the race id for
  idempotency per burn call.
- Mobile-friendly: the module itself is logic-only (no DOM/CSS) — touch
  input comes through core's existing touch controls (`setTouchMove`,
  `setTouchSprint`, joystick → `DriveCommand`). The integrator's race HUD
  should use touch-size targets per the platform's existing HUD conventions.
- No mock/placeholder economics: zero-fee races are honest zero fees
  (not "coming soon"), and null-provider races are honest paper-only.

## Files

- `index.ts` — public API + `adaptBillingToBurnProvider` + `BillingLike`
- `types.ts` — `VehicleLike`, `IRacer`, `DriveCommand/Context`, circuits,
  standings, results, events
- `tracks.ts` — `buildStreetCircuits` (5 circuits), `buildRallyRoutes`
  (3 desert routes + generated pace notes), grid slots, start heading
- `races.ts` — `RaceSession` state machine + bot kinematics (constructor
  throws on zero entrants)
- `ai.ts` — bot driver (pure pursuit, rubber-band, wrong-way recovery),
  player racer, remote placeholder, bot profiles
- `economy.ts` — `IBurnProvider`, `RacePool`, `collectEntryBurns`,
  `createNullBurnProvider`
- `pinkSlip.ts` — duel flow + `CarTitleRegistry` + midnight gating +
  `createDuelRaceSession` (accepted duel → live 2-racer session on the
  night-market circuit)
- `rally.ts` — `RallyRaid` (multi-stage, `settle()` → prize deltas),
  `RallyStageRun` (live timing), simulated rival times, `fmtRaceTime`

## Continuation log (2026-09-29)

Prior attempts were killed by infrastructure restarts with 9 files in place.
This pass read all files, verified the module against the live core API
(`core/Vehicle.ts`, `core/CityBuilder.ts`, `core/World.ts`, BILLING_CONTRACT.md)
and shipped the missing glue — no existing logic was rewritten:

1. **`createDuelRaceSession`** (pinkSlip.ts) — the missing bridge between the
   duel state machine and the race engine. Full duel flow is now:
   `proposeDuel → acceptDuel → beginDuelRace (midnight gate) →
   createDuelRaceSession → RaceSession → settleDuel`. Validates duel state
   and racer ids; optional ORBITX burn + CITY side-bet per duelist.
2. **`RallyRaid.settle()`** (rally.ts) — per-racer CITY deltas for raid
   prizes, same shape as `RacePool.payout()`, `null` until complete.
3. **`RaceSession` constructor guard** — throws on zero entrants instead of
   crashing later in `settle()`.
4. **MODULE.md updated** — core assumptions converted from assumptions to
   verified facts with file/line references (`CarPhysics` constants,
   `RoadNode`, `getPlayerState().dayT` 0=midnight, HALF=202).
5. **Smoke-tested** — `npx tsx` runtime test of all new paths (guard, duel
   flow, raid settle, pool payout deltas, `fmtRaceTime`) passed; `tsc
   --strict --noEmit` clean over the module.
