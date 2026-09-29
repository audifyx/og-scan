/**
 * HeistDirector — the single integration entry point for the heists module.
 *
 * The integrator creates ONE director, attaches the core world, ticks it
 * from the game loop, and subscribes React UI to snapshots:
 *
 *   const director = createHeistDirector({ waypoints: roadNodes });
 *   director.attachWorld({
 *     getPlayerState: () => adapt(world.getPlayerState()),
 *     teleport: (x, z, h) => world.teleport(x, z, h),
 *     scene: world.sceneRef,
 *   });
 *   // in the game loop: director.update(dt);
 *   // in React: const snap = useSyncExternalStore(d => d.subscribe, d => d.snapshot());
 *
 * Core API mapping (see MODULE.md):
 *   world.getPlayerState() -> { onFoot, pos: Vector3, heading, speed,
 *     speedKmh, dayT, isNight }   => HeistPlayerState { onFoot, x: pos.x,
 *     z: pos.z, heading, speed, speedKmh, isNight }
 *   world.teleport(x, z, heading)
 *   world.sceneRef => scene
 */
import { HeistEngine } from "./heistEngine";
import { PaperLedger, heistLedger } from "./ledger";
import { TruckDirector } from "./armored";
import { CoopSession, makeNpcCrew, defaultCuts } from "./crew";
import { LocalNet } from "./net";
import { HEIST_CATALOG, getTemplate } from "./missions";
import {
  RIVAL_CREWS,
  FENCES,
  planDataHeist,
  resolveDataOp,
  sellIntel as fenceSellIntel,
  activeIntelBoosts,
} from "./dataHeists";
import { CASINO_APPROACHES, casinoAlarmRate, consumeScheduleIntel } from "./casino";
import { isBillingReady, tryBurnPremium, PREMIUM_SKUS } from "./billing";
import { spawnObjectiveBeacon } from "./fx";
import type { FxHandle } from "./fx";
import type {
  Approach,
  ArmoredTruck,
  BreachResult,
  CrewMember,
  CrewRole,
  DirectorSnapshot,
  HeistPlayerState,
  HeistResult,
  HeistSession,
  HeistTemplate,
  HeistWorldLike,
  IntelItem,
  PremiumEntry,
  TruckWaypoint,
} from "./types";

const STORE_KEY = "oxc_heists_director_v1";

interface Persisted {
  intel: IntelItem[];
  cooldownUntil: Record<string, number>;
}

function loadPersisted(): Persisted {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Persisted;
      if (Array.isArray(p.intel) && p.cooldownUntil) return p;
    }
  } catch {
    /* ignore */
  }
  return { intel: [], cooldownUntil: {} };
}

export interface HeistDirectorOpts {
  waypoints?: TruckWaypoint[];
  ledger?: PaperLedger;
}

function playerAdapter(name = "You"): CrewMember {
  return { id: "player", name, isPlayer: true, role: "leader", skill: 3, cut: 0, ready: true };
}

export class HeistDirector {
  readonly engine = new HeistEngine();
  readonly ledger: PaperLedger;
  readonly trucks: TruckDirector;
  readonly coop = new CoopSession(new LocalNet());

  private world: HeistWorldLike | null = null;
  private intel: IntelItem[] = [];
  private cooldownUntil: Record<string, number> = {};
  private premiumOverrides = new Map<string, PremiumEntry | null>();
  private listeners = new Set<(s: DirectorSnapshot) => void>();
  private safehouse = { x: 0, z: 0 };
  private vaultOpen = false;
  private vaultOpenedAt = 0;
  private beacon: FxHandle | null = null;
  private heartbeat = 0;
  private lastResult: HeistResult | null = null;
  private ambientHeat = 0;

  constructor(opts: HeistDirectorOpts = {}) {
    this.ledger = opts.ledger ?? heistLedger;
    this.trucks = new TruckDirector({ waypoints: opts.waypoints ?? [] });
    const persisted = loadPersisted();
    this.intel = persisted.intel.filter((i) => i.expiresAt > Date.now());
    this.cooldownUntil = persisted.cooldownUntil;
    this.trucks.subscribe(() => this.notify());
    this.engine.subscribe(() => this.notify());
  }

  /* ---------------- world ---------------- */

  attachWorld(world: HeistWorldLike): void {
    this.world = world;
    this.notify();
  }

  detachWorld(): void {
    this.world = null;
    this.clearBeacon();
  }

  setSafehouse(x: number, z: number): void {
    this.safehouse = { x, z };
  }

  setWaypoints(wps: TruckWaypoint[]): void {
    this.trucks.setWaypoints(wps);
  }

  /* ---------------- main loop ---------------- */

