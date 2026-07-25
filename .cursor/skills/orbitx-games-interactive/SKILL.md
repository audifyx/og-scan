---
name: orbitx-games-interactive
description: >-
  OrbitX games, prediction partners, canvas FX, phone-shell UX, splash
  starfields, burn animations, vibe-code/Aether HTML toys, LiveKit spaces
  polish. Use when building playful interactive visuals, games pages, Hub
  backgrounds, or lightweight HTML games — not Three.js/Phaser engines.
paths:
  - "web/src/pages/Games.tsx"
  - "web/src/pages/Splash.tsx"
  - "web/src/components/BackgroundFX.tsx"
  - "web/src/components/phone/**"
  - "web/src/components/burn/**"
  - "web/src/components/Scanlines.tsx"
  - "supabase/functions/vibe-code/**"
  - "docs/vibecode/**"
---

# OrbitX Games & Interactive Visuals

## Reality check

This repo does **not** use Three.js, React Three Fiber, or Phaser.

Interactive DNA is:

1. **Partner games / predictions** — iframe browser chrome (`Games.tsx`)
2. **Canvas 2D FX** — starfield, matrix rain, grid3d, nebula (`BackgroundFX.tsx`, Splash)
3. **Phone OS metaphor** — splash → lock → home → app (`components/phone/*`)
4. **CSS motion** — burn cards, scanlines/CRT, wallpaper themes
5. **Aether / vibe-code** — single-file HTML generated via edge + Telegram

When the user asks for “games”, prefer extending these patterns unless they explicitly request a new engine (and accept the dependency cost).

## Games / partnerships page

`web/src/pages/Games.tsx`:

- Browser-style shell matching Phantom Trade tab UX
- Tab switcher between partners (e.g. Degen Tower, orbitx-prediction.fun)
- Iframe load/error/reload handling
- Dark chrome `#0a0a0f` / `#141420` — match when adding partners

Adding a partner: extend the `PARTNERSHIPS` array with `id`, `name`, `url`, icon, color token (`text-og-lime` / `text-og-gold`).

## BackgroundFX contract

```ts
type BuiltinMode = "nebula" | "starfield" | "grid3d" | "orbs" | "matrix" | "custom" | "minimal";
// localStorage: hub-bgfx / hub-wallpaper
```

Rules:

- Persist mode via `BG_KEY` / `WALLPAPER_KEY`
- Cap DPR (`Math.min(devicePixelRatio, 2)`)
- Always cleanup `raf` + resize listeners on unmount
- New modes: add to `MODES`, `BG_META`, and a `run*` engine; keep CPU light for Hub multitasking

## Splash / marketing motion

`Splash.tsx` uses cinematic card-deck / product art + live stats — prefer crisp CSS/canvas over laggy 3D slideshows (see recent carousel fix). Brand (OrbitX / OG Scan) must dominate the first viewport.

## Phone shell

Treat Hub as a device UI:

- Boot sequence and app windows live under `components/phone/*`
- New “apps” should feel installable inside that metaphor when touching Hub home
- Wallpapers / animated wallpapers sync with theme hooks

## Burn / viral canvas

- CSS keyframes in `tailwind.config.ts` (`burn-*`) + `components/burn/*`
- Scan card PNG export: `lib/scanCardImage.ts` (canvas) — keep shareable, high-contrast, on-brand

## CRT / terminal play

- `Scanlines.tsx` + terminal green/black skins for `/terminal/*`
- Mono fonts, phosphor glow sparingly — match existing terminal pages, don’t invent a second CRT system

## Vibe-code / Aether HTML toys

Edge function generates single-file HTML for Telegram delivery. Training notes live in `docs/vibecode/`.

When extending:

- Keep output self-contained HTML/CSS/JS
- No secrets in generated pages
- Reuse the dedicated long-running isolate patterns already used by `vibe-code`

## Live / Spaces (adjacent)

LiveKit voice/video is product-adjacent to “interactive”:

- Tokens via edge `livekit-token` / `public-listener-token`
- UI under Spaces pages + `components/spaces` / lobbies
- Audio waveform polish exists — extend those components rather than new media stacks

## Design constraints for playful work

- At least 2–3 intentional motions (enter, idle, feedback) — not random particle spam
- Stay in OrbitX lime/cyan/gold/ink language
- Prefer full-bleed FX planes behind Hub content
- No floating sticker badges over heroes
- Mobile performance first: pause FX when tab hidden when neighbors already do

## Implementation checklist

1. Partner iframe vs native canvas vs phone app vs vibe HTML?
2. Reuse `BackgroundFX` / phone / Games chrome before new systems
3. Persist user preference if Hub-global
4. Cleanup animation loops
5. Keep non-custodial product framing even in game UIs (no fake “wallet drained” jokes that confuse real signing UX)
