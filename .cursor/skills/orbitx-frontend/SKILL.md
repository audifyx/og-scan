---
name: orbitx-frontend
description: Use when building or modifying pages, components, layouts, themes, or UI in the OrbitX web app (web/src). Covers the glassmorphism design system, routing/lazy-loading conventions, TanStack Query + Supabase data fetching, and shadcn/Tailwind component style. Trigger for any "add a page", "build a component", "style this", "make it look like the rest of the site" task.
---

# OrbitX Frontend (web/src)

Vite + React 18 + TypeScript SPA. shadcn/Radix UI, Tailwind, TanStack Query, Supabase client. **No framer-motion** — all motion is CSS keyframes/transitions. Package manager on Vercel is pnpm; local dev uses `npm run dev` in `web/` (port 8080).

## Stack facts (don't re-derive these)

- Router: `react-router-dom` v6. State/data: `@tanstack/react-query` v5 + `@supabase/supabase-js` v2.
- Path alias: `@/*` → `web/src/*` (both Vite and tsconfig).
- Multi-page Vite build: `index.html` = static marketing splash, `app.html` = the React SPA. Vercel SPA fallback rewrites to `/app.html`.
- shadcn config: `web/components.json` — components in `@/components/ui`, `cn()` in `@/lib/utils`, CSS vars in `src/index.css`, baseColor slate.
- Fonts: Unbounded (display headlines), Figtree (body), JetBrains Mono (`font-mono` labels).
- Icons: `lucide-react`. Toasts: `sonner`. Charts: `recharts` / `lightweight-charts` v4.

## Adding a page

1. Create a PascalCase file in `web/src/pages/` (feature areas get folders: `pages/orbitx/`, `pages/nft/`).
2. Register the route in `web/src/App.tsx`. Wrap with `ProtectedRoute` for auth-gated pages, `AdminRoute` for admin.
3. Heavy pages must be code-split with `lazyWithRetry` from `web/src/lib/lazyWithRetry.tsx` (retries chunk load once, then guarded reload for stale-deploy chunks) wrapped in `<Suspense>`. Follow the existing NFT routes in `App.tsx` as the template.
4. Provider tree is already global (`ErrorBoundary` → `MaintenanceLock` → `QueryClientProvider` → `AuthProvider` → `SolanaWalletProvider` → `EvmWalletProvider` → `ThemeProvider` → `BrowserRouter`). Never add duplicate providers inside a page.
5. Tool-style pages should use `ToolPageShell` (`web/src/components/ToolPageShell.tsx`) which gives `ToolHeader`, `SectionCard`, `FilterPill`, `StatChip`. Full app chrome comes from `AppLayout` (`web/src/components/layout/AppLayout.tsx`).

## Design system — the house look

Everything is dark glassmorphism with neon accents. The whole system lives in `web/src/index.css` (`App.css` is intentionally empty).

- Surfaces: use the glass utility classes — `.glass`, `.glass-sm`, `.glass-card`, `.glass-panel`, `.glass-nav`, `.glass-modal`, `.og-glass-card`. If hand-rolling: `border border-white/10 bg-white/[0.04] backdrop-blur-xl rounded-xl`. Never flat white cards.
- Accent palette (Tailwind `og.*` colors): **lime** = primary action, **cyan** = accent/info, **gold** = announcements/highlights, **blood** = danger/down, `ink`/`grid` = backgrounds. Use `text-og-lime`, `bg-og-lime`, `shadow-og-lime-glow`, etc.
- Labels: `font-mono text-xs uppercase tracking-[0.16em]` (or wider). Headlines: `font-display` bold/black, optionally `text-glow` / `text-glow-gold`.
- Atmosphere: `.grid-bg`, `.noise`, `.crt-scanlines` (or the `Scanlines` component), and blurred glow orbs:

```tsx
<div className="pointer-events-none absolute -top-56 left-[15%] h-[700px] w-[700px] rounded-full bg-og-cyan/12 blur-[140px]" />
```

- Motion: Tailwind keyframes only — `animate-scan-line`, `pulse-glow`, `flicker`, `shimmer`, `ticker`. **Do not add framer-motion.**
- Buttons: shadcn `Button` already has the house feel (`rounded-xl`, `hover:-translate-y-[1px]`, `active:scale-[0.97]`). Compose variants with `cn()` + CVA; don't invent parallel button systems.
- The Launchpad area has its own skin: `pages/orbitx/LaunchpadLayout.tsx` imports `orbitx-2026.css` and wraps in `.lp-classic` (matte black, neon emerald + gold, `.pf-card`, `.pf-btn`). Launchpad child pages must match that skin, not the main glass skin.

## Theming

- Runtime themes: ~200 presets in `web/src/hooks/themePresets.ts`; provider is `web/src/hooks/useTheme.tsx` (default `"og-hacker"`, persisted to localStorage key `sol-theme` and `profiles.theme_preset`).
- `applyThemeVars(themeId)` writes CSS vars on `:root` and mirrors `--primary` into `--og-lime` etc. so legacy `og-*` utilities follow the theme. New themes: add a preset object with a `vars` map — never hardcode colors that should be themeable.
- Beware: there was a production incident from a duplicate `THEME_PRESETS` export (`themePresetsExtra.ts`). Keep exports unique.

## Data fetching

- Supabase client: `web/src/lib/supabase.ts` (`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`, storage key `sol-tools-auth`, has a placeholder fallback so missing env doesn't white-screen).
- Polling data: `useQuery` with `refetchInterval` + `staleTime` (see `web/src/components/Marquee.tsx` — 15s refetch / 10s stale). Query defaults are `retry: 2`, exponential backoff, 30s staleTime.
- Backend calls, in order of preference:
  1. Direct table reads/writes: `supabase.from("table")...` (RLS enforced).
  2. Supabase Edge Functions: `supabase.functions.invoke("name", { body })`.
  3. For AI functions from the browser, prefer the same-origin proxy `fetch("/ai-fn/<fn-name>", ...)` (Vercel rewrite to Supabase, dodges ad blockers) with `Authorization: Bearer <session token>` + `apikey` headers — see `web/src/pages/AlphaChat.tsx`.
  4. Vercel serverless: plain `fetch("/api/ogdex/...")`, `/api/pump-create`, `/api/vanity-mint`, etc.
- Loading/error/empty states: use `QueryLoading` / `QueryError` / `QueryEmpty` from `@/components/ui/QueryStates`, and `LoadingSkeleton` for glass skeletons.

## Conventions checklist

- Components: PascalCase in `web/src/components/`, feature subfolders (`layout/`, `admin/`, `spaces/`, `*-20x/`). shadcn primitives live only in `components/ui/`.
- Hooks: `useX.tsx` in `web/src/hooks/`. Helpers in `web/src/lib/`.
- Wrap risky subtrees in `ErrorBoundary` / `SafeZone`; chunk-load errors auto-reload via `main.tsx` (`vite:preloadError`).
- Tests: vitest, `web/src/test/`, `npm run test` in `web/`.
- Lint before finishing: `npm run lint` in `web/`.
