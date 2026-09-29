import { chaosBus } from "./chaos";
import { ChaosDirector } from "./chaosDirector";
import { CityLedger } from "./ledger";
import { CrowdManager } from "./npcs";
import { EmergencyManager } from "./emergency";
import { TrafficReactor, type TrafficCommand } from "./traffic";
import { PerformerManager } from "./performers";
import { Magician } from "./magician";
import { RadioHost } from "./radio";
import { FortuneTeller } from "./fortune";
import type {
  AmbientCtx, UiState, Interactable, Buff, Toast, FortuneCard, BuskState,
} from "./types";

export { chaosBus };
export type { ChaosBus, ChaosEvent } from "./chaos";
export { CityLedger } from "./ledger";
export type { AmbientCtx, UiState, Interactable, Buff, Toast, FortuneCard, BuskState } from "./types";
export type { SlowZone, TrafficCommand } from "./traffic";

/**
 * AmbientSystem — city life AI for OrbitXCity.
 *
 * Owns: fleeing crowds, fire/EMS dispatch + sirens + roadblocks, traffic
 * slow-zones, subway buskers (paper-CITY tips), street magician (buffs/lore),
 * conspiracy radio host, fortune teller.
 *
 * The host game constructs this once with an AmbientCtx (see types.ts), calls
 * `update(dt)` every frame, renders UiState via `ctx.onUi`, and calls
 * `activate()` when the player presses the interact key / HUD button.
 * Core hooks ambient still needs are documented in MODULE.md.
 */
export class AmbientSystem {
  readonly bus = chaosBus;
  readonly ledger = new CityLedger();
  /** All interactables (buskers, magician, fortune teller) for the HUD. */
  interactables: Interactable[] = [];

  private ctx: AmbientCtx;
  private crowd: CrowdManager;
  private emergency: EmergencyManager;
  private traffic: TrafficReactor;
  private director: ChaosDirector;
  private performers: PerformerManager;
  private magician: Magician;
  private radio: RadioHost;
  private fortune: FortuneTeller;
  private unsubChaos: (() => void) | null = null;
  private toastSeq = 1;

  private ui: UiState = {
    prompt: null,
    toasts: [],
    buffs: [],
    radioLines: [],
    fortune: null,
    busk: { active: false, earned: 0, timeLeft: 0 },
    balance: 0,
  };

  constructor(ctx: AmbientCtx) {
    this.ctx = ctx;
    const bounds = ctx.bounds ?? 90;

    this.crowd = new CrowdManager(ctx.scene, bounds);
    this.emergency = new EmergencyManager(ctx.scene, this.bus, ctx.audio, bounds, ctx.playerPos);
    this.traffic = new TrafficReactor(this.bus);
    this.director = new ChaosDirector(this.bus, bounds, () => {
      const p = ctx.playerPos();
      return { x: p.x, z: p.z };
    });
    this.performers = new PerformerManager(ctx.scene, this.ledger, ctx.audio, (earned) => {
      this.pushToast(`🎶 ${earned} paper CITY in the tip jar`);
      this.syncUi();
    });
    this.magician = new Magician(ctx.scene, ctx.audio, (b) => this.addBuff(b), (lore) => {
      this.pushToast(`🎩 ${lore}`);
      this.syncUi();
    });
    this.radio = new RadioHost(this.bus, ctx.audio, ctx.getQuotes);
    this.fortune = new FortuneTeller(
      ctx.scene, this.ledger, ctx.audio, ctx.getQuotes,
      (f: FortuneCard) => { this.ui.fortune = f; this.syncUi(); },
      (t: string) => { this.pushToast(t); this.syncUi(); },
    );

    // Crowds flee chaos; the bus level is global.
    this.unsubChaos = this.bus.on((e) => {
      this.crowd.flee(e.x, e.z, 14 + e.severity * 8, performance.now());
    });

    this.interactables = [
      ...this.performers.getInteractables(),
      this.magician.getInteractable(),
      this.fortune.getInteractable(),
    ];

    // Seed the player with a little walking-around money (paper CITY).
    if (this.ledger.balance === 0) this.ledger.earn(25, "welcome");
    this.syncUi();
  }

