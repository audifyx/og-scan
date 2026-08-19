# OrbitX City — master visual pass (night cyber Midtown)

Surgical upgrade on the existing City stack. **Kept** `CityProvider`, `WorldCanvas`, quality tiers, `enterBuilding` / `exitBuilding`, collision doorways, realtime presence, MainMenu / CharacterSelect gates, Jupiter burn shop, and the neon `#00ff9f` + black + gold `#c5a26f` language.

This pass restores **night cyber-financial district** mood (overrides the daytime lock) while keeping streets readable.

## Kept vs upgraded

| System | Status |
|--------|--------|
| CityProvider, gate flow, quality high/lite | Kept |
| enter/exit + `interiorLayout` + furniture collision | Kept |
| Realtime + `RemoteAvatars` presence Map | Kept — remotes use `HumanoidMesh` |
| Collision south-face doorways | Kept |
| Burn shop (`cityShop` / Jupiter → ORBITX burn) | Kept |
| Title / home | Upgraded — brighter skyline, centered high-contrast 3D buttons |
| Characters | Upgraded — adult humanoid with face, hair, beard, clothes |
| Ground / atmosphere | Upgraded — night sky + lit asphalt / sidewalk / grass |
| Facades + interiors | Upgraded — punched window grids, facade signage, extra room lights |
| HUD | Upgraded — floating roof TOP labels removed; prompts raised; Unstuck in More |
| Banners | Kept + documented — data model + facade plane + branded fallback |

## Results

- **Title:** Lit window maps, stronger key/fill lights, weaker vignette. PLAY / MULTIPLAYER / SETTINGS / QUICK PLAY optically centered with metal/glass slabs.
- **Characters:** Same `HumanoidMesh` in select, world, remotes, NPCs, interiors. Classes are skins (Pepe cap, Wojak hoodie + stubble, Chad beard, Doge beanie, Anon mask/lasers). Adult scale (no toy squash).
- **Ground:** Asphalt + lane glow, curbs, sidewalks, grass tufts under street lamps. `SkyCycle` is night navy with moon — not a black void and not a daytime suburb.
- **Buildings:** Window grids with emissive night panes. Walk-in marquees stay on the facade. Roof billboard name tags (floating TOP chrome) removed. Interiors keep desks/counters + extra fill lights.
- **HUD:** Doorway WALK IN / E prompts raised in world and as a high-contrast HUD chip. Map / token panels stay centered. Phone Unstuck lives in More.
- **Traffic / life:** Cars stay on street segments and reverse on building collision. Lamps brighter so ground reads at night. Lite reduces lamp/window counts.
- **Banners:** `BuildingBanner` schema unchanged. Missing `imageUrl` → neon title card, never a pink error mesh.

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

Resolution: authored `building.banners` + `BANNER_REGISTRY` (by `buildingId`) → else default walk-in ad.

## Asset paths

No new binaries required. Runtime canvases cover asphalt, cement, grass, facades, banner cards, title windows.

Optional later: `web/public/orbitxcity/ads/<id>.jpg` as `imageUrl`.

## What is solid / next phase

Solid: Midtown as a walkable night district — title, humanoid operatives, roads vs sidewalk vs grass, enterable venues, presence, shop, banners.

Next:

1. Larger world / more districts (do not rewrite collision).
2. Full ad editor UI writing `BuildingBanner` records.
3. Photo banners under `/orbitxcity/ads/`.
4. GLB humanoid kits that still honor `AvatarAppearance`.
5. Driveable vehicles (out of this pass).
