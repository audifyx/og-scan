# OrbitXCity — Sports Module (MODULE.md)

**Team:** Sports module · **Area:** `web/src/city/modules/sports/**` (exclusive)

GTA-style sports activities for the open world: skate park, skate sponsors,
parkour time trials, base jumping, wingsuit gliding, gym fight tournaments,
dojo (fighting styles), surfing, golf (paper wagers), and pier fishing.
Third-person, realistic (not blocky), mobile-friendly. All gameplay earnings
are **paper CITY** (local ledger, never on-chain); premium upsells burn
**real ORBITX** via the backend once the tokenomics primitives land — until
then the module degrades gracefully to paper-only mode with "auth required"
UI states. The game never custodies keys or funds.

## What was built

| # | Idea | Status | Notes |
|---|------|--------|-------|
| 1 | Skate park — tricks → style → paper | **BUILT** | `skate/SkatePark.ts`: plaza with quarter pipes, rails, funbox, bowl. Ollie/flip tricks (1–4), grinds on rails, combo multiplier, bail physics. Style cashes to paper at session end (`cashStyle`). Sponsor deck equipped → +10% style. |
| 2 | Skate sponsors | **BUILT** | `skate/Sponsors.ts`: 4 brands (ORBITX Decks, NEON Wheels, VANTA Trucks, PIXEL Grip), rookie/flow/pro tiers, challenge tracker that listens to the style bus persistently (progresses even when the Sponsors sim is idle). PRO contract is real-ORBITX premium, billing-gated. |
| 3 | Parkour time trials | **BUILT** | `parkour/Parkour.ts`: 6-rooftop course from `parkourStart[0]`, checkpoint rings, par 75s, medal payouts (gold 120 / silver 70 / bronze 35 paper). Falls respawn at last checkpoint, clock keeps running. |
| 4 | Base jumping | **BUILT** | `air/BaseJump.ts`: leap off the OrbitX Tower, freefall tricks (Space deploy), steerable canopy, flare landing. Precision landing in the gold zone multiplies style (x3 bullseye / x2 zone). Pull too late = splat. |
| 5 | Wingsuit gliding | **BUILT** | `air/Wingsuit.ts`: launch off the tower, thread 8 neon rings between buildings, dive/flare flight model, clean-touchdown bonus, +200 perfect-run bonus. |
| 6 | Gym fight tournaments (bracket PvP) | **BUILT** | `combat/Tournament.ts` + `combat/Fighter.ts`: 8-fighter single-elim bracket; player's bouts are real-time duels (jab/heavy/block/dodge, stamina, AI that closes distance, blocks, dodges), other matches simulated skill-weighted. 20 paper entry, round prizes 40/110/300. Multiplayer-ready: AI entrants can be swapped for remote fighters later. Golden Bracket (2x prizes) is real-ORBITX premium, billing-gated. |
| 7 | Dojo (fighting styles) | **BUILT** | `combat/Dojo.ts`: 6 styles (Street, Boxing, Karate, Muay Thai, Judo, Shadow Fist), pad-timing + bag-sparring drills, per-style mastery 0–100 persisted locally, mastery → tournament stat bonus via `masteryBonus()`. Shadow Fist is real-ORBITX premium unlock, billing-gated. |
| 8 | Surfing minigame | **BUILT** | `surf/Surf.ts`: paddle out, pop up on incoming waves (Space), ride the pocket (↑/↓), carve (←/→), tricks 2/3/4 (Cutback/Floater/Aerial 360) with wipeout risk, wave dies at shore. Style → paper. Pro Board (real ORBITX, burned): +25% style, steadier tricks, persisted in localStorage. |
| 9 | Golf course (paper wagers) | **BUILT** | `golf/Golf.ts`: 3-hole course (par 3/4/5), aim + hold-Space power meter + release-timing accuracy needle, ballistic/bounce/roll ball physics, bunkers/pond/rough/out-of-bounds penalties. Per-hole paper wager (10/25/50/100); payouts: eagle 4x, birdie 3x, par 2x, bogey 1x. Champion tee time (real ORBITX, burned) doubles all payouts this round. |
| 10 | Fishing at the pier (rare catches sell for paper) | **BUILT** | `fishing/Fishing.ts`: hold-Space cast distance (12–42m), bite window → hook → tension-management fight (reel with ↑, keep tension 30–80, fish runs). Rarity rolls scale with cast depth: junk/common/uncommon/rare/epic/legendary (Golden Koi = 400 paper). Catches auto-sell; first-of-rarity trophies persist locally. |

