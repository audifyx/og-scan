# OrbitXCity — Police Module

**Team:** Police module · **Area:** `web/src/city/modules/police/**` (exclusive)

GTA-style law-and-order layer for OrbitXCity: dynamic wanted AI with
criminal memory, escalating cop pursuit AI (foot + cruisers), ORBITX
bribes, prison (serve / break out / crew bail), and court dates with a
talk-your-way-out minigame. Self-contained — no imports from other
modules, core, or `@/tokenomics`.

## What was built

| # | Idea | Status | Notes |
|---|------|--------|-------|
| 1 | Dynamic wanted AI with memory — 1–5 stars; repeat offenders gain heat faster | **BUILT** | `store.ts` `PoliceStore.reportCrime()` / `tick()`: 8 crime kinds with base heat, ×1–×2 repeat-offender multiplier (capped at 4 priors), unwitnessed = 25% suspicion heat, sight-based decay (0.6/s in sight, 2.2/s evaded), localStorage persistence (`orbitxcity:police:v1`). |
| 2 | Cop pursuit AI — on foot and in cars, escalating tactics | **BUILT** | `ai.ts` `PursuitDirector`: framework-agnostic simulation. 1★ foot cops search last-known position → 2★ +cruiser intercept → 3★ PIT maneuvers → 4★ roadblocks → 5★ spike strips + max aggression. Bust conditions emitted as events; director never moves the player. |
| 3 | Bribes — burn ORBITX via backend to clear heat | **BUILT (defensive)** | `store.ts` `bribe()` → `billing.spend({ reason: "city:police-bribe", ref })`: 5/12/25/50/100 ORBITX by star, backend-signed burn, no popups. Fail-closed: `billing_not_ready` / `insufficient_balance` keep heat. Auth gate UI until tokenomics lands. |
| 4 | Prison — serve a stint or break friends out | **BUILT** | `bust()` → sentence (20s per star) with live countdown; `attemptJailbreak()` (odds fall with stars; fail = doubled time; escape = 3★ heat + jailbreak offense); `crewBail()` — friends post paper-CITY bail (250/star). |
| 5 | Court dates — minigame to talk your way out, or pay the fine | **BUILT** | Every conviction schedules a hearing (+24h). `payFine()` settles in paper CITY (400/star, +50% if convicted/missed); `playCourtRound()` — 3 persuasion questions, threshold 8 + prior convictions; win → acquitted, lose → fine +50%. |

All components are mobile-first (bottom-sheet on small screens, centered
modal on desktop), dark GTA styling, ≥44px touch targets. Styles in
`police.css` (`ox-pol-*` namespace).

## Files

| File | What it is |
|---|---|
| `index.ts` | Public API (re-exports) |
| `types.ts` | `WantedStars`, `CrimeKind`, `CrimeReport`, `RapSheet`, `Sentence`, `CourtCase`, ports (`PaperLedgerPort`, `OrbitxBillingProvider`, `PursuitWorldPort`), pursuit types |
| `store.ts` | Framework-agnostic `PoliceStore`: heat model, crimes, bribes, prison, court, events, persistence |
| `ai.ts` | Framework-agnostic `PursuitDirector`: cop units, escalation tactics, bust detection |
| `usePolice.ts` | `usePoliceStore()` React binding (single shared instance) |
| `PolicePanel.tsx` | Tabbed overlay: Bribe / Prison / Court / Record. `POLICE_PANEL_ID = "police"` |
| `WantedBadge.tsx` | Flashing HUD stars chip (taps open the panel) |
| `ui.tsx` | Copy/formatting atoms (star glyphs, tactic labels, countdowns) |
| `police.css` | Scoped styles |
| `police.test.ts` | 15 vitest tests (heat, bribes, prison, court) — all pass |

## Public API (from `index.ts`)

```tsx
import {
  PolicePanel, POLICE_PANEL_ID,   // main UI — mount as modal/panel
  WantedBadge,                     // HUD stars chip
  getPoliceStore, PoliceStore,     // shared store (crime reporting, heat, prison, court)
  PursuitDirector,                 // cop AI simulation
  usePoliceStore,                  // React binding
  BRIBE_PRICE, FINE_PER_STAR, CREW_BAIL_PER_STAR,
  heatToStars, repeatOffenderFactor, courtThreshold,
} from "@/city/modules/police";
```

## Integration

### 1. Crime reporting (for world systems + other modules)

Any module that creates crimes (heists, jobs, world collision) reports into
the shared store — imports flow *into* police, never the reverse:

```ts
import { getPoliceStore } from "@/city/modules/police";

// e.g. in a heist module after a robbery:
getPoliceStore().reportCrime({
  kind: "heist_offense",
  witnessed: sawCopOrPed,   // true = full heat, false = 25% suspicion
  label: "Pacific Standard job — downtown",
});

// per-frame (or per-tick) heat decay; inSight = any cop sees the player:
const store = getPoliceStore();
store.tick(dtSec, inSight);
```

### 2. Pursuit AI wiring (integrator implements `PursuitWorldPort`)

