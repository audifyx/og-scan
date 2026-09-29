# OrbitXCity — Events Module (MODULE.md)

**Team:** Events module · **Area:** `web/src/city/modules/events/**` (exclusive)

The unified server/city event system: market-driven world events fired from
REAL price data, scheduled server-wide airdrops, and persistent nighttime
features. GTA 6 vibes, realistic (not blocky). No imports from other modules;
NOTHING imports `@/tokenomics/*` (that directory does not exist yet — see
Integration).

## What was built

| # | Idea | Status | Notes |
|---|------|--------|-------|
| 1 | Server-wide airdrop crates | **BUILT** | `scenes/airdropCrates.ts` — cargo plane flyover, parachuted crates at 3 drop zones, tiered loot rolls (`common`→`legendary`, `rollCrateLoot(seed, i)` is deterministic-ish), proximity claim via `AirdropHandle.claimCrate`, paper-CITY payouts + rare cosmetic drops. Auto-scheduled every 45 min by `EventsSystem` (first drop ~90s after boot). |
| 2 | Earthquake event (major token crash → city shakes) | **BUILT** | `scenes/earthquake.ts` — fires ONLY when a watched major crashes ≥20%/24h in real data. Warning rumble → magnitude-shaped main shock (3–10) → aftershocks with dust. Camera shake goes through `host.shakeCamera` (core keeps camera authority); core never touched directly. |
| 3 | Fireworks over the bay (ORBITX price milestones) | **BUILT** | `scenes/fireworks.ts` — fired once per milestone when real ORBITX price crosses up through configured tiers (`[0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]`). Barge-launched rockets, 5 shell types (peony/ring/willow/strobe), grand finale, per-milestone session memory so nothing double-fires. |
| 4 | Weather machine (turf-war winners trigger weather) | **BUILT** | `scenes/weatherMachine.ts` + `ui/WeatherPanel.tsx` — 6 states (clear/rain/storm/fog/heat/neon) with scene application (fog, rain particles, lightning, neon ambient) and 20s blends. ONLY the integrator-named firm controls it (`canControlWeather` enforces firm membership, never trust the UI), 30-min change cooldown, 10-min hold then drift back to clear. |
| 5 | Parades (trading volume goals) | **BUILT** | `scenes/parade.ts` + `triggers.ts#evaluateParadeTrigger` — fired when the community's REAL 24h volume crosses a goal tier (100K/500K/1M/5M USD, once per tier per session). 4 themed floats + flanked marchers roll the integrator-supplied waypoint route. |
| 6 | Protest marches (NPCs protest rugged token HQs) | **BUILT** | `scenes/protests.ts` — crowds with canvas-texture protest signs ring the HQ of rugged/crashed/scam tokens from the integrator's real registry. Player choice: JOIN (paper-CITY solidarity payout, crowd swells) or COUNTER (rival crowd, 55% noise-war gamble). Choice reported via `EventsContext.onProtestChoice`; reputation effects are the integrator's. |
| 7 | Night markets (rare cosmetics) | **BUILT** | `scenes/nightMarket.ts` — pop-up stall rows at 3 rotating plaza spots after dark, 8-item catalog (rare/epic/legendary), day-of-week stock rotation. CITY items debit paper wallet; ORBITX items burn via billing. |
| 8 | Dock black market (rare gadgets, nights only) | **BUILT** | `scenes/blackMarket.ts` — container-yard scene at Pier 9, nights only, 6 rare gadgets with gameplay effects (integrator applies effects; module defines catalog + access rules). Nightly rotating code word (`tonightCode`), wrong code = no entry. Same defensive billing as the night market. |

All market-driven events run off REAL data only — `triggers.ts` consumes a
`MarketSnapshot` whose shape is identical to the value objects from
`web/src/hooks/useLivePrices.ts` (DexScreener-backed). Verified field-for-field
against the hook source: `price`, `priceChange24h`, `volume24h`, `liquidity`,
`marketCap`, `lastUpdated`. Stale quotes (>5 min) are ignored; empty snapshot
→ no triggers fire. This module fabricates no prices, volumes, or crashes.

