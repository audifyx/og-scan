import type { ChaosBus, ChaosKind } from "./chaos";

/**
 * ChaosDirector — ambient-local chaos PRODUCER.
 *
 * The emergency/crowd/traffic/radio systems all REACT to chaos events, but
 * nothing in the game emits them yet (core crash events, police chases —
 * future producers). Until those land, this director keeps the city alive:
 * it emits low-frequency ambient chaos (fender-benders, dumpster fires,
 * sidewalk brawls, rare blackouts) so fire/EMS dispatch, fleeing crowds,
 * roadblocks, and the radio host all actually run in a standalone session.
 *
 * Frequency is gated by bus.level: a rioting city backs off, a calm city
 * gets its next incident sooner. Mostly severity 1, occasionally 2, rarely 3.
 *
 * The host can take over as the producer at any time and silence this with
 * `setEnabled(false)` — see AmbientSystem.setChaosDirectorEnabled and
 * MODULE.md.
 */

const KIND_WEIGHTS: { kind: ChaosKind; w: number }[] = [
  { kind: "crash", w: 0.3 },
  { kind: "brawl", w: 0.25 },
  { kind: "fire", w: 0.25 },
  { kind: "chase", w: 0.15 },
  { kind: "blackout", w: 0.05 },
];

export class ChaosDirector {
  private bus: ChaosBus;
  private bounds: number;
  private getPlayer: () => { x: number; z: number };
  private enabled = true;
  private timer = 0;
  private nextIn = 40; // seconds until the first incident

  constructor(
    bus: ChaosBus,
    bounds: number,
    getPlayer: () => { x: number; z: number },
  ) {
    this.bus = bus;
    this.bounds = bounds;
    this.getPlayer = getPlayer;
  }

  setEnabled(v: boolean) {
    this.enabled = v;
    if (!v) this.timer = 0;
  }

  get isEnabled() {
    return this.enabled;
  }

  private pickKind(): ChaosKind {
    let r = Math.random();
    for (const k of KIND_WEIGHTS) {
      r -= k.w;
      if (r <= 0) return k.kind;
    }
    return "crash";
  }

  private pickSeverity(): 1 | 2 | 3 {
    const r = Math.random();
    if (r < 0.55) return 1;
    if (r < 0.9) return 2;
    return 3;
  }

  update(dt: number) {
    if (!this.enabled) return;
    this.timer += dt;
    if (this.timer < this.nextIn) return;
    this.timer = 0;

    // Calm city → sooner next incident; rioting city → back off.
    const calm = 1 - Math.min(1, Math.max(0, this.bus.level));
    this.nextIn = 70 + Math.random() * 90 * (0.35 + calm);

    // Keep incidents near-ish the player so they're visible: 20–60m away.
    const p = this.getPlayer();
    const a = Math.random() * Math.PI * 2;
    const d = 20 + Math.random() * 40;
    const b = this.bounds;
    const x = Math.max(-b, Math.min(b, p.x + Math.sin(a) * d));
    const z = Math.max(-b, Math.min(b, p.z + Math.cos(a) * d));

    this.bus.emit(this.pickKind(), x, z, this.pickSeverity(), performance.now() / 1000);
  }

  dispose() {
    this.enabled = false;
  }
}
