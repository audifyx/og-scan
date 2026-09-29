# Ambient module — MODULE.md

**Ambient city life AI for OrbitXCity** (GTA-style, third-person, realistic — not blocky).
Owns: fleeing crowds, fire/EMS dispatch + sirens + roadblocks, traffic slow-zones,
subway buskers (paper-CITY tips), street magician (random buffs + lore), the
conspiracy radio host W-O-R-B ("market manipulation" live on air), and Madame
Zola the fortune teller (predicts your next trade — flavor/fun).

Exclusive area: `web/src/city/modules/ambient/**`. This module imports NOTHING
from sibling modules and NEVER imports `@/tokenomics/*` (that directory does
not exist yet — importing it would break the build).

---

## Files

| File | Owns |
|---|---|
| `index.ts` | `AmbientSystem` facade: wires everything, `update(dt)`, `activate()`, `getSlowZones()`, UI fan-out |
| `chaos.ts` | `ChaosBus` event bus + the shared **singleton** `chaosBus`. `level` 0..1 (riot meter) |
| `chaosDirector.ts` | Ambient-local chaos PRODUCER so the city is alive standalone (see below) |
| `npcs.ts` | `CrowdManager` (wandering/fleeing peds) + `buildFigure()` realistic humanoid builder |
| `emergency.ts` | `EmergencyManager`: fire trucks + ambulances, wail sirens, light bars, roadblock props + zones |
| `traffic.ts` | `TrafficReactor`: authoritative slow-zone list (chaos "rubberneck" zones) |
| `performers.ts` | `PerformerManager`: 3 subway buskers, tip jars, ambient crowd tips. `BUSK_TIP_COST = 3` |
| `magician.ts` | `Magician`: 70/30 buff-vs-lore on interact, 30s cooldown, flavor-only buffs |
| `radio.ts` | `RadioHost`: W-O-R-B rants on chaos events + >8% market moves, idle filler every ~75s |
| `fortune.ts` | `FortuneTeller`: 5 paper CITY per prophecy, random tracked symbol, explicit "entertainment only" |
| `ledger.ts` | `CityLedger`: local paper-CITY ledger. Earn/spend with reasons, 60-entry log |
| `audio.ts` | `AmbientAudio`: synthesized sounds only (coin, chime, radio static, siren wail). No assets |
| `types.ts` | `AmbientCtx`, `UiState`, `Interactable`, `Buff`, `Toast`, `FortuneCard`, `BuskState` |

---

## Host wiring (core / whoever constructs this)

```ts
import { AmbientSystem } from "@/city/modules/ambient";
import { chaosBus } from "@/city/modules/ambient";

const ambient = new AmbientSystem({
  scene, colliders, audio: new AmbientAudio(coreAudio ?? null),
  bus: chaosBus,
  playerPos: () => player.position,
  playerOnFoot: () => !inVehicle,
  isNight: () => dayNight.isNight,
  getQuotes: () => marketQuotes,          // Record<string, { price, change24h }> — may be {}
  onUi: (ui) => setAmbientUi(ui),         // React state or HUD writer
  bounds: 90,
});

// per frame:
ambient.update(dt);

// on interact key (F / HUD button):
ambient.activate();                       // nearest Interactable within radius, on-foot only

// per frame (optional but recommended):
for (const z of ambient.getSlowZones()) coreTraffic.applySlowZone(z);

// HUD:
ambient.dismissFortune();                 // close the prophecy card

// teardown:
ambient.dispose();
```

`UiState` carries everything the HUD needs: `prompt` (nearest interactable
label), `toasts` (max 4, self-expiring), `buffs` (active, self-expiring),
`radioLines` (last 6, newest last), `fortune` (card or null), `busk`
(reserved shape), `balance` (paper CITY).

---

## Chaos event bus (cross-module contract)

Ambient owns the TYPE, but the bus is the decoupling point for the whole city:

- **Any module** may `import { chaosBus } from "@/city/modules/ambient"` and
  `chaosBus.emit(kind, x, z, severity, nowSeconds)`.
- `kind`: `"fire" | "crash" | "brawl" | "blackout" | "chase"`.
- **Never construct your own `ChaosBus`** — listeners register on the singleton.
- Listeners must not throw; `emit` swallows listener errors so one bad
  subscriber can't kill the city.

