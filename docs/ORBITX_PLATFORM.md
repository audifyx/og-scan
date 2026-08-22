# OrbitX Platform Map (source of truth for agents)

Last verified: 2026-07-25 after merging teams 1–5 into `main`.

## Product surfaces

| Surface | Route | Code | Owns |
|---------|-------|------|------|
| City (3D) | `/Orbitxcity` | `web/src/pages/orbitxcity/**` | City / world demo |
| OrbitX OS | `/os/*` | `web/src/os/**` | Frontend UX shell |
| Play Studio | `/play/*` | `web/src/gaming/**` | Gaming Studio |
| Crypto Intel | `/intel/*` | `web/src/crypto/**` | Crypto Intelligence |
| Social HQ | `/hq/*` | `web/src/social/**` | Social + Growth |
| DEX | `/ORBITX_DEX` | `web/ogdex/**` | Production DEX |
| OrbitX AI | `/ai` | `web/src/pages/OrbitXAI.tsx`, `web/api/orbitx-ai.js` | Wallet-gated AI + MCP super app |
| Telegram | `/telegram` | `web/src/pages/TelegramOrbitX.tsx`, `web/api/telegram-orbitx.js` | Official @theorbitxmcpbot (groups public, DMs linked) |
| Launchpad | `/orbitxlaunch` | `web/src/pages/orbitx/**` | Token launch |
| Terminal | `/terminal` | `web/src/pages/orbitx/Terminal*` + `TradingTerminal` | Trade UI |
| On-chain proof | `/onchain` | `web/src/pages/OnChainProofPage.tsx` | Verify signatures, memo attestations, rebuild index |

## Backend

| Piece | Location |
|-------|----------|
| World schema | `supabase/migrations/20260725190000_oxw_world_platform.sql` |
| RLS + RPCs | `supabase/migrations/20260725190100_oxw_rls_and_rpcs.sql` |
| World API | `web/api/orbitx-world.ts`, `web/api/orbitx/world/**` |
| Workers | `supabase/functions/oxw-*` |
| Crypto scan | `web/api/orbitx/crypto-scan.ts` |
| Anti-vamp | `web/api/orbitx/anti-vamp-check.ts` |
| OG DEX API | `web/api/ogdex/**` |

## Docs by team

- Backend: `docs/backend/*`
- Frontend OS: `docs/frontend/ORBITX_OS.md`
- Gaming: `docs/gaming/STUDIO.md`
- Crypto: `docs/crypto/INTELLIGENCE.md`
- Social: `docs/social/PLATFORM.md`
- QA Swarm: `docs/agents/QA_SWARM.md`
- On-chain migration (A/B/C + program design): `docs/audit/ONCHAIN_MIGRATION.md`

## Stack reality

- Vite + React Router SPA under `web/` (not Next.js)
- R3F for City; Supabase Realtime; Solana/Jupiter
- Unit tests: Vitest (`web/npm test`)

## Non-overlap rules

- Backend team: schema/API only — no UI
- Frontend OS: visuals/shell — no backend ownership
- Gaming: play systems only — no trading backend
- Crypto: scanner/terminal/intel — no social/games
- Social: HQ/communities/growth — no trading engines / combat