## Public API (`index.ts`)

- **Factory:** `createSports(anchors?)` → `SportsManager` with all 10 sims
  registered + the persistent sponsor tracker wired. `mountSports` is an alias.
- **Manager:** `SportsManager` (`mount(ctx)`, `unmount()`, `start(id)`,
  `stop()`, `update(dt)`, `distanceTo(id)`, `bus`, `ledger`, `venues`, `active`).
- **Events (HUD):** `SportsBus` emits `paper`, `style`, `activity`,
  `toast`, `tick` — the integrator's HUD subscribes once and renders.
- **Economy:** `PaperLedger` (localStorage-persisted paper CITY; `earn`,
  `spend`, `cashStyle`), `STYLE_TO_PAPER_RATE = 12`.
- **Billing:** `premiumBilling` (`available`, `balance`, `spend`),
  `PREMIUM_CATALOG` (sponsor PRO 5 / golden bracket 3 / shadow fist 8 /
  pro board 2 / champion tee 4 ORBITX).
- **Combat engine:** `Duel`, `Combatant`, `resolveStrike`, `aiDecide`,
  `simulateAiFight`, `buildAiOpponents`, `FIGHT_STYLES`, `masteryBonus`,
  `getPlayerFighterSpec`, dojo persistence (`loadDojoState`/`saveDojoState`).
- **Sponsors:** `getSponsorTracker`, `SPONSOR_BRANDS`, `SPONSOR_CHALLENGES`.
- **Sim classes:** `SkatePark`, `Sponsors`, `Parkour`, `BaseJump`, `Wingsuit`,
  `Tournament`, `Dojo`, `Surf`, `Golf`, `Fishing` — each exposes its own
  HUD-action methods (e.g. `enterBracket()`, `buyGoldenBracket()`,
  `selectStyle()`, `setWager()`, `buyProBoard()`, `signBrand()`).
- **Types:** `SportId` (the 10 ids), `SportInput`, `SportsContext`,
  `SportsEvent`, `SportSim`, `SportMeta`, `VenueAnchors`, `PremiumResult`.

No imports from other modules. Only external deps: `three`, `react` (types).

## Integration points — exact needs from core

The integrator provides a `SportsContext` (see `types.ts`; it maps 1:1 onto
the real core API in `web/src/city/core/`):

| Context field | Core source | Used for |
|---|---|---|
| `scene` | `world.sceneRef` | adding venue props + sim athletes |
| `camera` | integrator-supplied passthrough | sims take it over while active, hand back on stop |
| `getPlayerState()` | `world.getPlayerState()` | proximity prompts via `distanceTo(id)` |
| `teleport(x, z, heading)` | `world.teleport` | optional: drop player at a venue |
| `setPlayerVisible(v)` | core avatar toggle | hide player while the sim's athlete performs |
| `requestExclusiveControl(id\|null)` | core input routing | suspend the third-person controller during a sport |
| `notify(msg)` | core HUD pipeline | payout summaries |
| `readInput()` | integrator input map | keyboard + touch → `SportInput` |
| `releaseCamera()` | core camera rig | restore after a sport ends |
| `timeScale` | world timescale | slow-mo hooks if core has them |

### Mount sequence
```ts
import { createSports } from "@/city/modules/sports";
const sports = createSports();      // or createSports({ towerTop, shorelineX, skatePlaza, rooftops })
sports.mount(ctx);                  // builds all venue props into scene
// per frame: sports.update(dt);
// proximity: if (sports.distanceTo("skate")! < 6) showPrompt("🛹 Skate Park — press E");
// on interact: sports.start("skate");   …   sports.stop();
sports.bus.on((e) => renderHud(e)); // paper/style/toast/activity/tick
```

