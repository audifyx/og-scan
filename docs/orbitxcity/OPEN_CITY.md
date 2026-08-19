# OrbitX City — Midtown open-district pass

Surgical upgrade on the existing City stack. **Kept** `CityProvider`, `WorldCanvas`, quality tiers, `enterBuilding` / `exitBuilding`, collision doorways, realtime presence, MainMenu / CharacterSelect gates, and the neon `#00ff9f` + black + gold language.

## Kept vs upgraded

| System | Status |
|--------|--------|
| CityProvider, gate flow, quality high/lite | Kept |
| enter/exit + `interiorLayout` + `furnitureSolids` | Kept (brighter rooms, more furniture) |
| Realtime + `RemoteAvatars` | Kept — remotes already use `HumanoidMesh` |
| Collision south-face doorways | Kept |
| Ground | Upgraded — asphalt, curbs, sidewalks, grass, wear (no mirror void) |
| Facades | Upgraded — family textures, marquees, raised WALK IN labels |
| Characters | Upgraded — human skin/clothes; select preview uses the same humanoid |
| Banners | New — data model + face mesh; admin UI later |

## Visual results

- **Ground / streets / grass:** Textured asphalt slab + dirt shoulder (not a black void). Lane dashes, crosswalks, raised cement sidewalks and curb lips. Grass patches with dirt rings + instanced tufts. Lite uses the same materials with fewer instances.
- **Facades + interiors:** Brick / limestone / glass / retail families, lighter night fade. Walk-ins keep open south doorways. Interiors have brighter floors/walls and extra fill lights. Collision unchanged.
- **Humanoids:** In-world + remotes + character select share `HumanoidMesh`. Mascot identity is cosmetics (Pepe cap/jacket, Chad chain, Anon lasers) on a human body — not frog/blob skin.
- **Traffic / life:** Cars stay on `getWorldStreets()` lanes and yield to the player. NPCs walk sidewalks in human clothing. Street lamps emit more so asphalt reads at night.
- **Banners:** `BuildingBanner` on `BuildingDefinition.banners` + `BANNER_REGISTRY`. Auto south-face ads on walk-in venues. Optional `imageUrl` (404 falls back to a neon title card).
- **Home / select / panels:** Title screen unchanged (already cinematic). Select preview is the in-world humanoid. HUD prompts raised and higher contrast. Panels stay centered.

## Banner data (admin hook)

```ts
interface BuildingBanner {
  id: string;
  buildingId: string;
  face: "south" | "north" | "east" | "west";
  u: number;          // 0–1 along the face
  v: number;          // 0–1 up the facade
  width: number;      // meters
  height: number;
  imageUrl?: string;  // /orbitxcity/ads/... or CDN
  title: string;
  subtitle?: string;
  accent: string;
  enabled?: boolean;
}
```

Resolution: authored `building.banners` + `BANNER_REGISTRY` (by `buildingId`) → else default walk-in ad. Generic OSM fill gets no auto ad.

Admin UI later: CRUD into `BANNER_REGISTRY` or persist the same shape (Supabase / Edge Config). Do not change `BuildingMesh` shell APIs.

## Asset paths

No new binaries required. Runtime-generated canvases cover asphalt, cement, grass, facades, and banner title cards.

Optional later: `web/public/orbitxcity/ads/<id>.jpg` referenced as `/orbitxcity/ads/<id>.jpg` on `imageUrl`.

Kenney furniture / citybits GLTFs still omit textures — interiors keep procedural stand-ins.

## Next phase

Solid now: Midtown ground, readable walk-in facades, humanoid avatars, banner data path, night-readable streets, door/realtime logic.

Next agents:

1. Larger world / more districts (do not rewrite collision).
2. Full ad editor UI writing `BuildingBanner` records.
3. Photo banners under `/orbitxcity/ads/` once assets exist.
4. Richer humanoid kits (GLB) that still honor `AvatarAppearance`.
5. Traffic intersections / parked-car density without extra draw-call spikes.