  update(dt: number): void {
    const player = this.world?.getPlayerState() ?? null;
    this.trucks.update(dt, player);

    const s = this.engine.getSession();
    if (s && s.status === "active") {
      // getaway progression from real driving state
      if (s.stage === "getaway" && player) {
        const dist = Math.hypot(player.x - this.safehouse.x, player.z - this.safehouse.z);
        this.engine.getawayTick(dt, player.speedKmh, dist);
        if (s.getawayProgress >= 1) this.finalizeGetaway(true);
      }
      // casino vault alarm while the vault is open
      const template = getTemplate(s.plan.templateId);
      if (template?.kind === "casino" && s.stage === "execution" && this.vaultOpen) {
        const rate = casinoAlarmRate(s.plan.approach, this.intel);
        s.alarm = Math.min(100, s.alarm + rate * dt);
        if (s.alarm >= 100) {
          this.engine.fail("Alarm tripped — the vault sealed with the crew inside.");
          this.finalizeGetaway(false, "Alarm tripped — the vault sealed with the crew inside.");
        }
      }
    }

    this.ambientHeat = Math.max(0, this.ambientHeat - dt * 0.4);

    // 2Hz heartbeat so timers/heat/bars stay fresh in UI
    this.heartbeat += dt;
    if (this.heartbeat >= 0.5) {
      this.heartbeat = 0;
      this.notify();
    }
  }

  /* ---------------- planning ---------------- */

  catalog(): HeistTemplate[] {
    return HEIST_CATALOG.map((t) => {
      const override = this.premiumOverrides.get(t.id);
      return override === undefined ? t : { ...t, premiumEntry: override };
    });
  }

  /** ms remaining before a template can be run again (0 = ready) */
  cooldownRemaining(templateId: string): number {
    return Math.max(0, (this.cooldownUntil[templateId] ?? 0) - Date.now());
  }

  /** integrator escape hatch: make a premium template free (or vice versa) */
  setPremiumOverride(templateId: string, entry: PremiumEntry | null): void {
    this.premiumOverrides.set(templateId, entry);
    this.notify();
  }

  /**
   * Start planning a job. For premium-gated templates the caller must burn
   * first via `buyPremiumEntry()` — this keeps billing explicit at the UI
   * layer and the engine paper-only.
   */
  startPlan(templateId: string, approach: Approach, crew?: CrewMember[]) {
    const template = this.catalog().find((t) => t.id === templateId);
    if (!template) throw new Error(`Unknown heist template: ${templateId}`);
    if (this.cooldownRemaining(templateId) > 0) throw new Error("Crew is laying low — cooldown active.");
    const members = defaultCuts(crew ?? [playerAdapter()]);
    const session = this.engine.startPlan(template, approach, members);
    this.consumeCasingBoostIntel(session);
    this.vaultOpen = false;
    return session;
  }

  /** consume one live casing-boost intel: pre-completes the first casing task */
  private consumeCasingBoostIntel(session: HeistSession): void {
    const now = Date.now();
    const idx = this.intel.findIndex(
      (i) => i.effect.kind === "casing-boost" && !i.used && i.expiresAt > now,
    );
    const task = session.plan.casing.find((c) => !c.done);
    if (idx === -1 || !task) return;
    this.intel[idx].used = true;
    task.done = true;
    this.engine.note(`🛰️ Intel casing boost — "${task.label}" pre-completed.`);
    this.persist();
  }

  /** burn real ORBITX for a premium entry fee (no-op UI lock when billing is down) */
  buyPremiumEntry(templateId: string) {
    const template = this.catalog().find((t) => t.id === templateId);
    const entry = template?.premiumEntry;
    if (!entry) return Promise.resolve({ ok: true as const, signature: "paper-only" });
    return tryBurnPremium({
      amount: entry.amount,
      reason: `city-heists:${entry.sku}`,
      sku: entry.sku,
    });
  }

  /** premium: burn ORBITX to clear a cooldown immediately ("fixer makes calls") */
  async fixerSkipCooldown(templateId: string) {
    const remaining = this.cooldownRemaining(templateId);
    if (remaining <= 0) return { ok: true as const, signature: "no-cooldown" };
    const burn = await tryBurnPremium({
      amount: 5,
      reason: `city-heists:${PREMIUM_SKUS.fixerSkip}`,
      sku: PREMIUM_SKUS.fixerSkip,
    });
    if (burn.ok) {
      delete this.cooldownUntil[templateId];
      this.persist();
      this.notify();
    }
    return burn;
  }

  quickCrew(templateId: string, playerName = "You"): CrewMember[] {
    const template = getTemplate(templateId);
    const need = Math.max(1, (template?.minCrew ?? 2) - 1);
    return [playerAdapter(playerName), ...makeNpcCrew(need, template?.difficulty ?? 2)];
  }