## Public API (`index.ts`)

- `EventsSystem` / `createEventsSystem(ctx, opts)` — the unified runtime.
  Integrator constructs ONCE. `update(dt)` called from the render loop;
  `pollMarket(snapshot)` / `pollVolume(volume)` / `pollRuggedHqs()` fed with
  real data; `startAirdrop`, `announceRug`, `claimNearbyCrate`,
  `joinProtest`/`counterProtest`, `trySetWeather`, `getSnapshot()`,
  `getPurchaseContext()`, `checkMarketCode`.
- `CityEventDirector` — timed-event lifecycle (start/stack/expire/notify),
  server-shaped so a multiplayer transport can be swapped in later.
- `evaluateMarketTriggers` / `evaluateParadeTrigger` / `createTriggerMemory`
  / `DEFAULT_TRIGGER_CONFIG` / `DEFAULT_PARADE_GOALS` — pure trigger logic.
- Scenes: `startAirdropRun` (+`rollCrateLoot`), `startEarthquake` (+`quakeLabel`),
  `startFireworks` (+`fireworksCopy`), `startParade` (+`paradeCopy`),
  `startProtest`, `startNightMarket` (+`tonightSpot`, `tonightStock`,
  `buyMarketItem`, `NIGHT_MARKET_CATALOG`, `NIGHT_MARKET_SPOTS`),
  `startBlackMarket` (+`buyBlackMarketItem`, `BLACK_MARKET_CATALOG`,
  `BLACK_MARKET_DOCK`, `tonightCode`, `checkCode`, `isBlackMarketOpen`),
  `startWeatherController` (+`WEATHER_INFO`, `WEATHER_DURATION_MS`,
  `WEATHER_COOLDOWN_MS`, `canControlWeather`).
- UI: `EventHud` (`hud` mount), `MarketPanel` (`marketPanels` mount),
  `WeatherPanel` (`weatherPanel` mount), `useEventsSnapshot`.

Only external deps: `three`, `react`. UI has inline styles (no global CSS).
Mobile-first: 48px+ touch targets, `dvh` units, safe-area insets.

## Integration points — exact needs from core

