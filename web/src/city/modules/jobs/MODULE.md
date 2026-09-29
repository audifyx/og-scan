# OrbitXCity — Jobs Module

Unified job board + 11 playable jobs. Third-person open-world wage work:
paper CITY for gameplay, real ORBITX for premium (when tokenomics lands).

## Files

| File | What |
|---|---|
| `index.ts` | Module entry (pure TS, no JSX). `JOBS` registry, `getJob(id)`, re-exports `JobsModule`, wallet helpers. |
| `JobsModule.tsx` | React shell: floating 💼 button, job board sheet, active-job mount, global toast stack. |
| `types.ts` | `JobId`, `JobMeta`, `JobProps`, `Buff`, `Toast`. |
| `wallet.ts` | Paper-CITY ledger + XP + buffs + toast bus. localStorage singleton, no chain. |
| `world.ts` | World helpers: `getPlayer(api)` (null-safe snapshot via `world.getPlayerState()`), `useWorldPresence`, `useWorldTick` (rAF, additive), `randomNode/Sidewalk`, `dist2`, `districtAt`, `clampCity`. |
| `markers.ts` | Three.js props: beacons, peds, prop truck, text sprites, diamonds. All disposable. |
| `dining.ts` | Shared restaurant registry. Critic reviews shift foot traffic; player-owned restaurants + tips live here. |
| `JobChrome.tsx` | Job panel chrome: header, buff row, stats, disabled-until-billing `PremiumButton`. |
| `jobs.css` | All module styles, mobile-first (bottom sheet on mobile, floating card on desktop). |
| `TaxiJob.tsx` | Ferry fares: pickup beacon → passenger boards → drop-off. Tips beat the par time. |
| `TraderJob.tsx` | Paper trading on REAL DexScreener data via `web/src/hooks/useLivePrices` (long/short, 3 sizes, PnL → CITY). |
| `DetectiveJob.tsx` | Rug-investigation cases: 4 clue beacons → accuse from a lineup. Bounty scales with clues. |
| `RepoJob.tsx` | Hook a delinquent's car (6s proximity), tow it to the impound depot. Streak multiplier to 1.5×. |
| `PaparazziJob.tsx` | Snap roaming celebs (gold diamonds). Closer = richer shot; <10m = spotted, they flee. Sell rolls of 12. |
| `CriticJob.tsx` | Taste the menu on-site (8s), rate 1–5. Reviews publish to `dining.ts` and move real foot traffic. |
| `FoodTruckJob.tsx` | Buy up to 3 trucks (props in-world), park at hotspot beacons, customers walk up, collect the till, upgrade tiers, relocate. |
| `RestaurantJob.tsx` | Dine: order at orange beacons → meal buffs (pay ×/xp ×, rating-scaled). Own: pay $2,500, pick cuisine, collect tips (income follows `footTraffic`, so critic reviews matter). |
| `RealEstateJob.tsx` | Take a client (buyer ped follows you), present 3 homes, buyer picks a favorite → 3% commission. Price tags float over listings. |
| `InstructorJob.tsx` | 6-gate checkpoint course, graded S/A/B/C by time. |
| `LifeguardJob.tsx` | Patrol Luna Bay Boardwalk (water-disc prop). Drowning events: 25s window to reach the swimmer. |

## Design rules (follow these when extending)

- **Additive only.** Jobs read state via `world.ts`'s `getPlayer(api)` (null-safe wrapper over `world.getPlayerState()` — `GtaApi` does NOT expose `getPlayerState` directly) and add props to `world.sceneRef`. Never fight core for player/vehicle control. Never intercept input (`input.action` toggles enter/exit in core — don't steal it); all job interactions are proximity + panel buttons, which is also why everything works on mobile.
- **Dispose everything.** Every beacon/ped/prop/sprite created in a job must be disposed on unmount or phase change (see the `useEffect` cleanups). Leaked props = leaked draw calls.
- **Tick defensively.** `useWorldTick` wraps the callback in try/catch so a job can never crash the frame. Keep per-tick work O(small): proximity checks and ped walks only.
- **State through refs in ticks, React state for UI.** The rAF tick must not `setState` every frame — throttle UI syncs to ~500ms–1s intervals.
- **XP/pay scaling** lives in `wallet.ts`: 200 XP/level, +10% pay per level. Buffs multiply pay/XP.

## Economy

- **Paper CITY** (`wallet.ts`): all wages, tips, commissions, till income, meal costs. Local ledger, localStorage. This is gameplay money only — never on-chain, never custody.
- **Real ORBITX**: every job ships a `PremiumButton` (e.g. "Golden livery", "Real margin", "Jet ski"). These render **disabled** with "ORBITX soon" copy. This is deliberate, per `web/src/city/BILLING_CONTRACT.md`: the game never builds a parallel burn path. When `@/tokenomics/*` lands, one integration point (`web/src/city/economy.ts` per the contract) wires them up.
- **NEVER import `@/tokenomics/*`** — the directory doesn't exist yet and would break the build.
- **No cross-module imports.** Jobs import only from `../../core`, `web/src/hooks/useLivePrices` (trader), React, and three. Nothing from `modules/*`.

## Assumptions & known limits

- **2026-09-29 fix:** all job files previously called `api.getPlayerState()`, which does not exist on `GtaApi` (verified against `core/useGtaGame.ts`) — it would have thrown at runtime. All 12 call sites now go through `world.ts`'s null-safe `getPlayer(api)` (= `api.getWorld()?.getPlayerState()`). Verified: `core/World.ts` `getPlayerState()` returns `{ onFoot, pos: Vector3, heading, speed, speedKmh, dayT, isNight }`, and every sibling module (`heists`, `racing`, `character`) reads it via `world.getPlayerState()`.
- `world.ts` is the only file importing `GtaApi`/`GTAWorld` types for player state; job components use the `PlayerSnap` type if they need it.

- The world has **no beach/water geometry** (checked `CityBuilder.ts`); lifeguard uses a translucent blue disc prop at `x = HALF - 70` labeled "Luna Bay Boardwalk".
- `useLivePrices` (DexScreener) is the trader's real-data source; if the feed is down, the job waits (`connected` flag) rather than fabricating prices.
- Premium prices are unset — no amounts are shown on premium buttons until billing lands, so nothing promises a price we can't charge.
- `index.ts` is intentionally JSX-free: Vite's esbuild only parses JSX in `.tsx` files. The React shell is `JobsModule.tsx`.
- `JobChrome`'s `PremiumButton` uses `JSX.Element` return type, matching the existing codebase convention.
- Integrator mounts `<JobsModule api={api} />` once in the GTA screen; the module manages its own button/board/panel/toasts. `data-hud` on the FAB keeps core's orbit-drag from swallowing taps.