  /**
   * Start a job with the co-op lobby's crew (roles, readiness and cuts come
   * from the lobby). Call after the lobby emits the `start` event — this is
   * the `startCoopHeist` integrator hook referenced in MODULE.md.
   */
  startCoopPlan(templateId: string, approach: Approach) {
    const members = this.coop.snapshot().members;
    if (members.length === 0) throw new Error("Co-op lobby is empty.");
    const template = this.catalog().find((t) => t.id === templateId);
    if (!template) throw new Error(`Unknown heist template: ${templateId}`);
    if (this.cooldownRemaining(templateId) > 0) throw new Error("Crew is laying low — cooldown active.");
    const session = this.engine.startPlan(template, approach, defaultCuts(members.map((m) => ({ ...m }))));
    this.consumeCasingBoostIntel(session);
    this.vaultOpen = false;
    return session;
  }

  /** premium: burn ORBITX for an instant clean getaway (the "fixer" airlift) */
  async vipGetaway() {
    const s = this.engine.getSession();
    if (!s || s.status !== "active" || s.stage !== "getaway") {
      return { ok: false as const, code: "failed" as const, message: "VIP getaway is only available mid-getaway." };
    }
    const burn = await tryBurnPremium({
      amount: 25,
      reason: `city-heists:${PREMIUM_SKUS.vipGetaway}`,
      sku: PREMIUM_SKUS.vipGetaway,
    });
    if (burn.ok) {
      s.getawayProgress = 1;
      s.heat = Math.max(0, s.heat - 40);
      this.engine.note("🛩️ VIP getaway — the fixer airlifts the crew. Heat scrubbed.");
      this.finalizeGetaway(true);
    }
    return burn;
  }

  advance() {
    const s = this.engine.getSession();
    if (!s) return false;
    const template = getTemplate(s.plan.templateId);
    if (!template) return false;
    // casino finale: the approach's required role must be on the crew before setup
    if (template.kind === "casino" && s.stage === "crew") {
      const need = CASINO_APPROACHES[s.plan.approach].requiredRole;
      if (!s.plan.crew.some((c) => c.role === need)) {
        this.engine.note(`⛔ The Diamond Vault (${s.plan.approach}) needs a ${need} on the crew.`);
        return false;
      }
    }
    return this.engine.advance(template);
  }

  /** assign / clear a crew member's role (solo crew planning, NPC crewmates) */
  setCrewRole(memberId: string, role: CrewRole | null): boolean {
    return this.engine.setCrewRole(memberId, role);
  }

  toggleCasing(taskId: string) {
    this.engine.toggleCasing(taskId);
  }

  setApproach(a: Approach) {
    this.engine.setApproach(a);
  }

  /* ---------------- execution ---------------- */

  completeObjective(id: string) {
    this.engine.completeObjective(id);
  }

  collectLoot(amount: number, label?: string) {
    this.engine.collectLoot(amount, label);
  }

  addHeat(n: number) {
    const s = this.engine.getSession();
    if (!s) return;
    const { heatCut } = activeIntelBoosts(this.intel);
    this.engine.addHeat(n * (1 - heatCut));
  }

  openVault() {
    this.vaultOpen = true;
    this.vaultOpenedAt = Date.now();
  }

  closeVault() {
    this.vaultOpen = false;
  }

  vaultSecondsOpen(): number {
    return this.vaultOpen ? (Date.now() - this.vaultOpenedAt) / 1000 : 0;
  }

  /** call when getaway completes (or the job blows up) */
  finalizeGetaway(success: boolean, failReason?: string) {
    const s = this.engine.getSession();
    // Note: the session may already be failed (e.g. casino alarm maxed out
    // calls engine.fail() in update() before this runs) — still finalize so
    // the result screen, cooldown and heat aftermath are recorded.
    if (!s || (s.status !== "active" && s.status !== "failed")) return;
    const template = getTemplate(s.plan.templateId);
    if (!template) return;
    const effectiveSuccess = success && s.status === "active";
    const effectiveFailReason = failReason ?? s.failReason;

    let intelGained: IntelItem[] = [];
    if (template.kind === "data" && effectiveSuccess) {
      const op = planDataHeist(RIVAL_CREWS[Math.floor(Math.random() * RIVAL_CREWS.length)].id);
      if (op) {
        const hackerBonus = s.plan.crew.some((c) => c.role === "hacker");
        intelGained = resolveDataOp(op, { wipedTrace: true, hackerBonus });
        this.intel.push(...intelGained);
      }
    } else if (template.intelReward && effectiveSuccess && Math.random() < 0.5) {
      const op = planDataHeist(RIVAL_CREWS[Math.floor(Math.random() * RIVAL_CREWS.length)].id);
      if (op) {
        intelGained = resolveDataOp(op, { wipedTrace: true, hackerBonus: false }).slice(0, 1);
        this.intel.push(...intelGained);
      }
    }
    if (template.kind === "casino") {
      this.intel = consumeScheduleIntel(this.intel);
    }

    const result = this.engine.finish(template, effectiveSuccess, intelGained, effectiveFailReason);
    if (!result) return;
    this.lastResult = result;

    if (effectiveSuccess) {
      for (const p of result.payouts) {
        const who = p.memberId === "player" ? "heist cut" : `crew cut → ${p.name}`;
        this.ledger.credit(p.amount, `${template.name}: ${who}`);
      }
    }
    this.ambientHeat = Math.min(100, this.ambientHeat + result.heatAftermath * 0.5);
    this.cooldownUntil[template.id] = Date.now() + template.cooldownSec * 1000;
    this.vaultOpen = false;
    this.clearBeacon();
    this.persist();
    this.notify();
  }