1. **Construct once the world exists.** Implement `EventsSceneHost`:
   `scene`, `camera`, `getPlayerPosition(out)`, `shakeCamera(intensity, durationMs)`,
   `playSound(name, volume?)`, `isNight` (from core's day/night clock),
   `worldHalfSpan` (from `core`'s `HALF`). Then:
   ```tsx
   import { createEventsSystem } from "@/city/modules/events";
   const events = createEventsSystem({ host, wallet, billing, weatherFirmId, playerInWeatherFirm, communityVolume24h, ruggedHqs, onReward, onProtestChoice });
   // render loop: events.update(dt);
   ```
2. **Feed real data.** On each `useLivePrices` poll:
   `events.pollMarket(prices)` (pass the hook's `LivePriceMap` straight in —
   same shape). On volume updates: `events.pollVolume(realVolume)`. On rugged
   registry updates: `events.pollRuggedHqs()`.
3. **Wire optional route data.** `paradeRoute` (waypoints from core road data),
   `fireworksBarges` (bay anchor points), `airdropIntervalMs` /
   `airdropCrateCount` for scheduling.
4. **Mount UI.** `EventHud` inside the HUD layer (`pointer-events-none` wrapper),
   `onOpenMarket` → render `MarketPanel mode="night"|"black"`, weather chip /
   HQ UI → render `WeatherPanel`.

## Assumptions about not-yet-existing shared code (marked per instructions)

- **`@/tokenomics/*` DOES NOT EXIST YET — HARD RULE honored:** zero imports of
  `@/tokenomics/*` anywhere in this module (verified). Instead the module
  declares `OrbitxBillingProvider` in `types.ts`, mirroring
  `web/src/city/BILLING_CONTRACT.md` exactly:
  ```ts
  interface OrbitxBillingProvider {
    ready: boolean;
    balance: number | null;
    spend: (opts: { amount: number; reason: string; ref?: string }) =>
      Promise<{ signature: string }>;
    beginAuth: () => void;
  }
  ```
- **Integrator wiring once tokenomics lands** (one line, in the page shell):
  ```tsx
  import { useOrbitxBilling } from "@/tokenomics/useOrbitxBilling";
  const billing = useOrbitxBilling(); // matches OrbitxBillingProvider
  createEventsSystem({ ..., billing });
  ```
- Until then: ORBITX-priced items (night/black market premium rows) render an
  honest "wallet auth required" state; BUY buttons disabled, never broken.
  Per BILLING_CONTRACT rule #20, every ORBITX spend calls `billing.spend`
  with a `city-bank:<itemId>` reason — i.e. backend-signed burns, no popups.
- **Paper-CITY wallet:** `EventsWallet` in `types.ts` matches the economy
  module's paper wallet contract (`earn`/`spend`/`getBalance`). If `null`,
  crate claims and protest payouts degrade gracefully (rewards returned via
  `onReward`, never fabricated on-chain). The integrator may inject the
  economy module's `paperWallet` directly.
- **Market data shape:** `MarketQuote`/`MarketSnapshot` in `types.ts` are
  field-for-field identical to `useLivePrices`'s `LivePrice`/`LivePriceMap`
  (verified 2026-09-29). If the hook ever renames fields, the trigger
  evaluator is the only thing that needs a mapping shim.
- **Weather control data:** `weatherFirmId` (turf-war winner) and
  `playerInWeatherFirm` are integrator-supplied; with no winner the panel
  says so honestly and all buttons hide behind `controlReason`.
- **Rugged HQs:** `ruggedHqs` comes from a real registry the integrator owns;
  positions are world coords from core's city grid. Protests never invent HQs.
- **Night flag:** `host.isNight` comes from core's day/night cycle; markets
  pack up at dawn automatically.

## Assumptions / caveats

- `protests.ts` uses `document.createElement("canvas")` for sign textures —
  fine in the browser game, but scenes are not SSR-safe.
- `blackMarket.ts` container rotation table is a hardcoded per-index array;
  keep index/count in sync if adding stacks.
- Black-market gadget *effects* (EMP jammer, grapple, …) are catalog copy only;
  the integrator applies gameplay effects on purchase via `onReward`.
- Quake magnitudes 3–10 derive from crash depth (−20% threshold … −80% cap);
  cooldown 30 min per token; director-level 5-min same-kind cooldown and
  3 concurrent-event cap sit on top.
- Scheduled airdrops are time-based, not market-driven (by design — they are
  a city heartbeat, not a market reaction).

## Files

- `index.ts` — public API
- `MODULE.md` — this file
- `types.ts` — `EventsSceneHost`, `EventsContext`, `EventsWallet`, `OrbitxBillingProvider`, payloads, UI mounts
- `system.ts` — `EventsSystem` (unified runtime) + `EventsSnapshot`
- `eventDirector.ts` — `CityEventDirector` (server-shaped lifecycle)
- `triggers.ts` — real-data trigger evaluation
- `scenes/airdropCrates.ts` · `scenes/earthquake.ts` · `scenes/fireworks.ts` ·
  `scenes/parade.ts` · `scenes/protests.ts` · `scenes/nightMarket.ts` ·
  `scenes/blackMarket.ts` · `scenes/weatherMachine.ts`
- `ui/EventHud.tsx` · `ui/MarketPanel.tsx` · `ui/WeatherPanel.tsx` ·
  `ui/useEventsSnapshot.ts`
