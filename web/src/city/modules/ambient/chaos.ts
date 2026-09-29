/**
 * Chaos event bus — the decoupling point between city chaos producers
 * (crashes, brawls, police chases — future modules) and ambient reactors
 * (fire/EMS AI, fleeing crowds, roadblocks, conspiracy radio).
 *
 * Ambient owns the bus TYPE. Any module may hold a reference (exported from
 * ambient/index.ts) and emit; ambient systems subscribe. See MODULE.md.
 */

export type ChaosKind = "fire" | "crash" | "brawl" | "blackout" | "chase";

export interface ChaosEvent {
  id: number;
  kind: ChaosKind;
  x: number;
  z: number;
  severity: 1 | 2 | 3;
  at: number; // seconds, monotonic (caller passes its clock)
}

export type ChaosListener = (e: ChaosEvent) => void;

export class ChaosBus {
  private listeners = new Set<ChaosListener>();
  private seq = 1;
  /** 0 = calm, 1 = full riot. Rises on events, decays over time. */
  level = 0;

  emit(kind: ChaosKind, x: number, z: number, severity: 1 | 2 | 3 = 1, at = 0): ChaosEvent {
    const e: ChaosEvent = { id: this.seq++, kind, x, z, severity, at };
    this.level = Math.min(1, this.level + 0.12 * severity);
    for (const fn of this.listeners) {
      try { fn(e); } catch { /* a bad listener must not kill the city */ }
    }
    return e;
  }

  on(fn: ChaosListener): () => void {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }

  /** Call every frame with dt seconds. */
  tick(dt: number) {
    this.level = Math.max(0, this.level - dt * 0.02);
  }
}

/** Shared singleton — import from ambient/index.ts, never construct your own. */
export const chaosBus = new ChaosBus();
