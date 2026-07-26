# OrbitX City World Building

World configs live under `web/src/lib/orbitxcity/`.

## API

```ts
import { getWorldBlock } from "@/lib/orbitxcity";

const block = getWorldBlock(selectedCityId);
```

`getWorldBlock(cityId)` returns a `WorldBlockConfig` with spawn, bounds, districts, buildings, billboards, and interaction zones. Frontend should pass that block into the world scene; `CityEnvironment` and owned scenery components accept an optional `block` prop and default to NYC for backward compatibility.

Boston is still locked and currently falls back to the NYC block.

## Cities

- **NYC** (`demoBlock.ts`) - dense downtown financial hub with trading, launch, meme market, NFT, casino, nightlife, and park districts.
- **Miami** (`worlds/miamiBlock.ts`) - coastal, open layout with boardwalk streets, pastel/cyan accents, low-rise cabanas, social plazas, community zones, and a sunset launch pier.
- **LA** (`worlds/laBlock.ts`) - creator strip with a central stage/plaza, magenta/pink accents, creator studios, media billboards, NFT gallery, games backlot, and rooftop social row.

## Teleport points

Helpers in `web/src/lib/orbitxcity/worlds/index.ts` expose city-specific teleport metadata:

```ts
import { getTeleportPoints } from "@/lib/orbitxcity";

const points = getTeleportPoints(selectedCityId);
```

Miami points: Ocean Arrival Plaza, Neon Boardwalk, Community Cabana, Social Sands, Coastal Market, Sunset Launch Pier.

LA points: Creator Stage Plaza, Creator Strip West, Creator Strip East, Melrose NFT Gallery, Arcade Backlot, Rooftop Social.
