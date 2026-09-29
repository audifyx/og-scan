# OrbitXCity — Seasons Module (MODULE.md)

**Team:** Seasons module · **Area:** `web/src/city/modules/seasons/**` (exclusive)

Battle pass + seasonal event framework. Tiered reward track (free + premium)
paying **paper ORBITX** (local ledger, no chain); premium entry burns **real
ORBITX** backend-signed, auth-once, no popups. No staking. Game never custodies
keys or funds.

## What was built

| # | Idea | Status | Notes |
|---|------|--------|-------|
| 1 | Season pass — tiered reward track with paper-ORBITX rewards | **BUILT** | 20 tiers × 250 XP. Free: `5×tier` paper ORBITX per tier. Premium: `15×tier` paper ORBITX + cosmetics at tiers 5/10/15/20 (Neon Trail vehicle, Chrome Rider Jacket, Holo License Plate, Season 1 Crown Car Wrap — display-only). `data/seasons.ts`, `store/seasonStore.ts`. |
| 2 | Premium track entry via real ORBITX burn | **BUILT (defensive)** | `useSeasonBilling()` mirrors `BILLING_CONTRACT.md` exactly (`SeasonBillingProvider` in `types.ts`). Auth-once → backend-signed `spend({ amount, reason: "city:season-pass:<seasonId>" })`. No provider yet → button renders auth-required / coming-soon state; free track fully works. NO staking. |
| 3 | Season timer | **BUILT** | Live 1s countdown in `SeasonPassPanel` from fixed UTC season windows (`formatCountdown`); upcoming/active/ended states with notices. |
| 4 | Tier progression | **BUILT** | `seasonStore.addXp(amount, source)` — runs through plugin XP multipliers, computes tier-ups, dispatches `xp:gain` + `tier:up` events. No-op when no season is active. |
| 5 | Reward claims | **BUILT** | `seasonStore.claimReward(tier, track)` — credits paper ORBITX to the local ledger, records claim keys (`f<tier>` / `p<tier>`), dispatches `reward:claim`. Claims gated by tier reached + premium unlocked. |
| 6 | Seasonal event framework — themed content hooks other modules can plug into | **BUILT** | `eventFramework.ts`: plugin registry, event dispatch, XP-multiplier product, 1s ticker, season-transition watcher. Sample plugin `doubleXpWeekend` (2× XP Sat/Sun UTC) registered by default to prove it works. |
| 7 | Paper-ORBITX ledger | **BUILT** | localStorage (`orbitxcity:seasons:v1`), balance + 200-entry history, `usePaperOrbitxHistory()` hook, `formatPaperOrbitx()`. Balance **carries over** season rollovers (persistent wallet); pass progress resets. |
| 8 | Season pass hub UI + Event Board | **BUILT** | `SeasonPassPanel` (timer, XP progress bar, free/premium track grid, premium entry, cosmetics shelf) + `EventBoard` (live plugin cards with countdowns). Scoped `ox-sea-*` styles in `seasons.css`, mobile-friendly. |

## Public API (`index.ts`)

- `SeasonPassPanel({ billing?, onClose? })` — single mount point, full-screen HUD overlay. `SEASONS_PANEL_ID = "seasons"`.
- `EventBoard` — standalone seasonal-event card list (also rendered inside the panel).
- `seasonStore` — external store: `addXp(amount, source)`, `canClaim(tier, track)`, `claimReward(tier, track)`, `unlockPremium(signature)`, `grantPaperOrbitx(amount, reason)`, `getSnapshot()`, `getPaperHistory()`, `resetProgress()` (dev). `useSeasonStore()`, `usePaperOrbitxHistory()`, `formatPaperOrbitx(n)`.
- `useSeasonBilling(provider?)` — defensive billing adapter; type `SeasonBilling`.
- Framework: `registerSeasonalPlugin`, `unregisterSeasonalPlugin`, `listSeasonalPlugins`, `dispatchSeasonalEvent`, `emitSeasonalCustom`, `currentXpMultiplier`, `startSeasonalTicker`, `stopSeasonalTicker`, `checkSeasonTransitions`, `getSeasonalContext`.
- Data: `SEASONS`, `XP_PER_TIER` (250), `MAX_TIERS` (20), `PREMIUM_ENTRY_COST_ORBITX` (25), `getSeasonById`, `getSeasonInfo`, `tierForXp`, `formatCountdown`.
- Types: `RewardTrack`, `PaperOrbitxReward`, `SeasonTier`, `Season`, `SeasonInfo`, `SeasonStatus`, `SeasonProgress`, `PaperOrbitxEntry`, `SeasonBillingProvider`, `SeasonalEventType`, `SeasonalEventPayload`, `SeasonalEventCard`, `SeasonalEventContext`, `SeasonalEventPlugin`.