```ts
import { PursuitDirector, getPoliceStore } from "@/city/modules/police";

const director = new PursuitDirector({
  player: () => {
    const s = world.getPlayerState();
    return { pos: { x: s.pos.x, z: s.pos.z }, onFoot: s.onFoot, speed: s.speed, heading: s.heading };
  },
  spawnCop: (kind) => spawnCopMesh(kind),      // your visual; return id
  despawnCop: (id) => removeCopMesh(id),
  moveCop: (id, pos, heading) => placeCopMesh(id, pos, heading),
  onEvent: (ev) => {
    if (ev.type === "bust_imminent") getPoliceStore().bust("Downtown");
    if (ev.type === "pit_hit") slowPlayerCar(0.5);   // your car physics
    if (ev.type === "spike_hit") popPlayerTires();
  },
});

// in the game loop:
const store = getPoliceStore();
director.setStars(store.stars);        // escalates / stands down units
const { evaded } = director.update(dt, store.stars);
store.tick(dt, !evaded);
```

The director owns cop positions/tactics only; it never moves the player or
fights core's loop. Bust flow: `bust_imminent` → integrator plays the arrest
beat → `store.bust()` (heat → 0, sentence + court scheduled).

### 3. Mount the panel + badge

```tsx
import { PolicePanel, POLICE_PANEL_ID, WantedBadge } from "@/city/modules/police";
import { useOrbitxBilling } from "@/tokenomics/useOrbitxBilling"; // when it exists

const billing = useOrbitxBilling(); // omit until tokenomics lands — panel gates bribes
const store = usePoliceStore();

{store.stars > 0 && (
  <WantedBadge stars={store.stars} pursuit={director.snapshot} onOpen={() => openPanel(POLICE_PANEL_ID)} />
)}
{panel === POLICE_PANEL_ID && (
  <PolicePanel paper={paperLedgerPort} billing={billing} onClose={() => openPanel(null)} />
)}
```

`paper` is the same `PaperLedgerPort` shape the bounty module uses — the
integrator bridges it against the economy module's paper wallet; this module
imports nothing from `modules/economy`.

## Billing rules (per `web/src/city/BILLING_CONTRACT.md`)

- **Paper CITY:** court fines, crew bail. Local ledger, no chain.
- **Real ORBITX:** bribes only — `billing.spend({ amount, reason: "city:police-bribe", ref })`,
  backend-signed burn, no wallet popup, never keys/funds custody.
- `OrbitxBillingProvider` in `types.ts` is a verbatim copy of the billing
  contract. When `web/src/tokenomics/useOrbitxBilling` exists, inject its
  return value directly — no adapter needed.
- Bribe prices: 1★ 5 · 2★ 12 · 3★ 25 · 4★ 50 · 5★ 100 ORBITX (whole tokens).

## Exact needs from core (for the integrator / core team)

1. **Crime event hooks (do not exist yet):** core currently exposes no
   crime/witness events. Until they land, the world/heist/jobs teams call
   `getPoliceStore().reportCrime(...)` directly (see §1). Desired core
   surface: `world.onCrime(cb)` and a `witnessed` boolean on the event.
2. **Cop visuals:** the `PursuitDirector` needs the integrator to implement
   `spawnCop(kind) / moveCop / despawnCop` — suggested: reuse core's
   `createHumanoid()` (foot cops) and `createCarMesh()` (cruisers) via
   `world.sceneRef` (additive scene work, same pattern the bounty MODULE.md
   documents). No core imports inside this module.
3. **Player snapshot:** uses only the existing public `world.getPlayerState()`
   (`onFoot`, `pos`, `speed`, `heading`) — already available.
4. **Bust UX:** `bust_imminent` fires when a cop is close; the integrator
   should freeze/lock player input briefly for the arrest beat before calling
   `store.bust()` (core owns input — the module must not fight it).
5. **Siren audio:** `GameAudio` has no siren primitive; the integrator can
   trigger one from `onEvent` (`spotted`, `pit_hit`) if/when core adds it.

## Assumptions (for the integrator)

1. `web/src/tokenomics/` does not exist yet — billing is injected, never
   imported (verified absent 2026-09-29). Bribe tab renders the auth gate
   until then.
2. `beginAuth()` on the billing provider wires the dashboard auth-code flow
   (`approveMcpLinkAuth` / `mintMcpChatAuth`) per the billing contract.
3. Paper-CITY ledger lives in the economy module — bridged via
   `PaperLedgerPort`; no cross-module imports here.
4. Court hearings use real time (+24h); the fine is payable any time before
   or after the hearing. If the app is closed at hearing time, `markCourtMissed()`
   convicts on next open.
5. Sentence time is real seconds (20s/star) — scaled for session play, not
   in-game days. Tune `SENTENCE_SEC_PER_STAR` if the game gets a day clock.
6. Single-player mirror: localStorage is the source of truth. Multiplayer
   sync / backend rap sheets are out of scope.
7. `spawnCop` id uniqueness and cop-mesh pooling are the integrator's job
   (the director only passes opaque string ids).

## What was NOT built

- No 3D cop meshes / sirens / lightbars — the director drives whatever
  visuals the integrator spawns (see §2 above).
- No precinct interiors or "visit the station" flow.
- No lawyer-for-hire (ORBITX premium court advantage) — kept out to hold the
  paper-fine/ORBITX-bribe split clean; easy add via `courtThreshold` offset.
- No cop NPC dialogue / "hands up" animations — `bust_imminent` is the hook
  for the integrator to stage them.
- No integration with the factions/social crews module for crew bail naming
  (defaults to "your crew"; pass a label when that module exists).
