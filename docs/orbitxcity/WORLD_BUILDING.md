# OrbitX City World Building

World configs live under `web/src/lib/orbitxcity/`.

## API

```ts
import { getWorldBlock, getWorldStreets, getTeleportPoints } from "@/lib/orbitxcity";

const block = getWorldBlock(selectedCityId);
const streets = getWorldStreets(selectedCityId);
```

`getWorldBlock(cityId)` returns a `WorldBlockConfig` with spawn, bounds, districts, buildings, billboards, and interaction zones.

## Cities

- **NYC** (`worlds/nycOsmBlock.ts`) — primary Midtown OSM map (extruded footprints). Showcase district.
- **Miami** (`worlds/miamiBlock.ts`) — coastal authored block.
- **LA** (`worlds/laBlock.ts`) — creator strip authored block.
- **Boston** (`worlds/bostonBlock.ts`) — innovation core authored block (unlocked).

`demoBlock.ts` remains as fallback / default only.

## Walk-in buildings

Designed venues (`hq`, `market`, `trading_floor`, `social_hub`, `launch_arena`, `ad_tower`, `shop`, or any building with `interaction`) have:

- South-face collision doorway gaps (`collision.ts`)
- Automatic enter/exit when walking through the threshold
- **E = venue tools only** (never teleports)

Generic OSM fill buildings stay solid.

## Streets & traffic

`getWorldStreets(cityId)` drives:

- Asphalt / sidewalks in `Ground.tsx`
- Cars in `Traffic.tsx` (lane-bound, no hover loops)
- NPC sidewalk waypoints in `NPCs.tsx`

## Facades

`BuildingMesh` assigns Manhattan-inspired families (brick / limestone / glass / retail) from massing + venue role, with awnings + cornices on high quality.

## Teleport points

```ts
const points = getTeleportPoints(selectedCityId);
```
