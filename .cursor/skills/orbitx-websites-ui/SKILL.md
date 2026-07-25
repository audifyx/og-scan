---
name: orbitx-websites-ui
description: >-
  OrbitX / OG Scan frontend design system: Tailwind tokens, glass UI, themes,
  splash/marketing, launchpad/terminal skins, shadcn composition. Use when
  building or restyling pages, components, landing/splash, Hub chrome, or
  launchpad/terminal UI.
paths:
  - "web/src/**/*.{tsx,ts,css}"
  - "web/ogdex/src/**/*.{tsx,ts,css}"
  - "web/tailwind.config.ts"
  - "web/index.css"
  - "web/src/index.css"
---

# OrbitX Websites & UI

## Stack

- Vite 5 + React 18 + `react-router-dom` v6
- Tailwind 3 + CSS variables + `cn()` (`clsx` + `tailwind-merge`)
- shadcn/ui (Radix) in `web/src/components/ui/*`
- Alias `@/` → `web/src/`
- Charts: `lightweight-charts` + Recharts
- Toasts: prefer `sonner` on launchpad; older tools may use `use-toast`

## Brand tokens (main Hub)

Use the OrbitX palette — lime / cyan / gold / ink — not generic purple SaaS themes.

- Tailwind: `text-og-lime`, `bg-og-ink`, `border-og-grid`, `text-og-cyan`, `text-og-gold`
- CSS: `hsl(var(--og-*))`, glass vars `--glass-*` in `web/src/index.css`
- Fonts: JetBrains / Space Mono for terminal feel; keep expressive display fonts already in the design system

Glass + radial lime/cyan accents are the house look. Prefer atmospheric gradients / FX layers over flat single-color backgrounds.

## Theme layers (do not mix blindly)

| Layer | Tokens / notes | Where |
|---|---|---|
| Global Hub | shadcn vars + `--og-*`; `applyThemeVars`; localStorage `sol-theme`, wallpapers | `themePresets`, `ThemeSelector` |
| Launchpad | `--pf-*` under `.lp-classic`; classes `pf-mono`, `pf-card` | `pages/orbitx/orbitx-2026.css` |
| Terminal | Hardcoded black/green CRT | `/terminal/*`, `LaunchpadTerminal` |

Profile sync: `profiles.theme_preset` / `custom_wallpaper_url`.

## Composition rules for this product

- Marketing / splash: brand-first hero; OrbitX / OG Scan must read as the hero signal
- Hub is a dense product surface — preserve phone-shell and glass patterns already in `components/phone/*` and `BackgroundFX`
- Prefer existing layout shells (`LaunchpadLayout`, site header/nav) over inventing new card dashboards
- Full-bleed splash/FX planes already exist (`Splash.tsx`, `BackgroundFX`) — extend those modes instead of adding inset hero cards
- Motion: canvas 2D / CSS keyframes / existing burn animations — no Three.js / R3F / Phaser dependency

## Where UI lives

| Surface | Path |
|---|---|
| Splash / marketing | `web/src/pages/Splash.tsx`, `Hero.tsx` |
| Hub FX backgrounds | `web/src/components/BackgroundFX.tsx` |
| Launchpad shell | `web/src/pages/orbitx/LaunchpadLayout.tsx` |
| Shared launchpad bits | `web/src/pages/orbitx/_shared.tsx` |
| Trading terminal | `web/src/components/trading/TradingTerminal.tsx` |
| DEX UI | `web/ogdex/src/components/*` |
| Games / partners iframe chrome | `web/src/pages/Games.tsx` |

## Component conventions

```
web/src/
  pages/           # route screens (PascalCase.tsx)
  pages/orbitx/    # launchpad + terminal
  pages/nft/       # NFT marketplace
  components/ui/   # shadcn primitives (kebab-case)
  components/*-20x/# Hub plugin packs → Index.tsx switch
  hooks/           # useX
  lib/             # domain clients
```

- Compose with `@/components/ui/*` + `cn(...)`
- Lazy heavy routes with `lazyWithRetry` (especially Metaplex/NFT)
- New Hub tools: lazy-import into `Index.tsx` slug switch like other `*-20x` packs

## Do / Don't

**Do**
- Match neighboring spacing, mono labels, inset accent borders (`shadow-[inset_Npx_0_0_hsl(var(--og-lime)/…)]`)
- Keep launchpad copy fee-accurate (read `platformFee.ts`)
- Respect mobile + desktop; Hub is phone-metaphor heavy

**Don't**
- Restyle DEX pages with launchpad `--pf-*` tokens (or vice versa)
- Drop Inter/Roboto/system as a “refresh”
- Add purple-glow generic AI landing aesthetics
- Put new scanner/screener UI in the main SPA when it belongs in ogdex
