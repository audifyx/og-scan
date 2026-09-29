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
  billing.ts          — DistrictsBilling interface + NoopBilling fallback +
                        billingFromBurnPurchase (cityPorts burn adapter wiring)
  paper/PaperWallet.ts— paper CITY ledger + paper-trading positions (localStorage)
  doors/DoorSystem.ts — door trigger registry + proximity lookup
  exchange/          — walkable stock exchange: trading floor interior + paper-trading terminal UI
  hospital/          — respawn + wanted-clear billing UI
  bank/              — ORBITX Bank: tellers, vault, ATMs, safe-deposit boxes (CITY) + vault membership (ORBITX burn)
  dealership/        — OrbitX Motors: glass showroom, demo cars, paper-CITY sales + ORBITX-burn hypercar trim
  shops/             — OrbitX Market: stocked aisles, checkout, paper-CITY goods + ORBITX-burn cosmetics
  construction/      — data-driven construction sites (city grows as features ship)
  museum/            — Museum of Rugs: dead-token hall of fame/shame (real data)
  library/           — OrbitX history archive + famous trades reader UI
  observatory/       — stargazing dome; star discovery → constellation NFTs (design-time)
  lighthouse/        — climbable lighthouse + panoramic screenshot helpers
  cityhall/          — pay fines, register firms, run for mayor + vote
  second-island/     — pluggable island zones + bridge seam spec + drivable ramp colliders
```

## Door triggers (outdoor mount points)

Register once at world boot: `registerDistrictDoors()`.

Trigger positions sit a few meters IN FRONT of each facade entrance (the
facade itself occupies the reserved lot — see `FACADE_PLOTS`); exit positions
drop the player just outside the facade collider.

| Door id | Prompt | Outdoor pos `[x, y, z]` | Radius | Interior id | Interior spawn | Exit pos |
|---|---|---|---|---|---|---|
| `door:exchange` | Enter Stock Exchange | `[78, 0, -60]` | 4 | `stock-exchange` | `[0, 0, 14]` | `[78, 0, -61]` |
| `door:hospital` | Enter Hospital | `[-78, 0, 95]` | 4 | `hospital` | `[0, 0, 12]` | `[-78, 0, 94]` |
| `door:museum` | Enter Museum of Rugs | `[78, 0, 173]` | 4 | `museum-of-rugs` | `[0, 0, 16]` | `[78, 0, 172]` |
| `door:library` | Enter Library | `[-78, 0, -140]` | 4 | `library` | `[0, 0, 14]` | `[-78, 0, -141]` |
| `door:observatory` | Enter Observatory | `[-95, 0, -63]` | 5 | `observatory` | `[0, 0, 8]` | `[-95, 0, -64]` |
| `door:cityhall` | Enter City Hall | `[0, 0, -60]` | 5 | `city-hall` | `[0, 0, 14]` | `[0, 0, -61]` |
| `door:bank` | Enter ORBITX Bank | `[0, 0, 27]` | 4 | `bank` | `[0, 0, 12]` | `[0, 0, 26]` |
| `door:dealership` | Enter Dealership | `[-158, 0, 88]` | 5 | `dealership` | `[0, 0, 14]` | `[-158, 0, 87]` |
| `door:shops` | Enter OrbitX Market | `[156, 0, 15]` | 4 | `shops` | `[0, 0, 10]` | `[156, 0, 14]` |
| `door:lighthouse` | Climb Lighthouse | `[250, 0, 415]` | 5 | `lighthouse` | — (deck teleport) | `[250, 0, 410]` |

Notes:
- Facade footprint centers live next to each door as `<X>_FACADE_CENTER`;
  `FACADE_PLOTS` aggregates them (center + half extents) and core's
  `CityBuilder` reserves those lots so generated buildings never overlap a
  facade or a door trigger. `facadeColliders()` returns the matching outdoor
  AABBs for the integrator's collision set.
- `buildAllExteriors()` adds all facades (+ lighthouse, bridge, islands,
  construction sites) to one `THREE.Group` you drop into the world scene.
  **The integrator must actually mount it** (`scene.add(buildAllExteriors().group)`)
  plus `facadeColliders()` — doors prompt without visible buildings otherwise.
- The lighthouse has **no interior scene** — climbing teleports the player to
  `LIGHTHOUSE_DECK = [250, 26, 415]` on the south beach, heading
  `LIGHTHOUSE_DECK_HEADING = π` (facing the city). Exiting returns them to
  `exitPosition`.

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
   | `bank` | `buildBankInterior()` → `{ group, updateQuotes, atmPositions }` | ATMs at `atmPositions` open `<BankUI billing quotes>` (ticker fed from `useLivePrices`) |
   | `dealership` | `buildDealershipInterior()` → `{ group, deskPosition }` | desk opens `<DealershipUI billing onDeliver>` (showroom catalog; delivery via `onDeliver`) |
   | `shops` | `buildShopsInterior()` → `{ group, checkoutPosition }` | checkout opens `<ShopsUI billing>` |
   | `lighthouse` | deck teleport (no builder) | `PANORAMA_SPOTS` for screenshot cams; `capturePanorama(canvas)` / `downloadPanorama(canvas)` |

3. Teleport the player to `door.interiorSpawn`, swap the visible scene
   (outdoor group hidden / interior group shown — interior scenes are
   self-contained rooms built around the origin), and park/disable the car,
   traffic, and wanted ticking while inside.
4. On exit, restore the outdoor scene and teleport to `door.exitPosition`.

Ready-made registry (no hand-rolled map needed):

```ts
import { buildInteriorForDoor } from "@/city/modules/districts";
// buildInteriorForDoor("door:bank") → { group, dispose } | null
// ("door:lighthouse" → null: deck teleport instead of a scene)
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
  a live implementation without touching district feature code.
