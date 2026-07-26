# OrbitX World — Team Contracts & Ownership Map

Lead Technical Director coordination document. Every team owns ONLY its subsystem.
Communicate through interfaces below. Do not rewrite another team's code.

## Stack (repo reality)

- Vite + React Router SPA under `web/` (not Next.js)
- React Three Fiber / drei / three for the 3D world
- Supabase Realtime for multiplayer
- Solana wallet adapter + existing Jupiter helpers for trading

Primary route: `/Orbitxcity` (alias `/orbitxcity`)

---

## Ownership map (exclusive files)

| Team | Owns (write) | Must not touch |
|------|--------------|----------------|
| **UI** | `web/src/components/orbitxcity/ui/**`, menu/lobby/settings/help CSS sections in `city.css` | world meshes, realtime internals, CityProvider logic |
| **Frontend** | `OrbitxCityPage.tsx`, `WorldCanvas.tsx` wiring only, viewport/meta helpers | backend, blockchain, world mesh content |
| **Multiplayer** | `lib/orbitxcity/realtime.ts`, lobby fields in `CityProvider.tsx` | UI markup, world meshes |
| **Avatar** | `world/PlayerAvatar.tsx`, `world/RemoteAvatars.tsx`, `world/CharacterMesh.tsx` (new) | UI panels, realtime channel logic |
| **World** | `lib/orbitxcity/demoBlock.ts`, `cities.ts`, `world/*` except avatar files, new city block configs | UI, CityProvider, realtime |
| **Blockchain** | token buy / Jupiter panels already owned; no expansion this sprint unless asked | world/UI ownership |
| **Docs** | `docs/orbitxcity/**` | production code except README stubs |

Shared contracts (TD-owned, all teams may import):

- `web/src/lib/orbitxcity/types.ts`
- `web/src/lib/orbitxcity/index.ts` re-exports

---

## Sprint goal (Sims-quality foundation)

1. **Full game main menu** — Start Game, Join Lobby (main / public / private password), Character, Settings, Help; mobile-first.
2. **Lobby system** — Main lobby + custom public + private password rooms via Realtime.
3. **Richer characters** — Sims-like body proportions, hair/outfit variants, idle/walk/emote presence.
4. **More worlds** — Unlock Miami + LA as selectable playable blocks (distinct layouts/lighting).
5. **World UI polish** — clearer district identity, teleport/world select, HUD lobby chip + exit-to-menu.

---

## Interface contracts

### Lobby (Multiplayer ↔ UI)

```ts
interface LobbyDescriptor {
  id: string;      // Realtime channel id
  label: string;
  isPrivate: boolean;
}

MAIN_LOBBY: LobbyDescriptor  // "oxc-world-nyc"
makeLobby(name: string, password?: string): LobbyDescriptor
watchLobbyDirectory(cb: (lobbies: DirectoryLobby[]) => void): () => void
```

CityProvider exposes:

- `lobby: LobbyDescriptor`
- `setLobby(lobby: LobbyDescriptor): void` — applied before enter / when switching
- `exitToMenu(): void` — disconnect + `entered=false`

UI never constructs channel ids manually — only calls `makeLobby` / selects from directory / `MAIN_LOBBY`.

### Avatar appearance (Avatar ↔ UI)

```ts
interface AvatarAppearance {
  name: string;
  bodyColor: string;
  accentColor: string;
  skinColor: string;
  hairStyle: "short" | "long" | "buzz" | "bun" | "mohawk";
  hairColor: string;
  outfit: "street" | "suit" | "sport" | "neon";
  faceStyle: "neutral" | "cool" | "smile";
}
```

UI writes appearance via `setAvatar`. Avatar team renders `CharacterMesh` from those fields. Realtime presence already carries colors/name; hair/outfit may be packed into presence meta when Multiplayer extends `CityIdentity` (optional this sprint — visual local/remote parity preferred).

### World selection (World ↔ Frontend ↔ UI)

```ts
ORBITX_CITIES: CityDefinition[]  // unlocked flags
getWorldBlock(cityId: CityId): WorldBlockConfig
```

UI city picker sets `selectedCityId` on context (Frontend/Multiplayer wiring). WorldCanvas loads `getWorldBlock(selectedCityId)`.

### HUD panels (UI)

Extended `HudPanel` includes `"settings" | "help" | "lobbies" | "character"` in addition to existing panels.

---

## Conflict prevention

1. One team per file path. If a change needs another team's file, open an interface request in this doc — do not edit.
2. Append-only CSS: UI team adds new classes under `/* === Main Menu / Lobby === */` section; do not rewrite unrelated rules.
3. No duplicate lobby or avatar systems.
4. Prefer additive APIs; never break existing `/Orbitxcity` enter flow until MainMenu replaces EnterScreen.

---

## Agent deliverables checklist

Every team ships:

- [ ] Code under exclusive ownership
- [ ] Short README or section in `docs/orbitxcity/` for their subsystem
- [ ] No TypeScript errors in owned files
- [ ] No imports of private internals from other teams' files
