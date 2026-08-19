# OrbitX City — Metaverse Alpha

Bright Roblox-like hub on the existing City stack. **Kept** `CityProvider`, `WorldCanvas`, quality high/lite, `enterBuilding` / `exitBuilding` + collision doorways, realtime presence Map, Jupiter burn shop, and neon `#00ff9f` + gold `#c5a26f`.

This Alpha ships the launch milestone: **basic world + character creation + home dashboard**. Beta rails (shop, marketplace, multiplayer) stay in place and get polish — they are not rewritten.

## Kept vs upgraded

| System | Status |
|--------|--------|
| CityProvider, gate flow, quality high/lite | Kept |
| enter/exit + `interiorLayout` + furniture collision | Kept |
| Realtime + `RemoteAvatars` presence Map | Kept — now syncs beard + body type |
| Collision south-face doorways | Kept |
| Burn shop (Jupiter → ORBITX mint `13H4…PX9`) | Kept — wishlist + rarity badges |
| Sky / plaza | Upgraded — daylight hub, spawn pad, merchant stalls |
| Characters | Upgraded — body types, beard picker, 6 local slots (CSS doll, live world mesh) |
| HUD | Upgraded — Home dashboard (mobile dock + desktop nav) |
| Map / market / friends | Upgraded — hub fast travel, tape sort, party list |

## Files

- `web/src/lib/orbitxcity/metaverseHub.ts` — hub zones, rarity, wishlist, slots, party, sort
- `web/src/components/orbitxcity/ui/CityHomeDashboard.tsx` — mobile/desktop home
- `web/src/components/orbitxcity/world/SkyCycle.tsx` — bright daylight
- Character / shop / map / friends panels as listed above

## Next (not this Alpha)

Guild halls, housing interiors as homes, elevators, PvP arenas, battle pass, world streaming, ad editor, photoreal humans, driveable vehicles.
