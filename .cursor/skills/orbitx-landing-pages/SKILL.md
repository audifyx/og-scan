---
name: orbitx-landing-pages
description: Use when building or editing marketing/landing/splash pages for OrbitX — the public "/" splash, hero sections, product carousels, launch pages, or any cinematic brand-first page. Covers the card-deck carousel pattern, starfield/parallax atmosphere, co-located CSS, live-stats count-ups, and what NOT to do (no WebGL/3D slideshows, no framer-motion).
---

# OrbitX Landing & Marketing Pages

The reference implementation is `web/src/pages/Splash.tsx` (route `/`). It replaced a laggy 3D hero slideshow with a **CSS card-deck carousel** — that lesson is policy: cinematic feel comes from CSS 3D transforms, parallax vars, and canvas starfields, never WebGL or heavy animation libraries.

## Page anatomy (copy this structure)

1. **Brand-first hero**: the brand name is the hero (`sp-brand-hero`, "OrbitX"), one short headline ("The on-chain operating system."), a 1–2 sentence lead, and exactly two CTAs (primary signup + secondary "Open OrbitX DEX").
2. **Dominant visual = real product screenshots**, not illustrations. Splash uses a `PRODUCT_SHOTS` array rendered as a card deck.
3. **Atmosphere layers** (back to front): canvas starfield, cosmos/beam/glow orbs, perspective grid (`.sp-grid3d`), then content. Parallax is driven by CSS custom properties `--mx/--my/--py` updated from mouse/scroll listeners.
4. **Live stats**: fetch real numbers from `/api/ogdex/platform-stats` and animate count-up when scrolled into view (IntersectionObserver).
5. **Scroll reveals**: IntersectionObserver adding `.reveal` / `.stagger` classes. No animation library.

## Card-deck carousel pattern

Cards are absolutely stacked; each card gets `--off` (signed offset from active) and `--abs` (absolute distance) style vars, and CSS does the rest:

```css
.sp-cardp {
  position: absolute; inset: 0;
  transform:
    translate3d(calc(var(--off) * 7.5%), calc(var(--abs) * -14px), 0)
    rotate(calc(var(--off) * 2deg))
    scale(calc(1 - var(--abs) * 0.06));
  opacity: calc(1 - var(--abs) * 0.18);
  filter: brightness(calc(1 - var(--abs) * 0.32));
  transition: transform .65s cubic-bezier(0.22,1,0.36,1), opacity .65s, filter .65s;
}
```

Behavior: auto-advance every ~4.5s, pause on hover (`onMouseEnter`/`onMouseLeave` toggling a `deckPaused` state), touch swipe, dot + arrow controls, `zIndex: 10 - abs`.

## CSS strategy

Marketing pages co-locate their styles as a large `<style>` block **inside the page component** (see the bottom of `Splash.tsx`), prefixed with a page namespace (`sp-` for splash). This keeps one-off marketing CSS out of the global design system. In-app pages do the opposite — they use the global glass classes from `index.css` (see the `orbitx-frontend` skill).

## In-app hero variant

For hero sections inside the product (not `/`), use the `web/src/components/Hero.tsx` pattern: full-bleed section, `grid-bg` + `noise` overlays, two blurred glow orbs (cyan + lime), display headline with `text-glow-gold`/`text-og-lime` spans, lime filled primary CTA + ghost secondary, and a glass media panel on the right.

## Static splash vs SPA

The Vite build is multi-page: `web/index.html` is a **static** marketing entry and `web/app.html` boots the React SPA (Vercel rewrites SPA routes to `/app.html`). If a marketing page must load instantly with zero JS-framework cost, consider the static entry; otherwise add a route rendering `Splash`-style pages inside the SPA.

## Hard rules

- No WebGL, three.js, or 3D slideshow libraries — a previous 3D hero shipped and was reverted for lag.
- No framer-motion (not in the dependency tree; motion is CSS-only).
- Real data over fake data: pull stats from `/api/ogdex/platform-stats` or Supabase instead of hardcoding vanity numbers.
- Keep the dark, neon, mono-label aesthetic: uppercase `font-mono` micro-labels with wide tracking, Unbounded display headlines, lime/cyan/gold accents on near-black.
- Mobile first-class: the deck supports swipe; parallax must be pointer-guarded so touch devices don't jitter.