### Input mapping (`SportInput`)
The integrator maps whatever input source (keyboard, touch buttons, gamepad)
into `SportInput`: `up/down/left/right`, `action1..4` (held), `pressed1..4`
(edge-triggered). Per-sport meaning (also toasted in-game on start):
- Skate: `pressed1` ollie · `pressed2/3/4` flip tricks in air
- Parkour: `up` sprint · `pressed1` jump
- BaseJump: `pressed1` jump off / deploy chute / flare / retry
- Wingsuit: `pressed1` launch · arrows steer · `up` flare / `down` dive
- Tournament: `pressed1` jab · `pressed2` heavy · `action3` block · `pressed4` dodge
- Dojo: `pressed1` pad strike / bag hit (HUD buttons pick style + drill)
- Surf: `pressed1` pop up · `up/down` ride pocket · `left/right` carve · `pressed2/3/4` tricks
- Golf: `left/right` aim · hold `action1` charge, release to swing
- Fishing: hold `action1` cast charge, release to cast · `pressed1` hook on bite · hold `up` reel

### Venue anchors
Default coordinates live in `venues.ts` (`VENUE_POSITIONS`). If the
procedural city drifts, pass `VenueAnchors` (`towerTop`, `shorelineX`,
`skatePlaza`, `rooftops`) — `resolveVenues` snaps everything, including the
derived tower base, beach/pier x, and parkour course. `SportsManager.distanceTo(id)`
gives per-sport prompt distances from the same table.

## Billing — defensive by design (BILLING_CONTRACT.md)

- The tokenomics team's `useOrbitxBilling` hook **does not exist yet**, so
  nothing in this module imports `@/tokenomics/*` (verified: `web/src/tokenomics/`
  is absent — importing it would break the build). Hard rule honored.
- `billing.ts` codes against the contract structurally: it reads an injected
  `window.__orbitxBilling` (`ready`, `balance`, `spend({amount, reason, ref})`)
  that the tokenomics team will provide; until then every premium purchase
  resolves `{ ok: false, reason: "auth-required" }` and HUDs render the
  "coming soon / auth required" state via `premiumBilling.available`.
- Burn refs are idempotent: `city-sports:<itemId>:<Date.now()>`.
- **#20 honored:** every premium purchase burns — the module builds no
  parallel burn path and never touches keys. Auth-once is the tokenomics
  team's dashboard auth-code flow; after that, spends are seamless
  (no popups, ever — premium UI never opens a wallet dialog itself).
- Currency split: **paper CITY** for all gameplay earnings/wagers/catches
  (local `PaperLedger`, localStorage-persisted) · **real ORBITX** only for the
  5 premium upsells in `PREMIUM_CATALOG`.
- Assumption: when the primitive lands, some boot code sets
  `window.__orbitxBilling`; the sports module needs no code change, only that
  injection. Pro Board ownership additionally persists a local flag
  (`orbitxcity:sports:surf-pro`) so the equipped board survives reloads —
  it is re-verified against the billing adapter at purchase time only.

## Assumptions / caveats

- **Sims run "instanced":** while active a sim owns the camera and drives its
  own lightweight athlete; it never touches the core third-person controller
  (see `base.ts`). `stop()` hands the camera back; the integrator's
  `releaseCamera()` restores the core rig.
- **Style → paper rate is 12:1** (`STYLE_TO_PAPER_RATE`); a good session
  ≈ 20–80 paper. Tuning is in `economy.ts`, one constant.
- **Sponsor challenge progress** is tracked by a persistent singleton
  (`getSponsorTracker`, localStorage) that listens to skate `style` bus
  events — including the `__session__` / `__combo5__` / `__combo8__` markers
  SkatePark emits on stop. `createSports()` wires it at boot.
- **Dojo mastery** persists per style (0–100, diminishing near cap);
  `masteryBonus()` = +0.2%/pt capped +20%, consumed by
  `getPlayerFighterSpec()` for tournament bouts. Shadow Fist stays locked
  until the premium unlock.
- **Tournament AI bouts** are simulated instantly, skill-weighted
  (`simulateAiFight`); the engine is multiplayer-ready — any AI entrant can be
  replaced by a remote fighter spec later without touching the bracket code.
- **Bug fixed 2026-09-29 (historical):** `SkatePark`, `BaseJump`, and
  `Wingsuit` declared a `private style = 0` number field that shadowed
  `SportBase`'s protected `style(points, label)` method — every style award
  would have thrown `TypeError: this.style is not a function` at runtime.
  Renamed the accumulators to `stylePts`; method calls now hit the base
  implementation.
