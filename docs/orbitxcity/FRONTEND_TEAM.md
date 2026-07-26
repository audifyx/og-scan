# Frontend Team — Interface

## Owns
- `web/src/pages/orbitxcity/OrbitxCityPage.tsx`
- `web/src/components/orbitxcity/WorldCanvas.tsx`
- Mobile viewport / overflow guards in `city.css` root only (`oxc-root`, canvas sizing) — coordinate with UI append section

## Tasks
1. Use MainMenu (from UI) instead of bare EnterScreen when available
2. Pass `getWorldBlock(selectedCityId)` into scene (zones, spawn bounds)
3. Ensure `oxc-root` fills 100dvh, no horizontal overflow on phones
4. Wire quality/lite already on context; no new state ownership

## Do not touch
Creating world geometry, lobby channel logic, CharacterMesh internals