Only external dep: `react`. Self-contained styles in `seasons.css`.

## Integration points — exact needs from core

1. **Mount:** when the core HUD panel `"seasons"` opens, render
   `<SeasonPassPanel billing={billing} onClose={closePanel} />` with the
   tokenomics provider injected (see below). Suggested:
   ```tsx
   import { SeasonPassPanel, SEASONS_PANEL_ID } from "@/city/modules/seasons";
   // add SEASONS_PANEL_ID to the HudPanel set; when active:
   {panel === SEASONS_PANEL_ID && <SeasonPassPanel billing={billing} onClose={() => openPanel(null)} />}
   ```
2. **Season XP from gameplay:** any module (or core) credits pass XP directly —
   imports flow from other modules *into* seasons, never the reverse:
   ```ts
   import { seasonStore } from "@/city/modules/seasons";
   seasonStore.addXp(50, "jobs:delivery-complete"); // flows through plugin multipliers; no-op off-season
   ```
3. **Paper-ORBITX grants outside the pass** (event bonuses, plugin rewards):
   ```ts
   seasonStore.grantPaperOrbitx(100, "Neon Nights scavenger hunt");
   ```
4. **Themed seasonal content:** see the plugin interface below. Register a
   plugin; it receives season lifecycle hooks + an Event Board card, with zero
   access to this module's internals beyond the provided context.
5. **Ticker:** `SeasonPassPanel` starts/stops the 1s `onTick` ticker on mount.
   If the host wants events ticking while the panel is closed, call
   `startSeasonalTicker()` once at app boot instead (idempotent).

## Plugin interface (for other module teams)

A plugin is a plain object implementing `SeasonalEventPlugin`. Register it:

```ts
import { registerSeasonalPlugin } from "@/city/modules/seasons";

registerSeasonalPlugin({
  id: "neon-nights",                    // unique; re-registering replaces
  name: "Neon Nights",
  description: "Double paper ORBITX on race wins, 20:00–04:00 local.",
  xpMultiplier: (ctx) => isNight() ? 2 : 1,        // product of ALL plugins' multipliers
  onSeasonStart: (ctx) => { /* seed themed content */ },
  onSeasonEnd: (ctx) => { /* tear themed content down */ },
  onTierUp: (ctx, tier, track) => { /* react to player tier-ups */ },
  onXpGain: (ctx, amount, source) => { /* post-multiplier, post-tier XP */ },
  onRewardClaim: (ctx, tier, track) => { /* a tier reward was claimed */ },
  onTick: (ctx, now) => { /* ~1/sec while the framework ticker runs */ },
  onCustom: (ctx, name, data) => { /* events from ctx.emit("name", …) */ },
  eventCard: (ctx, now) => ({                        // Event Board card, or null to hide
    pluginId: "neon-nights",
    title: "Neon Nights",
    description: "Live now — 2× race payouts after dark.",
    active: isNight(),
    endsAt: dawnMs,                                   // optional countdown target (epoch ms)
    accent: "#00ffd1",                                // optional CSS color
  }),
});
```

**What the framework dispatches** (`SeasonalEventType`):
`season:start`, `season:end` (auto-detected by `checkSeasonTransitions` when
the active season id changes), `tier:up` (once per track — free, and premium
if unlocked), `xp:gain`, `reward:claim`, `tick` (~1/sec), and
`custom:<name>` for anything a plugin emits via `ctx.emit("name", data)`.

**The context** (`SeasonalEventContext`) is the only handle plugins get:
`season` (current season def), `grantXp(amount, source)` (goes through
multipliers), `grantPaperOrbitx(amount, reason)` (local ledger),
`progress()` (pass snapshot), `emit(name, data)` (broadcast to all plugins).

