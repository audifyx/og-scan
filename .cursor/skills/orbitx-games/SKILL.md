---
name: orbitx-games
description: Use when building games, prediction markets, leaderboards, achievements, XP, or gamification in this repo. Covers the current partner-iframe integration (Games.tsx, Hub tiles), the real in-repo gamification primitives (profiles XP leaderboards, achievement RPC sync, badges), and the house-style blueprint for building NATIVE games (canvas loop, Supabase realtime, commit-reveal fairness, escrow via edge functions) since none exist natively yet.
---

# OrbitX Games, Predictions & Gamification

**Ground truth first**: despite the marketing copy ("provably-fair 1v1 games", "Coinflip, Dice, Crash, Plinko"), there are **no native games or prediction markets in this repo**. They are Roadmap Phase 6 ("planned" in `web/ogdex/src/pages/Roadmap.tsx`). Today, gaming = external partner apps embedded via iframe. Don't claim otherwise, and don't go hunting for game modules that don't exist. Note: `web/ogdex/src/lib/predict.ts` / `PredictiveIntel.tsx` are token survival heuristics, not betting markets, and DiceBear usages are avatars, not dice games.

## Current pattern: partner embeds

- `web/src/pages/Games.tsx` — browser-chrome shell with a `PARTNERSHIPS` array (`degen-tower` → degen-tower.vercel.app, `orbitx-prediction` → orbitx-prediction.fun). Tab state swaps the `iframe.src` (keyed remount), with loading/error states and `sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-top-navigation allow-popups-to-escape-sandbox"`, `allow="clipboard-write; clipboard-read; accelerometer; autoplay"`, `style={{colorScheme:"dark"}}`.
- `web/src/pages/Hub.tsx` `ALL_APPS` — external tiles (Predictions → solno.fun, Gaming → Degen Tower) with `external: true`.
- To add a partner game: append to `PARTNERSHIPS` and/or add a Hub tile. That's the whole integration.

## Real gamification primitives (reuse these)

- **Leaderboards** = ordered Supabase queries, no special infra. Template (`web/src/pages/Leaderboard.tsx`): `supabase.from("profiles").select(...).order("total_xp", {ascending:false, nullsFirst:false}).limit(100)` inside `useQuery`. Other examples: `components/leaderboard-20x/PlatformLeaderboard.tsx`, `pages/orbitx/LaunchpadLeaderboard.tsx`, `referral_leaderboard` view, and the `grim_leaderboard()` SQL function (`supabase/migrations/20260621194000_grim_leaderboard.sql`) for aggregations that belong in the DB.
- **Achievements**: client derives unlock flags from stats, server persists via RPC. Pattern from `web/src/lib/orbitx/registry.ts`: `supabase.rpc("orbitx_sync_achievements", {p_wallet})` returns newly unlocked ids; history read from `orbitx_achievements`. UI definitions co-locate `{id, label, icon, unlocked}` in a `useMemo` (see `LaunchpadProfile.tsx`). Lightweight badge variants can be pure-UI (`components/spaces/SpaceBadges.tsx` — derived from props, no persistence).
- **XP/streaks/reputation** live as columns on `profiles` (`xp`, `total_xp`, `current_level`, `daily_streak`, `reputation_score`) plus `user_badges`/`badges` tables.

## Blueprint for a NATIVE game (greenfield, follow house conventions)

When asked to build a real game (coinflip, dice, crash, plinko, 1v1), there's no prior art to copy — compose it from the repo's existing patterns:

1. **Rendering**: DOM + CSS animations for card/board games; `<canvas>` + `requestAnimationFrame` for crash/plinko-style physics. No game engine deps, no framer-motion (matches the frontend skill). Lazy-load the page with `lazyWithRetry` and style with the glass design system (`glass-card`, og-lime/cyan/gold, mono labels).
2. **State & realtime**: game rooms as Supabase tables + [Supabase Realtime channels](https://supabase.com/docs/guides/realtime) for 1v1 sync (the repo already uses Supabase everywhere; LiveKit is reserved for voice/video Spaces).
3. **Fairness (commit-reveal)**: server generates `serverSeed`, stores `sha256(serverSeed)` in the round row *before* bets; client supplies `clientSeed`; outcome = `HMAC-SHA256(serverSeed, clientSeed + ":" + nonce)`; reveal `serverSeed` after settlement so players can verify the pre-committed hash. All of this belongs in an edge function using the standard anatomy from the `orbitx-backend` skill (service-role writes, `{ok}/{error}` responses).
4. **Wagers/escrow**: non-custodial is the house principle — the platform never holds keys. For real-money wagers, settlement must be user-signed transactions (see the Jupiter/pump patterns in `orbitx-web3`) or an on-chain escrow program; for soft-currency games, debit/credit an XP or points column on `profiles` via a `security definer` RPC so clients can't self-credit.
5. **Schema**: new migration per the backend skill — e.g. `game_rounds` (id, game, server_seed_hash, server_seed, client_seed, nonce, outcome, status, timestamps), `game_bets` (round_id, user_id, amount, choice, payout) — RLS: public read on rounds, owner-only on bets, settlement via service role only.
6. **Leaderboard/achievements hookup**: reuse the primitives above — write results into `profiles` XP and a game stats table, add an `orbitx_sync_achievements`-style RPC for unlocks.
7. **Registration**: add the route in `App.tsx`, a Hub tile in `Hub.tsx` (internal `href`, not `external`), and optionally a `Games.tsx` tab.

## Prediction markets blueprint

Also greenfield. If asked: `markets` (question, closes_at, resolved_outcome, oracle source), `positions` (user_id, market_id, side, stake), settlement RPC with `security definer`. Resolution data can come from the ogdex intel stack (`/api/ogdex/token`, ATH/price routes) since "wired into OrbitX insights" is the product intent. Follow the same fairness/escrow rules as games.
