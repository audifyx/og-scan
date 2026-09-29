# OrbitXCity — Heists Module

GTA-style heist system for OrbitXCity: multi-stage jobs (casing → crew →
setup → execution → getaway → cooldown), co-op crew lobbies, a casino
finale, roaming armored trucks, and data heists against rival crews for
fenceable intel. Self-contained under `web/src/city/modules/heists/**` —
no imports from other modules, core, or `@/tokenomics`.

**Currency law:** gameplay loot is paper CITY (local ledger, no chain).
Real ORBITX is burned **only** for premium purchases (casino entry,
fixer cooldown skips, VIP getaway) via the injected billing seam — per
`web/src/city/BILLING_CONTRACT.md` (#20: every in-game purchase burns).
The game never custodies keys or funds.

## Files

| File | What it is |
|---|---|
| `index.ts` | Public API (re-exports everything the integrator needs) |
| `types.ts` | `HeistTemplate`, `HeistSession`, `CrewMember`, `HeistResult`, `ArmoredTruck`, `IntelItem`, `NetAdapter`, `DirectorSnapshot`, … |
| `missions.ts` | Heist catalog: Neon Pawn (store), Vice Vault (bank), Rooftop Server Farm (data) + the casino finale merged in |
| `casino.ts` | The Diamond Vault finale: 3 approaches, vault loot tiers, alarm-rate math, schedule-intel consumption |
| `heistEngine.ts` | Pure state machine: stage flow + gates, loot computation, cut splitting, heat/alarm, getaway ticks, fail/finish |
| `crew.ts` | Role meta (leader/driver/hacker/muscle/lookout/ghost), NPC crew gen, cut defaults/normalization, `CoopSession` lobby |
| `net.ts` | `NetAdapter` transport contract + `LocalNet` v1 simulation (bot crewmates join, claim roles, ready up) |
| `armored.ts` | `TruckDirector`: dynamic truck spawns on road waypoints, route following, breach + loot collection |
| `dataHeists.ts` | Rival crews (4), data ops, intel drops with tiered effects/expiry, fences with demand pricing, intel-buff aggregation |
| `ledger.ts` | Paper-CITY ledger (localStorage `oxc_heists_ledger_v1`, starter grant 250); bridge-to-`economy.ts` planned |
| `billing.ts` | Premium billing seam: `setBillingProvider()` injection, `tryBurnPremium()`, `PREMIUM_SKUS` — never imports `@/tokenomics` |
| `fx.ts` | Additive three.js FX: objective beacon (light pillar + ring), alarm pulse rings — all disposable |
| `worldHooks.ts` | `HeistDirector`: single integration entry point — session flow, trucks, intel, co-op, cooldowns, persistence, snapshots |

## Public API (from `index.ts`)

```ts
import {
  createHeistDirector,      // HeistDirector — the integrator's one object
  HEIST_CATALOG, getTemplate,
  CASINO_TEMPLATE, CASINO_APPROACHES, vaultTierFor, VAULT_TIER_LOOT,
  ROLE_META, CoopSession, LocalNet,
  makeNpcCrew, defaultCuts, normalizeCuts,
  TruckDirector,
  RIVAL_CREWS, FENCES, planDataHeist, resolveDataOp, sellIntel, activeIntelBoosts, expiredIntel,
  PaperLedger, heistLedger,
  setBillingProvider, isBillingReady, tryBurnPremium, PREMIUM_SKUS,
  spawnObjectiveBeacon, spawnAlarmPulse,
  computeLoot, splitLoot,
} from "@/city/modules/heists";
```

## Integration

### 1. Create the director, attach the world, tick it

```ts
import { createHeistDirector } from "@/city/modules/heists";
import type { HeistWorldLike } from "@/city/modules/heists";

const director = createHeistDirector({
  waypoints: roadNodes.map((n) => ({ x: n.x, z: n.z })), // or call setWaypoints() later
});

// in world bootstrap — mapping verified against core/World.ts (2026-09-29):
director.attachWorld({
  getPlayerState: () => {
    const s = world.getPlayerState();           // { onFoot, pos, heading, speed, speedKmh, dayT, isNight }
    return { onFoot: s.onFoot, x: s.pos.x, z: s.pos.z, heading: s.heading,
             speed: s.speed, speedKmh: s.speedKmh, isNight: s.isNight };
  },
  teleport: (x, z, h) => world.teleport(x, z, h),
  scene: world.sceneRef,                            // additive-only FX
});

// in the game loop:
director.update(dt);
// plus: director.tickBeacon(dt) to animate the objective beacon

director.setSafehouse(x, z);   // getaway target
```

### 2. Subscribe React UI to snapshots

```ts
const snapshot = useSyncExternalStore(
  (cb) => director.subscribe(cb),
  () => director.snapshot(),
);
// snapshot: { session, lastResult, trucks, intel, balance, coop, ambientHeat, billingReady }
```

`session` is the live `HeistSession` (stage, objectives, lootCollected,
heat, alarm, getawayProgress, log) — drive the planning board, execution
HUD, and getaway bar off it. `lastResult` (with per-member `payouts` and
`intelGained`) is set on finish; call `director.dismissResult()` after the
score screen.

### 3. Running a job

```ts
director.startPlan("vice-vault", "smart", director.quickCrew("vice-vault"));
// stage flow (advance() enforces gates: all casing done, crew ≥ minCrew with roles)
director.toggleCasing("vv_cams");   // casing stage
director.setCrewRole(npcId, "driver"); // assign NPC crewmate roles in planning→crew stages
director.advance();                 // crew → setup → execution → getaway → cooldown
// casino: advance() out of the crew stage requires the approach's role
// (silent→hacker, loud→muscle, smart→ghost) on the crew, or it stays put
director.completeObjective("obj_0");
director.collectLoot(2500, "vault cash");
director.addHeat(10);               // intel heat-cut buffs apply here
// casino: director.openVault() / closeVault() / vaultSecondsOpen()
// getaway is driven by director.update() from real driving state
director.finalizeGetaway(true);     // or (false, reason)
director.cooldownRemaining("vice-vault"); // ms before the job is re-runnable
```

### 4. Co-op lobbies (v1 = local simulation)

```ts
const coop = director.coop;
const code = await coop.host("You");      // bots join, auto-claim roles, ready up
// or: await coop.join("ABC123", "You");
coop.onEvent((e) => {
  if (e.type === "members") renderLobby(e.snapshot);   // members, cuts, ready state
  if (e.type === "start") director.startCoopPlan(e.templateId, e.approach);
});
coop.claimRole("hacker");                   // player role (host starts as leader)
coop.setReady(true);
if (coop.canStart(template)) coop.start(template.id, "smart");
```

To go real-multiplayer, implement `NetAdapter` (see `net.ts`) over
WebSocket / Supabase Realtime / LiveKit and pass it to `new CoopSession(adapter)`
— crew/UI code is transport-agnostic. **Known v1 gaps:** no real transport,
no host migration, no reconnect, no authoritative server / anti-cheat.
Message schema is versioned (`v: 1`) so a real adapter swaps in cleanly.

### 5. Armored trucks

```ts
director.trucks.subscribe((trucks) => renderTruckMarkers(trucks));
const res = director.breachTruck(truckId, loud);   // uses active crew's muscle skill
director.collectTruckLoot(truckId);                // → active session or ledger (solo)
director.showBeacon(truck.x, truck.z, "#f59e0b");  // objective marker
```

Trucks spawn on the provided road waypoints every ~75s (max 2 roaming),
despawn after 12 minutes, and despawn-cleanup keeps the city fresh.

### 6. Data heists & intel

Intel drops from `data`-kind jobs (`finalizeGetaway` auto-resolves) or as a
50% bonus on `intelReward` templates. Live intel (unexpired, unused) buffs
payouts: casing boost (consumed at `startPlan` — pre-completes the first
casing task), heat cut (applied in `addHeat`), fence bonus (applied in
`sellIntelToFence`), and the casino vault schedule (halves alarm rate —
consumed on casino runs). Fence or keep:

```ts
director.rivalCrews(); director.fences();
director.sellIntelToFence(itemId, "fence-mira");
```

### 7. Premium billing (injected, never imported)

```ts
// once web/src/tokenomics/useOrbitxBilling exists:
import { useOrbitxBilling } from "@/tokenomics/useOrbitxBilling";
import { setBillingProvider } from "@/city/modules/heists";
const billing = useOrbitxBilling();
setBillingProvider({ ready: billing.ready, spend: (o) => billing.spend(o) });

// premium flows:
await director.buyPremiumEntry("casino-finale");   // 10 ORBITX burn, backend-signed, no popup
await director.fixerSkipCooldown("vice-vault");   // 5 ORBITX, clears cooldown
await director.vipGetaway();                       // 25 ORBITX, instant clean getaway mid-getaway (heat -40)
```

Until then every premium call resolves `{ ok: false, code: "unavailable" }`
and the UI renders the locked state. Premium SKUs: `heist:casino-entry`,
`heist:fixer-skip`, `heist:vip-getaway`. Paper CITY gameplay is never gated
on billing. `director.setPremiumOverride(id, null)` is the integrator escape
hatch to make a premium template free (or vice versa).

## Core API mapping (verified against `web/src/city/core/index.ts` + `World.ts`)

- `world.getPlayerState()` → `{ onFoot, pos: Vector3, heading, speed, speedKmh, dayT, isNight }` —
  adapted to `HeistPlayerState { onFoot, x, z, heading, speed, speedKmh, isNight }`.
- `world.teleport(x, z, heading)` — exits vehicle first; used by heist setup/fast-travel.
- `world.sceneRef` — THREE.Scene; module FX is additive-only (beacons, alarm pulses).

Self-containment: the module never imports core; the integrator supplies the
`HeistWorldLike` adapter (duck-typed, §1 above).

## Assumptions (for the integrator)

1. `web/src/tokenomics/` does not exist yet (verified 2026-09-29) — billing
   is injected via `setBillingProvider()`, never statically imported (would
   break the build).
2. No shared `city/economy.ts` paper-CITY ledger yet — the module ships its
   own `PaperLedger` (method names are economy-shaped: `credit`, `debit`,
   `getBalance`); bridge it when the shared ledger lands.
3. Player identity is minimal (`playerAdapter` = "player"/"You") — wire to the
   game's real identity when it exists.
4. Road waypoints are integrator-supplied (e.g. mapped from core's
   `RoadNode`s); trucks never spawn without ≥2 waypoints.
5. localStorage keys: `oxc_heists_ledger_v1` (balance+history), `oxc_heists_director_v1`
   (intel, cooldowns). No server persistence — a backend sync is out of scope.

## What was NOT built

- No React UI (planning board, lobby screen, execution HUD, score screen,
  fence shop) — the engine exposes everything the UI needs via snapshots;
  UI is the integrator's build (or a follow-up task for this module).
- No real multiplayer transport — v1 is `LocalNet` simulation; see §4 gaps.
- No 3D truck/heist-site meshes beyond FX beacons — trucks are data objects
  with positions; the integrator renders them (armored-vehicle mesh) from
  `trucks.subscribe`.
- No minimap integration for truck markers/beacons — integrator's call.
- No backend routes for premium purchase history / anti-dupe — spends are
  idempotency-keyed (`ref`) client-side; backend dedupe is tokenomics' call.
- No police/wanted integration — heat is tracked as 0–100 (session) and
  ambient city heat (director); the police module consumes these when it lands.
- No safehouse fast-travel — `setSafehouse` only feeds getaway distance math.

## Continuation log (2026-09-29)

- `HeistEngine.setCrewRole()` + `HeistDirector.setCrewRole()` — solo crews can
  assign NPC crewmate roles (planning → crew stages, one crew per role); the
  crew-stage gate already requires roles, so this was the missing half.
- Casino approach role gate now enforced: `advance()` out of the crew stage on
  the Diamond Vault blocks without the approach's required role
  (silent→hacker, loud→muscle, smart→ghost), with a session log note.
- `casing-boost` intel now actually consumed: `startPlan()` burns one live item
  to pre-complete the first casing task (was documented but never wired).
- `LocalNet` bots now auto-claim roles after joining (driver/hacker/…), so the
  v1 solo co-op loop (host → lobby → `canStart` → start → `startCoopPlan`)
  completes without manual bot puppeteering.
