# OrbitX City — AAA Art Direction (Agent Prompt)

Use this document + the concept references in chat as the **source of truth** for OrbitX City UI/UX.

## Palette (non-negotiable)

| Token | Hex | Use |
|-------|-----|-----|
| Matte black | `#0a0a0a` → `#050505` | Full-bleed backgrounds |
| Neon green | `#00ff9f` / `#39ff14` | Energy, active, holograms, CTAs |
| Metallic gold | `#ffd700` / `#c5a26f` | Premium frames, logo metal, pod rings |
| Glass | `rgba(8,16,12,0.45–0.72)` + blur | Panels, buttons, HUD |
| Text | `#f2fff8` / muted `rgba(200,230,210,0.55)` | Labels |

## Typography

- Display: **Orbitron** (logo, titles, menu labels)
- Body: **Sora**
- Data/mono: **JetBrains Mono**

## Visual rules

1. Dark matte surfaces — no flat purple/cream AI-default themes.
2. Glassmorphism: frosted panels, thin neon borders, soft outer glow.
3. Cinematic lighting: bloom on neon, subtle gold rim light, cosmic particles.
4. One composition per screen (menu / character select / lobby).
5. Hover/active = neon green intensity up + slight lift — never noisy.

## Screen map (priority)

1. **Main Game Menu** — OrbitX CITY logo + glass tile grid (Play, Characters, Marketplace, Inventory, Missions, Leaderboards, Friends, Settings) + cosmic bg.
2. **Character Selection** — 5 holographic pods: Trader, Builder, Gamer, Creator, Explorer.
3. Tower Lobby · Trading Terminal · OS Dashboard · Social/Gaming (later).

## Tech anchors

- Entry: `web/src/pages/orbitxcity/OrbitxCityPage.tsx`
- UI: `web/src/components/orbitxcity/ui/`
- World: `web/src/components/orbitxcity/world/`
- Theme: `web/src/pages/orbitxcity/city.css` (scoped under `.oxc-root`)

## Gate flow

`menu` → `characters` → `world` (3D city). Demo explore may skip wallet.
