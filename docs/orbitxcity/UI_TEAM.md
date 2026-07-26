# UI Team — Interface

## Owns
- `web/src/components/orbitxcity/ui/MainMenu.tsx` (create — replaces EnterScreen as primary gate)
- `web/src/components/orbitxcity/ui/EnterScreen.tsx` (refactor to re-export MainMenu OR keep as thin wrapper)
- `web/src/components/orbitxcity/ui/LobbyBrowser.tsx` (create)
- `web/src/components/orbitxcity/ui/SettingsPanel.tsx` (create)
- `web/src/components/orbitxcity/ui/HelpPanel.tsx` (create)
- `web/src/components/orbitxcity/ui/CharacterCreator.tsx` (create — richer Sims-style creator)
- HUD lobby chip + exit button in `CityHUD.tsx`
- CSS under `/* === Main Menu / Lobby === */` in `city.css` (append only)

## Features
Full mobile game menu:
1. Start Game → public Main Lobby
2. Join Lobby → Main / browse public / create public / join private with password
3. Character → hair/outfit/face + colors
4. Settings → quality, touch controls
5. Help → controls cheat sheet
6. World select chips (NYC/Miami/LA unlocked when World team unlocks)

Use `MAIN_LOBBY`, `makeLobby`, `watchLobbyDirectory` from realtime.ts.
Call `setLobby` / `setAvatar` / `setEntered` / `setQuality` / `setTouchControls` from CityProvider (Multiplayer adds lobby APIs).

## Mobile
Phone-first layout: full viewport, large tap targets, no desktop-card-on-phone look.

## Do not touch
world/*, CityProvider.tsx internals beyond consuming context, realtime internals
