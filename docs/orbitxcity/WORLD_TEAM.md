# World Building Team — Interface

## Owns
- `web/src/lib/orbitxcity/cities.ts`
- `web/src/lib/orbitxcity/demoBlock.ts` (+ new city config modules under `lib/orbitxcity/worlds/` if needed)
- World environment meshes EXCEPT PlayerAvatar / RemoteAvatars / CharacterMesh
- Export `getWorldBlock(cityId: CityId): WorldBlockConfig`

## Tasks
1. Unlock Miami + LA (Boston stays locked)
2. Create distinct playable blocks for Miami (coastal pastel neon, open plazas) and LA (strip / stages)
3. Keep NYC as richest block; Miami/LA can be smaller but visually distinct (lighting accents via CityEnvironment props if needed)
4. Document teleport points + districts per city
5. Collision must work with new buildings (reuse collision helpers)

## Do not touch
UI, CityProvider, realtime, avatar files
Frontend will wire `getWorldBlock(selectedCityId)` into WorldCanvas.
