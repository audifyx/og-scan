/**
 * Traffic reaction: civilian traffic slows/stops near chaos and roadblocks.
 *
 * Ambient does NOT own core's traffic cars. This module keeps the authoritative
 * list of slow zones (chaos scenes + roadblocks) and offers two integration
 * paths for core — see MODULE.md:
 *   1. Polling: host calls `getSlowZones()` per frame and applies to its
 *      traffic cars itself (recommended, zero coupling).
 *   2. Callback: host passes `onTrafficCommand(zone)` once at init and
 *      ambient pushes zones as they appear/expire.
 *
 * As a built-in fallback, ambient's own "brake ripple": chaos events emit a
 * temporary panic zone that decays — readable by any module.
 */

import type { ChaosBus, ChaosEvent } from "./chaos";

export interface SlowZone {
  x: number;
  z: number;
  radius: number;
  /** 0..1 — 1 = full stop (roadblock), 0.5 = crawl past a scene. */
  strength: number;
}

export type TrafficCommand =
  | { type: "zone"; zone: SlowZone }
  | { type: "clear"; id: number };

export class TrafficReactor {
  private zones = new Map<number, SlowZone & { expiresAt: number; id: number }>();
  private seq = 1;
  private unsub: (() => void) | null = null;
  private push: ((cmd: TrafficCommand) => void) | null;

  constructor(bus: ChaosBus, push: ((cmd: TrafficCommand) => void) | null = null) {
    this.push = push;
    this.unsub = bus.on((e) => this.onChaos(e));
  }

  private onChaos(e: ChaosEvent) {
    // Every chaos event creates a "rubberneck" slow zone that decays.
    const id = this.seq++;
    const zone = {
      id,
      x: e.x, z: e.z,
      radius: 12 + e.severity * 6,
      strength: 0.45 + e.severity * 0.1,
      expiresAt: performance.now() + 20000 + e.severity * 10000,
    };
    this.zones.set(id, zone);
    this.push?.({ type: "zone", zone: { x: zone.x, z: zone.z, radius: zone.radius, strength: zone.strength } });
  }

  /** Host (core traffic) polls this each frame. */
  getSlowZones(): SlowZone[] {
    this.prune();
    return [...this.zones.values()].map(({ x, z, radius, strength }) => ({ x, z, radius, strength }));
  }

  private prune() {
    const now = performance.now();
    for (const [id, z] of this.zones) {
      if (z.expiresAt <= now) {
        this.zones.delete(id);
        this.push?.({ type: "clear", id });
      }
    }
  }

  tick() { this.prune(); }

  dispose() {
    this.unsub?.();
    this.zones.clear();
  }
}

export type { ChaosEvent };
