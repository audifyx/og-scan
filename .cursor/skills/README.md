# OrbitX / OG Scan — Agent Skills

Repo-trained Cursor Agent Skills distilled from this codebase (websites, coding, games, web3, backend).

## Skills

| Folder | Invoke |
|---|---|
| `orbitx-skill-finder` | `/orbitx-skill-finder` |
| `orbitx-repo-map` | `/orbitx-repo-map` |
| `orbitx-websites-ui` | `/orbitx-websites-ui` |
| `orbitx-coding-conventions` | `/orbitx-coding-conventions` |
| `orbitx-web3-launchpad` | `/orbitx-web3-launchpad` |
| `orbitx-backend-edge` | `/orbitx-backend-edge` |
| `orbitx-games-interactive` | `/orbitx-games-interactive` |

Cursor auto-discovers these from `.cursor/skills/*/SKILL.md` and loads them when the task matches each skill’s `description`.

## Refreshing skills

When product rules change (fees, vanity suffix, auth, dual-app boundaries), update the relevant `SKILL.md` in the same PR as the code so agents stay aligned with live behavior — not stale docs.
