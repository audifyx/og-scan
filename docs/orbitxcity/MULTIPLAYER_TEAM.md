# Multiplayer Team — Interface

## Owns
- `web/src/lib/orbitxcity/realtime.ts`
- Lobby wiring inside `web/src/pages/orbitxcity/CityProvider.tsx`

## Tasks
1. Keep `LobbyDescriptor`, `MAIN_LOBBY`, `makeLobby`, `watchLobbyDirectory`
2. When connecting to a lobby, also track presence on `oxc-lobby-directory` with `{ lobbyId, label, isPrivate }`
3. Extend `CityIdentity` + presence with optional hairStyle/hairColor/outfit/faceStyle
4. CityProvider API:
   - `lobby`, `setLobby`
   - `selectedCityId`, `setSelectedCityId`
   - `exitToMenu()` — disconnect + entered=false
   - Connect `CityRealtimeClient` with `lobby.id` (not hardcoded room)
5. Reconnect when lobby changes while entered

## Do not touch
UI components, world meshes, demoBlock city geometry
