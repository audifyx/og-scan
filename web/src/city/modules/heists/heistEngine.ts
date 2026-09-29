/**
 * Heist execution engine — pure state machine, no rendering, no networking.
 *
 * Flow: planning -> casing -> crew -> setup -> execution -> getaway ->
 * cooldown -> complete | failed. The world-hooks layer drives `update()`
 * from the game loop; React UI subscribes to snapshots.
 */
import type {
  Approach,
  CrewMember,
  CrewRole,
  HeistPlan,
  HeistResult,
  HeistSession,
  HeistStage,
  HeistTemplate,
  IntelItem,
  LootPayout,
  StageObjective,
} from "./types";
import { normalizeCuts } from "./crew";

function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

const STAGE_ORDER: HeistStage[] = [
  "planning",
  "casing",
  "crew",
  "setup",
  "execution",
  "getaway",
  "cooldown",
  "complete",
];

export interface PayoutModifiers {
  casingDone: number; // 0-1
  avgSkill: number; // 1-5
  approach: Approach;
  heat: number; // 0-100
  intelBoost: number; // 0-1 extra from intel effects
  isNight: boolean;
}

/** paper CITY payout before per-member splits */
export function computeLoot(template: HeistTemplate, mods: PayoutModifiers): number {
  const casingMod = 0.7 + 0.3 * mods.casingDone;
  const skillMod = 0.8 + (mods.avgSkill / 5) * 0.4;
  const approachMod = mods.approach === "silent" ? 1.15 : mods.approach === "smart" ? 1.05 : 0.95;
  const heatMod = Math.max(0.4, 1 - mods.heat / 250);
  const intelMod = 1 + mods.intelBoost;
  const nightMod = mods.isNight ? 1.1 : 1;
  return Math.round(template.baseLootCity * casingMod * skillMod * approachMod * heatMod * intelMod * nightMod);
}

export function splitLoot(total: number, crew: CrewMember[]): LootPayout[] {
  const members = normalizeCuts(crew);
  return members.map((m) => ({
    memberId: m.id,
    name: m.name,
    cut: m.cut,
    amount: Math.round((total * m.cut) / 100),
  }));
}

export class HeistEngine {
  private session: HeistSession | null = null;
  private listeners = new Set<(s: HeistSession | null) => void>();

  subscribe(cb: (s: HeistSession | null) => void): () => void {
    this.listeners.add(cb);
    cb(this.session);
    return () => this.listeners.delete(cb);
  }

  private notify() {
    this.session && (this.session.updatedAt = Date.now());
    this.listeners.forEach((cb) => cb(this.session));
  }

  getSession(): HeistSession | null {
    return this.session;
  }

  /** begin planning a template — returns the new session in `planning` */
  startPlan(template: HeistTemplate, approach: Approach, crew: CrewMember[]): HeistSession {
    const plan: HeistPlan = {
      templateId: template.id,
      approach,
      crew: crew.map((c) => ({ ...c })),
      casing: template.casing.map((c) => ({ ...c, done: false })),
      startedAt: Date.now(),
    };
    this.session = {
      id: uid("hs"),
      plan,
      stage: "planning",
      objectives: [],
      lootCollected: 0,
      heat: 0,
      alarm: 0,
      startedAt: Date.now(),
      updatedAt: Date.now(),
      status: "active",
      getawayProgress: 0,
      log: [`📋 ${template.name} — planning started (${approach}).`],
    };
    this.notify();
    return this.session;
  }

  private log(msg: string) {
    this.session?.log.push(msg);
    if (this.session && this.session.log.length > 60) this.session.log.shift();
  }

  /** append a journal line to the active session (premium flows, netcode, …) */
  note(msg: string): void {
    this.log(msg);
    this.notify();
  }

  private setObjectives(labels: string[]) {
    if (!this.session) return;
    this.session.objectives = labels.map((label, i) => ({ id: `obj_${i}`, label, done: false }));
  }

  toggleCasing(taskId: string): void {
    const s = this.session;
    if (!s || s.stage !== "casing") return;
    const t = s.plan.casing.find((x) => x.id === taskId);
    if (t) {
      t.done = !t.done;
      this.log(`${t.done ? "✅" : "⬜"} Casing: ${t.label}`);
      this.notify();
    }
  }

  /** assign / clear a crew member's role (planning → crew stages; one crew per role) */
  setCrewRole(memberId: string, role: CrewRole | null): boolean {
    const s = this.session;
    if (!s || s.status !== "active") return false;
    if (s.stage !== "planning" && s.stage !== "casing" && s.stage !== "crew") return false;
    if (role && s.plan.crew.some((c) => c.role === role && c.id !== memberId)) return false;
    const m = s.plan.crew.find((c) => c.id === memberId);
    if (!m) return false;
    m.role = role;
    this.log(`${role ? "🎭" : "⬜"} ${m.name} → ${role ?? "unassigned"}`);
    this.notify();
    return true;
  }

  setApproach(a: Approach): void {
    const s = this.session;
    if (!s || (s.stage !== "planning" && s.stage !== "casing")) return;
    s.plan.approach = a;
    this.log(`🔀 Approach set: ${a}`);
    this.notify();
  }

