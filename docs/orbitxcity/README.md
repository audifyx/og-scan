# OrbitX City — Sprint Integration Notes

## Parallel teams (this sprint)

| Team | Delivered |
|------|-----------|
| UI | Mobile-first Main Menu, Lobby Browser, Character Creator, Settings, Help, HUD lobby chip + exit |
| Avatar | Shared `CharacterMesh` Sims-style humanoid (hair/outfit/face) for local + remote |
| World | Unlocked Miami + LA blocks via `getWorldBlock(cityId)` |
| Multiplayer | Lobby descriptors, directory presence, CityProvider lobby/city APIs |
| Frontend | MainMenu gate + WorldCanvas multi-city wiring |

## How to play

1. Open `/Orbitxcity`
2. Main Menu → Character / World Select / Join Lobby / Start Game
3. In-world: Lobby chip, Menu exit, Look/Config/Help dock buttons

## Key APIs

```ts
getWorldBlock(cityId)          // worlds/index.ts
MAIN_LOBBY / makeLobby()       // realtime.ts
watchLobbyDirectory(cb)        // public lobby list
useCity().lobby / setLobby / selectedCityId / exitToMenu
```

See `TEAM_CONTRACTS.md` for ownership boundaries.

Midtown open-district pass (ground, humanoids, banners): `OPEN_CITY.md`.
Burn store (Jupiter buy → burn ORBITX → unlock clothes/ads/listings): `CITY_SHOP.md`.
