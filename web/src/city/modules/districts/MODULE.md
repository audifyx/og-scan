# ORBITXCITY — Districts module

Enterable interiors + district features for the GTA-style open world.
Realistic Three.js (not blocky), mobile-friendly React overlays.

**Boundary:** core (`web/src/city/core`) owns the outdoor city generation,
player/vehicle control, camera, day/night, and collision. **This module owns
enterable interiors only** — facades, interior scenes, door triggers, and the
interior mini-UIs. It never touches the player controller, the camera, or the
world loop.

**Hard rules (locked):**
- No imports from sibling city modules. No imports from `@/tokenomics/*`
  (does not exist yet — would break the build). See `billing.ts` and
  `web/src/city/BILLING_CONTRACT.md`.
- The integrator owns the scene swap (outdoor ↔ interior), the teleport, the
  prompt rendering, and the per-frame loop. This module builds scenes and
  exposes data + pure functions.
- Every in-game purchase burns: premium actions go through `DistrictsBilling`
  (`spendPremium` → tokenomics burn path when live). Paper CITY is the
  gameplay currency (local ledger, never on-chain).

## File map

```
districts/
  index.ts            — public surface (doors, builders, UIs, data). Start here.
  types.ts            — shared types (DoorTrigger, TokenQuote, WantedProvider, …)
  billing.ts          — DistrictsBilling interface + NoopBilling fallback
  paper/PaperWallet.ts— paper CITY ledger + paper-trading positions (localStorage)
  doors/DoorSystem.ts — door trigger registry + proximity lookup
  exchange/          — walkable stock exchange: trading floor interior + paper-trading terminal UI
  hospital/          — respawn + wanted-clear billing UI
  construction/      — data-driven construction sites (city grows as features ship)
  museum/            — Museum of Rugs: dead-token hall of fame/shame (real data)
  library/           — OrbitX history archive + famous trades reader UI
  observatory/       — stargazing dome; star discovery → constellation NFTs (design-time)
  lighthouse/        — climbable lighthouse + panoramic screenshot helpers
  cityhall/          — pay fines, register firms, run for mayor + vote
  second-island/     — pluggable island zones + bridge seam spec
```

## Door triggers (outdoor mount points)

Register once at world boot: `registerDistrictDoors()`.

| Door id | Prompt | Outdoor pos `[x, y, z]` | Radius | Interior id | Interior spawn | Exit pos |
|---|---|---|---|---|---|---|
| `door:exchange` | Enter Stock Exchange | `[60, 0, -40]` | 4 | `stock-exchange` | `[0, 0, 14]` | `[60, 0, -36]` |
| `door:hospital` | Enter Hospital | `[-70, 0, 55]` | 4 | `hospital` | `[0, 0, 12]` | `[-70, 0, 51]` |
| `door:museum` | Enter Museum of Rugs | `[30, 0, 90]` | 4 | `museum-of-rugs` | `[0, 0, 16]` | `[30, 0, 86]` |
| `door:library` | Enter Library | `[-30, 0, -90]` | 4 | `library` | `[0, 0, 14]` | `[-30, 0, -86]` |
| `door:observatory` | Enter Observatory | `[-110, 0, -110]` | 5 | `observatory` | `[0, 0, 8]` | `[-110, 0, -105]` |
| `door:cityhall` | Enter City Hall | `[0, 0, -110]` | 5 | `city-hall` | `[0, 0, 14]` | `[0, 0, -105]` |
| `door:lighthouse` | Climb Lighthouse | `[150, 0, 130]` | 5 | `lighthouse` | — (deck teleport) | `[150, 0, 125]` |

Notes:
- Positions are world meters; core's city spawns around the origin. Facades are
  built at their door positions by `build*Exterior()`; `buildAllExteriors()`
  adds all of them (+ lighthouse, bridge, islands, construction sites) to one
  `THREE.Group` you drop into the world scene.
- The lighthouse has **no interior scene** — climbing teleports the player to
  `LIGHTHOUSE_DECK = [150, 26, 130]`, heading `LIGHTHOUSE_DECK_HEADING = π`
  (facing the city). Exiting returns them to `exitPosition`.

## Teleport hooks (integrator responsibilities)

The canonical flow:

1. Each frame (or on move), call `nearestDoor([playerX, 0, playerZ])`. On a hit,
   render `doorPromptLabel(hit.door, isMobile)` ("Press E · …" / "Tap · …").