  abortHeist() {
    this.engine.abort();
    this.vaultOpen = false;
    this.clearBeacon();
    this.notify();
  }

  dismissResult() {
    this.lastResult = null;
    this.notify();
  }

  /* ---------------- armored trucks ---------------- */

  breachTruck(truckId: string, loud: boolean): BreachResult | null {
    const s = this.engine.getSession();
    const crew = s?.plan.crew ?? [playerAdapter()];
    const musclePower = crew.filter((c) => c.role === "muscle").reduce((a, c) => a + c.skill, 0);
    const crewPower = musclePower + 2; // + player backup
    const res = this.trucks.breach(truckId, crewPower, loud);
    if (res) {
      this.addHeat(res.heatSpike * 0.4);
      this.ambientHeat = Math.min(100, this.ambientHeat + res.heatSpike * 0.3);
    }
    this.notify();
    return res;
  }

  collectTruckLoot(truckId: string): number {
    const loot = this.trucks.collect(truckId);
    if (loot <= 0) return 0;
    const s = this.engine.getSession();
    if (s && s.status === "active" && (s.stage === "execution" || s.stage === "getaway")) {
      this.engine.collectLoot(loot, "truck cash grabbed");
    } else {
      this.ledger.credit(loot, "armored truck robbery (solo)");
    }
    this.notify();
    return loot;
  }

  /* ---------------- intel ---------------- */

  getIntel(): IntelItem[] {
    return this.intel.map((i) => ({ ...i }));
  }

  fences() {
    return FENCES.map((f) => ({ ...f, demand: { ...f.demand } }));
  }

  rivalCrews() {
    return RIVAL_CREWS.map((c) => ({ ...c }));
  }

  sellIntelToFence(itemId: string, fenceId: string): number {
    const idx = this.intel.findIndex((i) => i.id === itemId);
    if (idx === -1) return 0;
    const [item] = this.intel.splice(idx, 1);
    const { fenceBonus } = activeIntelBoosts(this.intel);
    const payout = fenceSellIntel({ ...item, valueCity: Math.round(item.valueCity * (1 + fenceBonus)) }, fenceId, this.ledger);
    this.persist();
    this.notify();
    return payout;
  }

  /* ---------------- objective beacon ---------------- */

  /** show / move / hide the 3D objective beacon (additive on the core scene) */
  showBeacon(x: number, z: number, color = "#22d3ee") {
    if (!this.world) return;
    if (!this.beacon) {
      this.beacon = spawnObjectiveBeacon(this.world.scene, x, z, color);
    } else {
      this.beacon.setPosition(x, z);
    }
  }

  tickBeacon(dt: number) {
    this.beacon?.update(dt);
  }

  clearBeacon() {
    this.beacon?.dispose();
    this.beacon = null;
  }

  /* ---------------- snapshot ---------------- */

  subscribe(cb: (s: DirectorSnapshot) => void): () => void {
    this.listeners.add(cb);
    cb(this.snapshot());
    return () => this.listeners.delete(cb);
  }

  snapshot(): DirectorSnapshot {
    return {
      session: this.engine.getSession(),
      lastResult: this.lastResult,
      trucks: this.trucks.snapshot(),
      intel: this.getIntel(),
      balance: this.ledger.getBalance(),
      coop: this.coop.snapshot(),
      ambientHeat: Math.round(this.ambientHeat),
      billingReady: isBillingReady(),
    };
  }

  private notify() {
    const snap = this.snapshot();
    this.listeners.forEach((cb) => cb(snap));
  }

  private persist() {
    try {
      const data: Persisted = { intel: this.intel, cooldownUntil: this.cooldownUntil };
      localStorage.setItem(STORE_KEY, JSON.stringify(data));
    } catch {
      /* ignore */
    }
  }

  dispose() {
    this.clearBeacon();
    this.coop.dispose();
    this.listeners.clear();
  }
}

export function createHeistDirector(opts: HeistDirectorOpts = {}): HeistDirector {
  return new HeistDirector(opts);
}