  /** move to the next stage; validates stage gates */
  advance(template: HeistTemplate): boolean {
    const s = this.session;
    if (!s || s.status !== "active") return false;
    const idx = STAGE_ORDER.indexOf(s.stage);
    const next = STAGE_ORDER[idx + 1];
    if (!next || next === "complete") return false;

    // gates
    if (s.stage === "casing") {
      const done = s.plan.casing.filter((c) => c.done).length;
      if (done < s.plan.casing.length) return false;
    }
    if (s.stage === "crew") {
      if (s.plan.crew.length < template.minCrew) return false;
      if (s.plan.crew.some((c) => !c.role)) return false;
    }

    s.stage = next;
    const def = template.stages.find((d) => d.stage === next);
    this.setObjectives(def ? def.objectives : []);
    this.log(`➡️ Stage: ${def?.label ?? next}`);
    if (next === "execution") {
      this.log("🚨 You are live. Keep the heat down.");
    }
    this.notify();
    return true;
  }

  /** mark an execution/getaway objective complete */
  completeObjective(id: string): void {
    const s = this.session;
    if (!s || s.status !== "active") return;
    const o: StageObjective | undefined = s.objectives.find((x) => x.id === id);
    if (o && !o.done) {
      o.done = true;
      this.log(`✔ ${o.label}`);
      this.notify();
    }
  }

  collectLoot(amount: number, label = "loot secured"): void {
    const s = this.session;
    if (!s || s.status !== "active") return;
    s.lootCollected += Math.max(0, Math.round(amount));
    this.log(`💰 ${label} (+${Math.round(amount)} CITY)`);
    this.notify();
  }

  addHeat(n: number): void {
    const s = this.session;
    if (!s || s.status !== "active") return;
    s.heat = Math.min(100, Math.max(0, s.heat + n));
    if (s.heat >= 100) {
      this.fail("Busted — heat maxed out. The crew got pinched.");
      return;
    }
    this.notify();
  }

  setAlarm(n: number): void {
    const s = this.session;
    if (!s || s.status !== "active") return;
    s.alarm = Math.min(100, Math.max(0, n));
    this.log(`🚨 Alarm at ${Math.round(s.alarm)}%`);
    this.notify();
  }

  /** getaway tick — integrator feeds driving state each frame */
  getawayTick(dt: number, speedKmh: number, distanceToSafehouse: number): void {
    const s = this.session;
    if (!s || s.status !== "active" || s.stage !== "getaway") return;
    const hasDriver = s.plan.crew.some((c) => c.role === "driver");
    const speedFactor = Math.min(1, speedKmh / 120);
    const driverBonus = hasDriver ? 1.35 : 1;
    // progress inversely proportional to remaining distance
    const rate = dt * 0.12 * (0.25 + speedFactor) * driverBonus;
    s.getawayProgress = Math.min(1, s.getawayProgress + rate);
    // heat bleeds off while moving fast and far
    if (speedKmh > 80 && distanceToSafehouse > 150) {
      s.heat = Math.max(0, s.heat - dt * 6);
    }
    if (s.getawayProgress >= 1) {
      s.stage = "cooldown";
      this.log("🏁 Clean getaway. Lay low.");
    }
    this.notify();
  }

  fail(reason: string): void {
    const s = this.session;
    if (!s || s.status !== "active") return;
    s.status = "failed";
    s.stage = "failed";
    s.failReason = reason;
    this.log(`❌ FAILED: ${reason}`);
    this.notify();
  }

  /**
   * Finish execution — computes the final payout and returns the result.
   * The caller credits the ledger (worldHooks does this). Accepts an
   * already-failed session (e.g. casino alarm maxed out mid-update) so the
   * result screen, cooldown and heat aftermath still record.
   */
  finish(
    template: HeistTemplate,
    success: boolean,
    intelGained: IntelItem[] = [],
    failReason?: string,
  ): HeistResult | null {
    const s = this.session;
    if (!s || (s.status !== "active" && s.status !== "failed")) return null;
    const effectiveSuccess = success && s.status === "active";

    const casingDone =
      s.plan.casing.length === 0 ? 1 : s.plan.casing.filter((c) => c.done).length / s.plan.casing.length;
    const avgSkill =
      s.plan.crew.length === 0 ? 3 : s.plan.crew.reduce((a, c) => a + c.skill, 0) / s.plan.crew.length;

    const totalLoot = effectiveSuccess
      ? Math.max(s.lootCollected, computeLoot(template, {
          casingDone,
          avgSkill,
          approach: s.plan.approach,
          heat: s.heat,
          intelBoost: 0,
          isNight: false,
        }))
      : Math.round(s.lootCollected * 0.25); // failed jobs keep a quarter of grabbed cash

    const result: HeistResult = {
      sessionId: s.id,
      templateId: template.id,
      templateName: template.name,
      success: effectiveSuccess,
      totalLoot,
      payouts: splitLoot(totalLoot, s.plan.crew),
      heatAftermath: effectiveSuccess ? Math.round(template.heatGain * (s.plan.approach === "loud" ? 1.5 : 1)) : 40,
      intelGained,
      durationSec: Math.round((Date.now() - s.startedAt) / 1000),
      failReason: effectiveSuccess ? undefined : (failReason ?? s.failReason),
    };

    s.status = effectiveSuccess ? "complete" : "failed";
    s.stage = effectiveSuccess ? "complete" : "failed";
    if (!effectiveSuccess && (failReason ?? s.failReason)) s.failReason = failReason ?? s.failReason;
    this.log(effectiveSuccess ? `✅ Heist complete — ${totalLoot.toLocaleString()} CITY.` : `❌ Heist failed — ${failReason ?? s.failReason ?? ""}`);
    this.notify();
    return result;
  }

  /** abandon the session entirely (no payout) */
  abort(): void {
    this.session = null;
    this.listeners.forEach((cb) => cb(null));
  }
}
