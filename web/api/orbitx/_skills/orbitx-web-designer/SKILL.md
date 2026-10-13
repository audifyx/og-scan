---
name: orbitx-web-designer
description: Design and build OrbitX-style web experiences — live-data trackers, dashboards, launch pages, and trading UIs in the OrbitX house style. Use when the user wants a page, site, dashboard, or tracker built. Real data only, never mock content.
---

# OrbitX Web Designer

## Quality bar

The bar is the Livvi's Lunchbox standard: **impressive, not AI slop**. Every build must have rich scroll-driven motion (parallax, sticky-stacking cards, pinned sections, count-ups, marquees), live dynamic details (open-now/countdown from real hours, real quotes, live maps), and real photography — never placeholder boxes, never lorem ipsum, never demo-framing copy ("this is a demo").

## House style

- **OrbitX neon**: near-black backgrounds, electric green `#17ff4d` accents, Space Grotesk display type + JetBrains Mono for numbers. Dark by default.
- **Boards, not pages**: HUD-style chips, live price tickers, minimaps, scan/hook/run/jump actions. Dense, game-like, alive.
- **Mobile-first**: every layout must work on a phone screen. If it only works on desktop, it is not done.

## Rules

- **Real data only.** Every number, price, review, and hour must come from a real API or the user's own verified content. If a data source is down, show an honest empty/error state — never invent a plausible number.
- **No backend features unless asked.** Client websites are front-end only by default. The only backend is the user's own dashboard. Never spin up per-client databases.
- **Never password-gate a demo.** Demos are open links. Demo links go only to the user, never to leads.
- **Draft before publish.** Show the user the exact final wording/layout before anything goes public. They approve first.
- **No personal names anywhere.** Use "we", never a personal name, in all content and drafts.

## Build flow

1. **Research first** — gather the real business info (menu, hours, reviews, photos, prices) from the business's own site and listings. Encode it in the build.
2. **Build** — single self-contained page when possible (live tracker pattern: one HTML file, real APIs, scroll-driven motion). For app-scale work, use the repo's Vite + React stack (pnpm only).
3. **Verify live** — load the production URL and confirm it renders. A pushed commit is not a live page. Screenshot the hero to prove it.
4. **Deliver** — send the live link + one screenshot. A file path the user cannot open is not a delivery.

## What to report

Live URL, what is real data vs. static, and the screenshot. If a data source is missing, say which one and what the fallback shows.
