# OrbitX Gaming Studio

**Team:** Game Development  
**Owns:** `web/src/gaming/**`  
**Does not own:** Crypto trading systems, backend infrastructure/migrations

## Entry

`/play` — Gaming ecosystem hub

| Route | Feature |
|-------|---------|
| `/play` | Home / loadout overview |
| `/play/character` | Classes, cosmetics, equipment |
| `/play/progression` | XP, daily/weekly missions, achievements, rankings |
| `/play/pass` | Battle pass season track |
| `/play/inventory` | Soft-currency shards + item ownership |
| `/play/multiplayer` | Matchmaking, lobbies, parties, presence, chat, voice stubs |
| `/play/hud` | Health/energy/minimap/notifications/menu chrome |

## Architecture

- **Catalogs** — classes, items, cosmetics, missions, achievements, battle pass
- **Systems** — progression math, economy (shards), character loadout
- **Multiplayer client** — swappable interfaces (`MatchmakingService`, `LobbyService`, `PartyService`, `PresenceService`, `ChatService`, `VoiceService`) with local implementations for Studio QA
- **State** — `gameProfileStore` (localStorage) until Backend `oxw_*` APIs are wired

## Quality targets

AAA menu feel · Steam-like social panels · Web3-ready ownership model (items/cosmetics) · modern multiplayer UX patterns
