# OrbitX City — World Builder (Worker 1) integration notes

## What changed

**Owner's law enforced — no more blocky world.** `CityEnvironment.tsx` no longer
imports or renders `BlockyBuildingMesh` / `Baseplate` (from `BlockBuilding.tsx`).
The `VITE_OXC_BLOCKY` branch is deleted; the scene always renders the realistic
pipeline: `Ground` → `CityFill` → `OrbitxBillboardRing` → `BuildingMesh`.
The blocky component files still exist on disk but nothing in the city renders them.

**`BuildingMesh.tsx` — full rewrite (realistic GTA-style massing):**
- Tiered massing kept, but facades now carry **real instanced window geometry**:
  two `InstancedMesh`es per building — dark reflective panes + warm lit panes
  (random ~50% lit per building). Lit-pane emissive ramps with the day/night cycle.
- Procedural wall-detail canvas texture (brick courses / limestone seams /
  curtain-wall mullions, ground grime) — no painted windows anymore.
- Rooftop detail: parapet walls, AC units with fan discs, wooden water tanks on
  legs, elevator penthouses, antenna masts with red beacons that blink at night.
- Street level: walk-in venues get retail glass + mullion frames split around the
  open doorway, bulkheads, awning, marquee + blade signs (all night-lit).
  Non-walk-in buildings get an emissive signage band.
- OSM footprint buildings still extrude their real outline, now with a painted
  window-grid texture whose lit cells live in the emissive map (1 draw call).
- Collision contract preserved: south face + `buildingDoorWidth()` doorway slot
  still match `collision.ts` (`buildingDoorway` / `inDoorwaySlot`).

**`Ground.tsx`:** lane dashes and crosswalk bars across all streets are now two
shared `InstancedMesh`es (~2 draw calls instead of ~300 meshes). Sidewalks raised
with curbs kept; textures unchanged.

**`StreetProps.tsx`:** lamp-head emissive and the (capped) real point lights
(14 high / 6 lite) now fade in/out with the day/night cycle via a single
material/intensity mutation per frame.

**`Skyline.tsx`:** distant towers share one window-grid texture; emissive
brightens at night through one material write. Instanced antenna tips added on
tall towers.

**`SkyCycle.tsx`:** now the **sole writer** of the shared day/night snapshot
(see below). Also slightly bluer daytime sky + orange twilight sun tint.

**`Drones.tsx`:** nav-light strobe strength follows night level.

**`collision.ts` (API additive only — nothing removed/renamed):**
- New: `getBuildingAABBs(block)` → cached `BuildingAABB[]` (id, minX/maxX/minZ/maxZ, height)
- New: `getCityBounds(block)` → block bounds
- Internal: AABB list + camera solids now cached per block in `WeakMap`s, so
  `collidesAt` / `pointInBuilding` no longer allocate per call on hot paths.
  Doorway-slot behavior unchanged.

**`Park.tsx`, `UrbanNature.tsx`, `PropScatter.tsx`:** unchanged (already
realistic + instanced).

## dayNight API (`src/lib/orbitxcity/dayNight.ts`)

```ts
import { getDayNight, subscribeDayNight, DAY_SECONDS } from "@/lib/orbitxcity/dayNight";

// In a useFrame loop (zero React re-renders):
const dn = getDayNight();          // same mutable object every call — read fields, don't store in state
material.emissiveIntensity = 0.1 + dn.windowLevel * 1.5;  // lit windows
light.intensity = base * dn.lampLevel;                    // streetlights

// Coarse UI subscription (fires only on day/dusk/night transitions):
const unsub = subscribeDayNight((band) => /* "day" | "dusk" | "night" */);
```

Fields: `phase` (0..1 of `DAY_SECONDS` = 360s), `daylight`, `twilight`,
`night` (0..1 each), `sunAngle`, `lampLevel`, `windowLevel`.
Helpers: `isNight()`, `getDayNightBand()`, `dayNightBandOf(state)`.
**Writer rule:** only `SkyCycle` calls `updateDayNight`.

## New exports other workers may need