  /** Slow zones for core traffic — host polls per frame (see MODULE.md). */
  getSlowZones() {
    const seen = new Map<string, { x: number; z: number; radius: number; strength: number }>();
    for (const z of this.traffic.getSlowZones()) seen.set(`${z.x.toFixed(1)},${z.z.toFixed(1)}`, z);
    for (const z of this.emergency.getSlowZones()) {
      const k = `${z.x.toFixed(1)},${z.z.toFixed(1)}`;
      if (!seen.has(k)) seen.set(k, { ...z, strength: 1 });
    }
    return [...seen.values()];
  }

  /** Host calls this when the player hits interact (F / HUD button). */
  activate(): boolean {
    const it = this.nearestInteractable();
    if (it) { it.act(); return true; }
    return false;
  }

  /**
   * Chaos producer control. The built-in ChaosDirector keeps the city alive
   * when no other module emits chaos events. Set false when core / another
   * module takes over as the chaos producer (see MODULE.md).
   */
  setChaosDirectorEnabled(v: boolean) {
    this.director.setEnabled(v);
  }

  /** Host may push a traffic command consumer (optional — see traffic.ts). */
  setTrafficSink(_sink: (cmd: TrafficCommand) => void): void {
    // Documented hook point; currently the host is expected to poll
    // getSlowZones(). Kept for the callback integration path (MODULE.md).
  }

  private nearestInteractable(): Interactable | null {
    if (!this.ctx.playerOnFoot()) return null;
    const p = this.ctx.playerPos();
    let best: Interactable | null = null;
    let bestD = Infinity;
    for (const it of this.interactables) {
      const d = Math.hypot(it.x - p.x, it.z - p.z);
      if (d < it.radius && d < bestD) { best = it; bestD = d; }
    }
    return best;
  }

  private pushToast(text: string, durMs = 5000) {
    this.ui.toasts.push({ id: this.toastSeq++, text, expiresAt: performance.now() + durMs });
    if (this.ui.toasts.length > 4) this.ui.toasts.shift();
  }

  private addBuff(b: Buff) {
    this.ui.buffs = this.ui.buffs.filter((x) => x.id !== b.id);
    this.ui.buffs.push(b);
    this.pushToast(`${b.icon} ${b.label} — ${b.note ?? "buff active"}`);
  }

  update(dt: number) {
    const now = performance.now();
    this.bus.tick(dt);
    this.director.update(dt);
    this.crowd.update(dt, now);
    this.emergency.update(dt);
    this.traffic.tick();
    this.performers.update(dt);
    this.magician.update(dt);
    this.radio.update(dt);
    this.fortune.update(dt);

    // Prune expired toasts / buffs.
    let dirty = false;
    const tl = this.ui.toasts.length;
    this.ui.toasts = this.ui.toasts.filter((t) => t.expiresAt > now);
    if (this.ui.toasts.length !== tl) dirty = true;
    const bl = this.ui.buffs.length;
    this.ui.buffs = this.ui.buffs.filter((b) => b.endsAt > now);
    if (this.ui.buffs.length !== bl) dirty = true;

    // Interact prompt.
    const it = this.nearestInteractable();
    const prompt = it ? it.label : null;
    if (prompt !== this.ui.prompt) { this.ui.prompt = prompt; dirty = true; }

    // Radio lines.
    const lines = this.radio.getLines();
    if (lines.length !== this.ui.radioLines.length ||
        lines.some((l, i) => l !== this.ui.radioLines[i])) {
      this.ui.radioLines = [...lines];
      dirty = true;
    }

    const bal = this.ledger.balance;
    if (bal !== this.ui.balance) { this.ui.balance = bal; dirty = true; }

    if (dirty) this.syncUi();
  }

  private syncUi() {
    try { this.ctx.onUi({ ...this.ui, toasts: [...this.ui.toasts], buffs: [...this.ui.buffs], radioLines: [...this.ui.radioLines] }); }
    catch { /* host callback must not kill the city */ }
  }

  /** Dismiss the fortune card (host calls from HUD). */
  dismissFortune() {
    this.ui.fortune = null;
    this.syncUi();
  }

  dispose() {
    this.unsubChaos?.();
    this.director.dispose();
    this.crowd.dispose();
    this.emergency.dispose();
    this.traffic.dispose();
    this.performers.dispose();
    this.magician.dispose();
    this.radio.dispose();
    this.fortune.dispose();
  }
}

// Re-export scene helpers the host may want for placement.
export { buildFigure } from "./npcs";
export { BUSK_TIP_COST } from "./performers";
export { FORTUNE_COST } from "./fortune";