**Plugin rules (enforced by the framework):**
- Plugins never touch the DOM, the scene, or other modules' state — all writes
  go through `ctx`. A plugin that throws is caught and skipped; it can never
  break the game loop or the Event Board.
- Plugins live in `plugins/` in this module or are registered at runtime by
  other modules; registration order = dispatch order. Unregister with
  `unregisterSeasonalPlugin(id)` (e.g. to replace the bundled sample).
- XP multipliers multiply together (product across all plugins), so keep them
  modest (the bundled sample uses 2×).
- The framework works even if the host never mounts `SeasonPassPanel` — the
  store installs the context factory at import time. Without the panel/ticker,
  only `onTick`/`tick` won't fire.

## Assumptions about not-yet-existing shared code (marked per instructions)

- **`@/tokenomics/useOrbitxBilling` DOES NOT EXIST YET — HARD RULE honored:**
  nothing in this module imports `@/tokenomics/*` (it would break the
  production build). Verified: only `web/src/tokenomics/constants.ts` exists;
  no billing hook.
- **Expected interface** (mirrors `web/src/city/BILLING_CONTRACT.md` exactly),
  documented as `SeasonBillingProvider` in `types.ts`:
  ```ts
  interface SeasonBillingProvider {
    ready: boolean;                    // auth-once complete, backend spendable
    balance: number | null;            // on-chain ORBITX
    spend: (opts: { amount: number; reason: string; ref?: string }) =>
      Promise<{ signature: string }>;  // backend-signed burn tx
    beginAuth: () => void;             // kicks the dashboard auth-code flow
  }
  ```
- **Integrator wiring once tokenomics lands** (one line, in the page shell):
  ```tsx
  import { useOrbitxBilling } from "@/tokenomics/useOrbitxBilling";
  const billing = useOrbitxBilling(); // matches SeasonBillingProvider
  <SeasonPassPanel billing={billing} onClose={...} />
  ```
- Until then: `useSeasonBilling()` with no provider returns `ready: false`,
  `balance: null`, `providerConnected: false`; the premium-entry button shows
  the "🔒 Premium entry opens after the one-time wallet auth" state. All free
  track progress, claims, paper ledger, and seasonal events work regardless.
- Billing rules honored: auth once up front → seamless backend-signed burn
  (`spend` with `reason: "city:season-pass:<seasonId>"`, whole ORBITX, no
  wallet popups); game never custodies keys; **no staking anywhere**.

## Assumptions / caveats

- Clock = device clock; season windows are fixed UTC epochs. Season 1
  ("Neon Genesis", neon theme) runs **2026-09-29 → 2026-10-29 UTC** and is the
  only season in the catalog — upcoming/ended UI states are handled but only
  exercisable once Season 2 is added to `data/seasons.ts`.
- Season rollover (new active season at module init): pass progress resets
  (XP, claims, premium unlock); paper-ORBITX balance + history carry over as a
  persistent wallet.
- XP grants no-op while no season is active (`getSeasonInfo().status !== "active"`).
- Premium entry amount is floored to whole ORBITX per the billing contract.
- Cosmetics (premium tiers 5/10/15/20) are display-only labels today; other
  modules can honor them by reading `progress.claimed` (`p5`, `p10`, …) and
  applying vehicle/outfit effects.
- Paper ledger lives in localStorage (per-device); server-side persistence is
  out of scope for this module.
- The bundled `doubleXpWeekend` sample plugin stays registered by default so
  the framework demonstrably does something; the integrator can
  `unregisterSeasonalPlugin("double-xp-weekend")` or keep it.

## Files

- `index.ts` — public API (registers the sample plugin on import)
- `types.ts` — season domain + `SeasonBillingProvider` + plugin interface
- `data/seasons.ts` — season catalog (Season 1), tier math, countdown formatter
- `store/seasonStore.ts` — pass progress store + paper-ORBITX ledger
- `billing.ts` — `useSeasonBilling()` defensive billing adapter
- `eventFramework.ts` — plugin registry, dispatch, multipliers, ticker, season-transition watcher
- `plugins/doubleXpWeekend.ts` — bundled sample plugin (2× XP Sat/Sun UTC)
- `components/SeasonPassPanel.tsx` — season-pass hub UI
- `components/EventBoard.tsx` — seasonal event cards UI
- `seasons.css` — scoped styles (`ox-sea-*`)
- `MODULE.md` — this file