- `getBuildingAABBs`, `getCityBounds`, `BuildingAABB` from `@/lib/orbitxcity/collision`
- `getDayNight`, `subscribeDayNight`, `DAY_SECONDS`, `DayNightState`, `DayNightBand` from `@/lib/orbitxcity/dayNight`
- `facadeFamily`, `FacadeFamily` still exported from `BuildingMesh.tsx`

## Cut / not done + why

- **`CityFill.tsx` still renders `BlockBuilding` (blocky kit)** for the outer-city
  fill — that file belongs to another worker; I did not touch it. Its owner
  should swap to `BuildingMesh`-style realistic fill or gate it behind distance.
- **`CharacterMesh.tsx` still defaults to `BlockCharacter`** via its own
  `VITE_OXC_BLOCKY` flag (defaults to blocky). Not my file — but note the
  realistic `HumanoidMesh` fallback already exists; the owner just needs to flip
  the default now that the world is realistic.
- `BlockyBuildingMesh.tsx`, `BlockBuilding.tsx`, `BlockCharacter.tsx` left on
  disk (law says files may stay; nothing renders them from my scene graph).
- No external assets added — everything procedural (canvas textures, instancing).
- `MeshReflectorMaterial` kept behind the `high` quality flag (expensive); lite
  falls back to standard materials. Quality comes from `useCity().quality`.

---

# Vehicle System — Integration Guide (Worker 2)

GTA-style drivable cars: realistic (non-blocky) humanoid-scale cars, enter/exit
on foot, arcade driving physics, third-person follow camera.

## Mounting (coordinator)

Render once inside `<Canvas>`, under `CityProvider`:

```tsx
import { VehicleSystem } from "@/components/orbitxcity/world/VehicleSystem";

<VehicleSystem block={block} onMove={onMove} />
```

- `block` is optional — falls back to `getWorldBlock(selectedCityId)` from `useCity()`.
- `onMove` is optional — same signature as `PlayerAvatar`'s; while driving the
  car reports as the player position (~8Hz) so prompts, NPCs, minimap and
  remote avatars follow the driver.

`VehicleSystem` internally renders: one `DrivableCar` per fleet car,
`VehicleController` (physics + camera + enter/exit), `CarPromptMarker`
("E · DRIVE" prompt), `DrivenHeadlight` (night spotlight, high quality only),
and `TouchDriveButton` (DOM overlay for touch devices).

## vehicleStore — the contract (`src/lib/orbitxcity/vehicleStore.ts`)

```ts
import { useVehicleStore, getCarBody, getCarSpec } from "@/lib/orbitxcity/vehicleStore";
```

Reactive (zustand) — subscribe in React:
- `mode: "foot" | "driving"`
- `activeCarId: string | null` — car being entered / driven
- `enteringCarId: string | null` — set during the 0.45s enter animation beat
- `specs: Record<id, CarSpec>` — set once at spawn (topSpeed, accel, brake,
  turn, grip, dims, colors)

Non-reactive (mutable, read in `useFrame` — never triggers re-renders):
- `cars: Record<id, CarBody>` — `{ pos: {x, z}, yaw, speed, steer }`

Actions:
- `registerCars(specs, initialBodies)` — idempotent per id
- `updateCar(id, patch)` — physics writes through this
- `enterCar(id)` → sets `enteringCarId`; `PlayerAvatar` plays the walk-to-door
  beat, then calls `completeEnter()` → `mode: "driving"` (+ `setDrivingMode(true)`)
- `cancelEnter()`, `exitCar()` (+ `setDrivingMode(false)`), `resetVehicles()`
- `getCarBody(id)`, `getCarSpec(id)` — non-reactive read helpers

Nothing is persisted — positions are session state.

## Camera handoff

- `PlayerAvatar` checks `useVehicleStore.getState().mode` at the top of its
  `useFrame`: when `"driving"` it returns early (no movement, no camera, no
  reporting) and renders `null` (a seated driver mesh inside the car represents
  the player instead).
- `VehicleController` owns the camera only while `mode === "driving"`:
  smooth third-person follow behind the car, wheel-zoomable (6–15m, shares
  `consumeZoom()`), with the same building-occlusion march `PlayerAvatar` uses.