`ChaosDirector` exists because **nothing emits chaos yet** (no core crash
events, no police-chase emits — verified 2026-09-29). It self-drives the city:
first incident ~40s in, then every ~70–160s scaled by calm (`bus.level` gates
frequency so riots don't spiral), severity weights 1:55% / 2:35% / 3:10%,
placed 20–60m from the player so incidents stay visible.

**When core (or police/vehicles modules) start emitting real chaos**, call
`ambient.setChaosDirectorEnabled(false)` and the director goes quiet. Until
then it stays on — the fire/EMS/crowd/radio pipeline is dead without a producer.

---

## Billing (per `web/src/city/BILLING_CONTRACT.md`)

- **Paper CITY only.** All ambient money flows through the local `CityLedger`:
  welcome seed 25 · busker tip cost 3 · ambient crowd tips 1–3 · fortune
  reading cost 5. No chain, no wallet, no popups.
- **No real-ORBITX paths exist in this module.** There is no premium purchase,
  no burn call, nothing to wire to `useOrbitxBilling`.
- **NEVER `import` from `@/tokenomics/*`** — the directory does not exist;
  importing it breaks the build. When the primitives land, premium UI stays in
  "coming soon / auth required" state until then.
- `CityLedger` is intentionally self-contained (no sibling-module imports).
  When the tokenomics primitives land it merges into the game's economy layer
  (`web/src/city/economy.ts` per the contract). Note: `modules/economy/store/paperWallet.ts`
  already runs a persisted 100-CITY paper wallet for panels/minigames — the
  HOST should reconcile/bridge the two balances (e.g. seed the ambient ledger
  from the paper wallet, or route ambient earn/spend through it) rather than
  ambient importing across the module boundary.

---

## Core hooks needed (wishlist for the core team)

1. **Traffic slow zones (INTEGRATION PENDING).** Host polls
   `ambient.getSlowZones()` per frame (`{x, z, radius, strength}` — 1 = full
   stop at roadblocks, ~0.5 = crawl past a scene) and decelerates its traffic
   cars inside them. Alternative callback path exists (`TrafficCommand`
   push / `setTrafficSink`) but is currently a documented stub — polling is
   the recommended path.
2. **Chaos emission.** Core should `chaosBus.emit("crash", …)` on real car
   crashes, `"chase"` on police pursuits, etc. Until then the ChaosDirector
   covers it (see above).
3. **Interact key.** Host calls `ambient.activate()` on F / HUD tap. Ambient
   itself gates to on-foot via `ctx.playerOnFoot()`.
4. **Buff stat effects.** Magician buffs are currently flavor-only (UI badge +
   toast). Real effects (move speed, tip multiplier, chaos attraction) need
   core hooks that don't exist yet — documented here so they aren't faked.
5. **`ctx.colliders`** is reserved for future ped/vehicle obstacle avoidance;
   currently unused by ambient. `ctx.isNight` is reserved for night-behavior
   tuning (buskers pack up, radio gets weirder).

---

## Assumptions

- Paper-CITY balance is per-session inside `CityLedger` (not persisted); the
  host may persist via `ui.balance` snapshots.
- All audio is synthesized WebAudio; `AudioContext` is created lazily and
  resumed on call (autoplay-policy safe). `AmbientAudio` wraps core audio by
  structural typing (`cash()`/`click()`), no core import.
- Mobile/perf: crowd capped at 36, emergency units capped at 4, no per-frame
  allocation in hot loops, shadows off on all ambient meshes, pooled
  geometries per figure.
- Buffs/toasts/roadblocks expire on `performance.now()`; safe across tab
  throttling (they just expire late).
- Radio market rants need `getQuotes()`; without quotes the host may pass
  `() => ({})` and the station still runs on chaos + idle lines. Rants are
  throttled (one market rant per 15s check, 2min cooldown per symbol).
- Fortune prophecies are explicitly labeled entertainment-only on the card —
  never present them as real predictions.
- Severity-3 events are rare by design (10%); roadblocks only spawn at
  severity ≥ 2 and expire after 45s.
- `buildFigure` is exported for host/sibling use (consistent pedestrian look);
  each call allocates geometries — callers must `dispose()`.

## Feature status (2026-09-29)

- Fleeing crowds: BUILT (`npcs.ts`)
- Fire/EMS dispatch + distance-based sirens + light bars: BUILT (`emergency.ts`)
- Roadblocks (props + slow zones, 45s expiry): BUILT (`emergency.ts`)
- Traffic slow-zone list: BUILT (`traffic.ts` + `emergency.ts`) — core polling INTEGRATION PENDING
- Chaos producer: BUILT (`chaosDirector.ts`) — disable via `setChaosDirectorEnabled(false)` when real producers land
- Subway buskers + tip jars (paper CITY): BUILT (`performers.ts`)
- Street magician (random buffs + lore drops): BUILT (`magician.ts`)
- Conspiracy radio host (chaos + market-manipulation rants): BUILT (`radio.ts`)
- Fortune teller (trade prophecies, flavor): BUILT (`fortune.ts`)
- Paper-CITY ledger: BUILT (`ledger.ts`) — merge into game economy layer when tokenomics primitives land
- `MODULE.md`: SHIPPED (this file)