2. On confirm: look up the interior builder by `door.interiorId` and mount it:

   | Interior id | Builder | Terminal / interact points |
   |---|---|---|
   | `stock-exchange` | `buildExchangeInterior()` → `{ group, updateQuotes, terminalPositions }` | 4 kiosks at `terminalPositions`; proximity opens `<ExchangeTerminal quotes={…}>` |
   | `hospital` | `buildHospitalInterior()` → `{ group, bedSpawns, deskPosition }` | desk at `deskPosition` opens `<HospitalBilling wanted billing>` |
   | `museum-of-rugs` | `buildMuseumInterior()` → `{ group, updateExhibits, plaquePositions }` | proximity to `plaquePositions` shows `epitaphCard(exhibit)` |
   | `library` | `buildLibraryInterior()` → `{ group, terminalPositions }` | terminals open `<LibraryReader>` |
   | `observatory` | `buildObservatoryInterior()` → `{ group, domeRadius, aimTelescope }` | telescope aims via `aimTelescope(yaw, pitch)`; feed hits to `trackGaze` |
   | `city-hall` | `buildCityHallInterior()` → `{ group, clerkPosition, ballotPosition }` | clerk opens `<CityHallUI billing owner>` (fines/firms tabs); ballot opens the mayor tab |
   | `lighthouse` | deck teleport (no builder) | `PANORAMA_SPOTS` for screenshot cams; `capturePanorama(canvas)` / `downloadPanorama(canvas)` |

3. Teleport the player to `door.interiorSpawn`, swap the visible scene
   (outdoor group hidden / interior group shown — interior scenes are
   self-contained rooms built around the origin), and park/disable the car,
   traffic, and wanted ticking while inside.
4. On exit, restore the outdoor scene and teleport to `door.exitPosition`.

Suggested registry (integrator-owned, not in this module):

```ts
const INTERIORS: Record<string, () => { group: THREE.Group; dispose(): void }> = {
  "stock-exchange": buildExchangeInterior,
  "hospital": buildHospitalInterior,
  "museum-of-rugs": buildMuseumInterior,
  "library": buildLibraryInterior,
  "observatory": buildObservatoryInterior,
  "city-hall": buildCityHallInterior,
  // "lighthouse": deck teleport instead of a scene
};
```

Call each builder's `dispose()` when unmounting to free geometries/textures.
Interiors create their own `PointLight`s — keep at most one interior mounted.

## Live-data feed points (real data only)

- **Exchange ticker + monitors:** call `interior.updateQuotes(quotes)` on each
  tick, where `quotes: TokenQuote[]` comes from `web/src/hooks/useLivePrices`.
  Paper trades execute against these quotes via `executePaperTrade` — settled
  in paper CITY only, never real funds.
- **Museum curation:** `curateExhibits(quotes, peakPrices)` (pure) — the
  integrator keeps a rolling `symbol → peak` map and calls
  `interior.updateExhibits(exhibits)`. `PERMANENT_EXHIBITS` (BitConnect, SQUID,
  LUNA) are always shown. Custom exhibits persist to localStorage.
- **Observatory discovery:** the integrator collects gazed star indices from
  `aimTelescope(yaw, pitch)` and calls `trackGaze(indices)`; it returns newly
  discovered `Constellation`s (persisted to localStorage).
- **Wanted level:** the integrator provides a `WantedProvider`
  (`getStars()` / `clear()`); hospital billing consumes it.
- **CityHall UI:** pass the player's display name as `owner` (firm owner /
  candidate name) and a `DistrictsBilling` instance as `billing`.

## Billing (defensive — code as if tokenomics isn't there)

`billing.ts` is the seam. Every paid feature codes against `DistrictsBilling`:

- `NoopBilling` (`state: "coming-soon"`) is the default — premium UI renders
  "soon / auth required" and the world runs on paper CITY. Integrator swaps in
  `billingFromTokenomicsHook(useOrbitxBilling())` once the tokenomics team's
  `web/src/tokenomics/useOrbitxBilling` lands. **No district feature code
  changes when that happens.**
- Premium price tags use `premiumPriceLabel(amount, billing)` — never
  hardcode "ORBITX".
- Premium entry points: hospital expedited wipe (`EXPEDITED_WIPE_COST_ORBITX
  = 5` ORBITX, reason `city-hospital:expedited-wipe`), city-hall premium firm
  (`FIRM_COST_PREMIUM_ORBITX = 25` ORBITX, reason `city-hall:firm-premium`).
  All call `spendPremium` only when `billing.state === "live"`.