- On exit, `VehicleController` calls the provider's `teleport(x, z)` and
  `PlayerAvatar` snaps to the driver-side door via its existing
  `teleportTarget` effect.

## Controls

| Input | On foot | Driving |
|---|---|---|
| `E` | Enter nearest car (≤3.4m), only when no venue prompt/panel is active — venues keep priority | Exit car (placed at driver-side door) |
| `W/S` or `↑/↓` | walk | throttle / brake-reverse |
| `A/D` or `←/→` | strafe | steering (speed-scaled, flips in reverse) |
| `Space` | jump | handbrake |
| Touch joystick | walk | throttle + steering |
| Touch pedals/steering (`virtualInput.throttle/brake/steer`, via `setDrive`) | — | merged with keyboard/joystick |
| Touch DRIVE/EXIT button (bottom-right overlay) | enter | exit |
| `virtualInput.interactQueued` / `queueInteract()` | enter | exit |

## Fleet (all parked curbside near spawn, from block street data)

| Car | Accel | Top speed | Handling |
|---|---|---|---|
| Comet S (sedan) | 11 m/s² | 26 m/s (~94 km/h) | balanced |
| Velocity GT (sports) | 17 m/s² | 34 m/s (~122 km/h) | sharp |
| Atlas X (SUV) | 8.5 m/s² | 21 m/s | heavy, stable |
| Metro Van | 7.5 m/s² | 19 m/s | heavy |

## Files owned by Worker 2

- `src/lib/orbitxcity/vehicleStore.ts` — zustand contract (above)
- `src/components/orbitxcity/world/VehicleSystem.tsx` — `VehicleSystem`,
  `VehicleController`, `CarPromptMarker`, `DrivenHeadlight`,
  `TouchDriveButton`, `findNearestCar()`, `vehicleBlockRef`, `VEHICLE_FLEET`
- `src/components/orbitxcity/world/DrivableCar.tsx` — realistic car mesh:
  spinning wheels, steering front wheels, body roll/pitch lean, seated driver,
  headlight/taillight emissive at night (+ beam cones)
- `src/components/orbitxcity/world/CityCarMesh.tsx` — REBUILT to realistic
  proportions (same `{ glow, body }` props + `CITY_CAR_GLOWS`/`CITY_CAR_BODIES`
  exports — `Traffic.tsx` and `PropScatter.tsx` still import it)
- `src/components/orbitxcity/world/PlayerAvatar.tsx` — EXTENDED: yields
  camera/movement while driving, enter-car animation beat, hidden while driving
- `src/lib/orbitxcity/input.ts` — EXTENDED: `interactQueued` + `queueInteract()`
  (coexists with the driving fields `driving/steer/throttle/brake`,
  `setDrivingMode`, `setDrive`, `subscribeDriveMode` added by the touch worker —
  the store calls `setDrivingMode` on enter/exit/reset)

## Cut / known limitations (Worker 2)

- **Car-vs-car collision:** cars don't collide with each other or with lane
  traffic (`Traffic.tsx`) — only buildings + world bounds via `collidesAt`.
  Parked fleet is static so this only matters while driving through traffic.
- **Venue E while driving:** if you drive through an active interaction zone and
  press `E`, the city's venue `interact()` (CityHUD, untouched) may ALSO fire
  alongside the car exit. Exiting still works; you may need to close a venue
  panel afterwards.
- **Remote players** see your car position (reported via `onMove`/`setPlayerPos`)
  but other clients render you as a normal avatar, not seated in a car — no
  network vehicle sync yet.
- **Headlight night state** (`isNight()`) is read at render, not subscribed —
  if day flips to night mid-session, parked-car emissives update on next
  remount; the driven spotlight mounts on the next drive.
- **Car interiors:** entering a building while driving is not handled — exit the
  car first (doorway auto-entry only runs on foot).
- Enter animation is a 0.45s walk-to-door + shrink beat (cheap but not janky);
  exit is instant placement at the driver-side door.
