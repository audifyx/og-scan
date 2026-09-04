# OrbitX Agent Skills

Repo-trained skills for AI coding agents (Cursor auto-loads `SKILL.md` files from `.cursor/skills/<name>/`). Each skill was distilled from the actual code in this repository — file paths, idioms, gotchas, and past production incidents — so agents build new features the way this codebase already does.

| Skill | Use for |
|---|---|
| [`orbitx-frontend`](orbitx-frontend/SKILL.md) | Pages, components, routing, theming, glassmorphism design system, data fetching in `web/src` |
| [`orbitx-landing-pages`](orbitx-landing-pages/SKILL.md) | Splash/marketing pages: card-deck carousel, parallax atmosphere, co-located CSS, live stats |
| [`orbitx-backend`](orbitx-backend/SKILL.md) | Supabase Edge Functions, the `/api/ogdex` Vercel router, SQL migrations + RLS, auth, rate limiting |
| [`orbitx-web3`](orbitx-web3/SKILL.md) | Wallet SIWS login, hand-rolled EVM layer, pump.fun launches, vanity mints, Jupiter swaps, bonding-curve contracts |
| [`orbitx-games`](orbitx-games/SKILL.md) | Games & predictions: current partner iframes, leaderboards/achievements/XP, native-game blueprint |
| [`orbitx-ai-bots`](orbitx-ai-bots/SKILL.md) | AI functions (NVIDIA provider chain, streaming, grounding), Telegram/Discord/X bots, MCP agent API |

Conventions across all skills:

- Facts are grounded in code, not docs — where docs are stale (e.g. vanity suffix docs say `orbit`/`bit`, production uses `obx`), the skills say so explicitly.
- Each skill records "hard rules" learned from real incidents (no framer-motion, no 3D hero slideshows, connect-before-signMessage, duplicate theme exports, unregistered ogdex routes).
- When code changes make a skill wrong, update the skill in the same PR.