- Paper-CITY prices: wanted clear 250/star, treatment bill 100, firm 500,
  candidacy 1000, vote 10 — all via `paperWallet` (`STARTING_CITY = 10_000`).

## Bridge / world-seam interface (second island)

Core owns the ocean, sky, weather, and day/night — this module owns the island
ground, dressing, and the bridge seam spec.

- `BRIDGE: BridgeSeamSpec` — id `bridge:harbor`, name "Harbor Bridge",
  mainland-side deck start `from: [-20, 0, 175]`, island-side end
  `to: [-20, 0, 290]`, `deckY: 6` (must stay > core's water plane `y = 0`),
  `lanes: 2` (driving width = lanes × 3.5 m + 4 m shoulders).
- `buildBridge(seam = BRIDGE)` builds a suspension bridge whose local +z runs
  from `from` → `to` (yaw = `atan2(dir.x, dir.z)`), origin at `from`.
- `bridgeCollider(seam = BRIDGE)` returns the integrator's deck collider:
  `{ minX, maxX, minZ, maxZ, topY }` (`topY = deckY + 0.6`). The integrator
  adds this box to its collision set and gates car/ped entry onto the deck.
- `ISLAND_ZONES` — default zone `island:neon-docks` (biome `neon-docks`,
  center `[-20, 0, 440]`, radius 150 m). Zone groups are positioned at absolute
  world coords; drop `buildAllIslands()` groups into the world scene.
- Pluggability: `registerIslandBuilder(biome, builder)` overrides per biome
  (`tropical | volcanic | neon-docks | arctic`); future teams add zones by
  pushing to `ISLAND_ZONES` + registering a builder — no edits needed here.
- Beacon animation: `updateLighthouseBeacon(lighthouseGroup, elapsedSeconds)`
  every frame.

## Assumptions & known prototype seams

- **Wanted level lives with the integrator** (core or a future module). This
  module only consumes `WantedProvider`. Fine threshold → wanted stars is an
  integrator policy (suggested: unpaid fines > 2000 CITY ⇒ +1 star).
- **Mayor elections are a local prototype**: candidates/votes persist to
  localStorage (`orbitxcity:mayor:v1`), seeded with two NPC candidates. A
  shared backend election is explicitly future work.
- **Constellation NFTs are design-time only**: `Constellation.nft` carries
  `{ collection: "orbitx-constellations", trait }` as the mint mapping; the
  mint call itself is not implemented (no wallet/custody in this module).
- **Museum custom exhibits are local** (localStorage `orbitxcity:rug-exhibits:v1`);
  a shared hall-of-shame backend would replace `loadCustomExhibits`.
- **Paper CITY is per-device** (localStorage `orbitxcity:paper-wallet:v1`).
- **Panorama capture** needs `preserveDrawingBuffer: true` on the renderer,
  or capture synchronously right after a render in the same frame.
- **Construction sites are data-driven**: `setConstructionProgress(id, p)`
  re-renders detail (scaffold density, crane at ≥ 0.3, status text). The
  platform team bumps progress when features ship; `buildAllExteriors()`
  renders current state. `onComplete` lets a future landmark team swap a
  finished site for a real building.
- Facade positions assume flat ground at y=0 at the door coordinates — the
  integrator should verify against core's `CityBuilder` block layout so
  facades don't intersect roads/buildings.
- `document`/`canvas`/`localStorage` are used throughout (browser-only).
  Guard before SSR.

## Integration checklist

- [ ] `registerDistrictDoors()` at world boot
- [ ] `buildAllExteriors().group` added to the outdoor scene
- [ ] Per-frame `nearestDoor` + prompt rendering (`doorPromptLabel`)
- [ ] Interior registry + scene swap + teleport on confirm (table above)
- [ ] Interior UIs wired: ExchangeTerminal (quotes), HospitalBilling
      (wanted, billing), LibraryReader, CityHallUI (billing, owner)
- [ ] `useLivePrices` → `updateQuotes` / `curateExhibits` feeds
- [ ] `WantedProvider` adapter from the wanted system
- [ ] `DistrictsBilling`: start with `new NoopBilling()`; swap to
      `billingFromTokenomicsHook(...)` when tokenomics lands
- [ ] Respawn hook → `HOSPITAL_RESPAWN` bed spawn + `chargeTreatmentBill()`
- [ ] `bridgeCollider(BRIDGE)` added to collision; deck driving gated
- [ ] `updateLighthouseBeacon(group, t)` in the frame loop
- [ ] Renderer with `preserveDrawingBuffer: true` if panorama capture is wanted