- **Live wiring (canonical):** `billingFromBurnPurchase({ burn, isReady,
  getBalance })` — the integrator passes the cityPorts `burnPurchase` burn
  adapter (structural type `BurnPurchaseLike`, deliberately not imported to
  avoid an integration→districts→integration cycle). Every premium district
  purchase then flows through the canonical burn: namespaced `city:districts:*`
  reasons, the shared burn ledger, dry-run support, backend-signed ORBITX.
  ```ts
  const districtsBilling = billingFromBurnPurchase({
    burn: (a) => burnPurchase(billing, { ...a, module: "districts" }),
    isReady: () => billing?.ready ?? false,
    getBalance: () => billing?.balance ?? null,
  });
  ```
- Legacy path: `billingFromTokenomicsHook(useOrbitxBilling())` still works if
  the tokenomics hook shape is preferred.
- Premium price tags use `premiumPriceLabel(amount, billing)` — never
  hardcode "ORBITX".
- Premium entry points: hospital expedited wipe (`EXPEDITED_WIPE_COST_ORBITX
  = 5` ORBITX, reason `city-hospital:expedited-wipe`), city-hall premium firm
  (`FIRM_COST_PREMIUM_ORBITX = 25` ORBITX, reason `city-hall:firm-premium`),
  bank vault membership (`VAULT_COST_ORBITX = 10`, reason
  `city:districts:bank-vault`), dealership hypercar trim (25 ORBITX, reason
  `city:districts:dealership:aurora-hypercar`), shop cosmetics (5/15 ORBITX,
  reasons `city:districts:shop:<id>`). All call `spendPremium` only when
  `billing.state === "live"`; premium UI gates on the same flag and renders
  an honest "wallet auth required" state otherwise.
- Paper-CITY prices: wanted clear 250/star, treatment bill 100, firm 500,
  candidacy 1000, vote 10, safe-deposit box 500, shop goods 50–150, showroom
  cars 2500–9800 — all via `paperWallet` (`STARTING_CITY = 10_000`).

## Bridge / world-seam interface (second island)

Core owns the ocean, sky, weather, and day/night — this module owns the island
ground, dressing, and the bridge seam spec.

- `BRIDGE: BridgeSeamSpec` — id `bridge:harbor`, name "Harbor Bridge",
  mainland-side deck start `from: [-20, 0, 440]` (beach waterline),
  island-side end `to: [-20, 0, 590]`, `deckY: 6` (must stay > core's water
  plane `y = -0.6`), `lanes: 2` (driving width = lanes × 3.5 m + 4 m shoulders).
- Approach ramps are built into `buildBridge`: mainland ramp climbs
  `BRIDGE_RAMP_MAIN` (z 404 → 440, y 0 → 6), island ramp descends
  `BRIDGE_RAMP_ISLAND` (z 590 → 606, y 6 → 4 = `ISLAND_SURFACE_Y`).
- `bridgeCollider(seam = BRIDGE)` returns the deck box (`topY = deckY + 0.6`).
  **`bridgeDriveBoxes(seam = BRIDGE)` is the one to use for driving** — stepped
  boxes covering deck + both ramps. Add ALL of them to the collision set and
  use them for the car/ped ground-height check on the bridge.
- `ISLAND_ZONES` — default zone `island:neon-docks` (biome `neon-docks`,
  center `[-20, 0, 740]`, radius 150 m). The island is fully built out: ring
  road with lamps, container yard, 3 piers + moored ferry, dock warehouse,
  neon arcade, 24h diner, harbor ops offices, fuel tank farm, beach palms.
  Zone groups are positioned at absolute world coords; drop
  `buildAllIslands()` groups into the world scene.
- `islandColliders(zone)` returns absolute-world AABBs for the island's fixed
  structures — add to the collision set so the island is drivable on foot
  and by car.
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
- [ ] `buildAllExteriors().group` added to the outdoor scene (+ `facadeColliders()` in the collision set)
- [ ] Per-frame `nearestDoor` + prompt rendering (`doorPromptLabel`)
- [ ] Interior registry + scene swap + teleport on confirm — or just `buildInteriorForDoor(door.id)`
- [ ] Interior UIs wired: ExchangeTerminal (quotes), HospitalBilling
      (wanted, billing), LibraryReader, CityHallUI (billing, owner),
      BankUI (billing, quotes), DealershipUI (billing, onDeliver),
      ShopsUI (billing)
- [ ] `useLivePrices` → `updateQuotes` / `curateExhibits` feeds; bank ticker too
- [ ] `WantedProvider` adapter from the wanted system
- [ ] `DistrictsBilling`: start with `new NoopBilling()`; go live with
      `billingFromBurnPurchase(...)` wired to the cityPorts `burnPurchase`
- [ ] CityData `applyMarketData(quotes)` called from the live-price feed
      (market-cap tower heights + price-action windows)
- [ ] Respawn hook → `HOSPITAL_RESPAWN` bed spawn + `chargeTreatmentBill()`
- [ ] `bridgeDriveBoxes(BRIDGE)` added to collision; deck driving gated;
      `islandColliders(ISLAND_ZONES[0])` added too
- [ ] `updateLighthouseBeacon(group, t)` in the frame loop
- [ ] Renderer with `preserveDrawingBuffer: true` if panorama capture is wanted