- **Bug fixed 2026-09-29 (style → paper payout):** `SportBase.style()` only
  emits the bus event — it does NOT accumulate points. `SkatePark`, `BaseJump`,
  and `Wingsuit` kept `stylePts` accumulators but never incremented them, so
  every session cashed **0 paper**. Fixed: all style awards now also
  `+=` the accumulator (`doTrick`/combo bonus in SkatePark; airtime/tricks/
  landings in BaseJump; rings/touchdown/perfect-run in Wingsuit). `Surf`
  already accumulated correctly via `styleGain()`.
- **Bug fixed 2026-09-29 (premium spend ordering):** `Sponsors.upgradeTier`
  burned ORBITX for the PRO contract *before* checking the tier — a rider
  already at PRO would be charged then told "already at or above". Tier check
  now runs first; spend only when an actual upgrade happens.
- **Bug fixed 2026-09-29 (golden bracket):** `Tournament.buyGoldenBracket`
  allowed purchase with no live bracket — but `enterBracket()` resets
  `golden = false`, so the ORBITX burn bought nothing. Now requires an active
  bracket (`phase === "fight"`).
- **Fixed 2026-09-29 (dojo → tournament link):** `Tournament.beginPlayerBout`
  hardcoded the player damage bonus to 1 despite claiming mastery was applied;
  it now passes `masteryBonus(player.style)` into the `Duel` ctor.
- **Fixed 2026-09-29 (parkour restart):** the finish toast said "Space to run
  it back" but nothing listened for it; finished runs now restart on Space.
- **Typecheck 2026-09-29:** `tsc --noEmit --strict` on the module is clean;
  no imports from `@/tokenomics/*`, `../core`, or other modules (verified by grep).
- **Water animation** (surf/fishing) mutates plane-vertex Z per frame —
  geometry is low-segment (40×16 / 30×12) so this is cheap on mobile.
- **Mobile-friendly:** no DOM/CSS in the module (logic + three.js only);
  touch input arrives through the integrator's `readInput()` mapping.
  HUD tick states are plain JSON for the integrator's React HUD.
- **No mock economics:** paper payouts are real ledger credits; premium
  items honestly report `auth-required` until billing lands.
- Venue prop counts are modest (boxes/cylinders/planes); the integrator may
  want to frustum-cull or LOD the tower/water on low-end devices — props are
  grouped per sim under `orbitxcity-sports-venues` for easy toggling.

## Files

- `index.ts` — public API + `createSports()` factory (all 10 sims)
- `types.ts` — `SportId`, `SportsEvent`/`SportsBus`, `SportInput`,
  `SportsContext`, `VenueAnchors`, `SportMeta`, `SportSim`, `PremiumResult`
- `base.ts` — `SportBase` (instanced-sim lifecycle, athlete rig, chase cam),
  `createAthlete`, `animateRun`
- `manager.ts` — `SportsManager` (registry, mount/unmount, start/stop,
  per-frame update, proximity distances)
- `venues.ts` — `VENUE_POSITIONS`, `resolveVenues`, prop builders
  (ramps, rails, tower, rings, labels, discs)
- `economy.ts` — `PaperLedger`, `STYLE_TO_PAPER_RATE`
- `billing.ts` — `premiumBilling` adapter, `PREMIUM_CATALOG` (5 items)
- `skate/SkatePark.ts` — trick/combo/grind sim
- `skate/Sponsors.ts` — brands, tiers, persistent challenge tracker
- `parkour/Parkour.ts` — rooftop time trial
- `air/BaseJump.ts` — tower jump, canopy, precision landing
- `air/Wingsuit.ts` — ring-threading glide
- `combat/Fighter.ts` — shared combat model (`Duel`, AI, styles, dojo state)
- `combat/Tournament.ts` — 8-fighter bracket, real-time player duels
- `combat/Dojo.ts` — styles, drills, mastery, Shadow Fist unlock
- `surf/Surf.ts` — wave riding, tricks, wipeouts, Pro Board premium
- `golf/Golf.ts` — 3-hole course, wagering, Champion tee premium
- `fishing/Fishing.ts` — casting, bite timing, tension fights, rarity sales
