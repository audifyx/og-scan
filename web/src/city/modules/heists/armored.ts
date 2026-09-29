/**
 * Armored truck robberies — dynamic trucks roam the city on a timer.
 *
 * The director owns spawn/move/breach logic. It is renderer-agnostic: the
 * integrator feeds road waypoints (e.g. mapped from core's `RoadNode`s) and
 * an optional THREE scene for objective beacons (see fx.ts). Trucks are hit
 * with a crew: muscle overpowers guards, then the spilled loot is collected
 * into the active heist session (or straight to the ledger solo).
 */
import type { ArmoredTruck, BreachResult, HeistPlayerState, TruckStatus, TruckWaypoint } from "./types";

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export interface TruckDirectorOpts {
  /** road waypoints the trucks loop over */
  waypoints: TruckWaypoint[];
  spawnIntervalSec?: number;
  maxTrucks?: number;
  /** paper CITY range per truck */
  lootRange?: [number, number];
}

const TRUCK_SPEED = 9; // m/s cruise

export class TruckDirector {
  private trucks: ArmoredTruck[] = [];
  private opts: Required<TruckDirectorOpts>;
  private spawnT = 0;
  private listeners = new Set<(trucks: ArmoredTruck[]) => void>();

  constructor(opts: TruckDirectorOpts) {
    this.opts = {
      spawnIntervalSec: 75,
      maxTrucks: 2,
      lootRange: [4000, 9000],
      ...opts,
      waypoints: opts.waypoints,
    };
    this.spawnT = 20; // first truck shows up quickly
  }

  subscribe(cb: (trucks: ArmoredTruck[]) => void): () => void {
    this.listeners.add(cb);
    cb(this.snapshot());
    return () => this.listeners.delete(cb);
  }

  private notify() {
    const snap = this.snapshot();
    this.listeners.forEach((cb) => cb(snap));
  }

  snapshot(): ArmoredTruck[] {
    return this.trucks.map((t) => ({ ...t, route: t.route.map((w) => ({ ...w })) }));
  }

  setWaypoints(wps: TruckWaypoint[]): void {
    this.opts.waypoints = wps;
  }

  private spawn(): void {
    const { waypoints, lootRange, maxTrucks } = this.opts;
    if (waypoints.length < 2 || this.trucks.filter((t) => t.status === "roaming").length >= maxTrucks) return;
    const start = Math.floor(Math.random() * waypoints.length);
    const route = [...waypoints.slice(start), ...waypoints.slice(0, start)];
    const [lo, hi] = lootRange;
    const first = route[0];
    const second = route[1];
    this.trucks.push({
      id: uid("truck"),
      x: first.x,
      z: first.z,
      heading: Math.atan2(second.x - first.x, second.z - first.z),
      speed: TRUCK_SPEED,
      guards: 2 + (Math.random() < 0.4 ? 1 : 0),
      lootEstimate: Math.round(lo + Math.random() * (hi - lo)),
      status: "roaming",
      route,
      wp: 1,
      spawnedAt: Date.now(),
    });
    this.notify();
  }

  /** advance trucks along their routes; call from the game loop */
  update(dt: number, _player: HeistPlayerState | null): void {
    const { waypoints } = this.opts;
    if (waypoints.length >= 2) {
      this.spawnT -= dt;
      if (this.spawnT <= 0) {
        this.spawnT = this.opts.spawnIntervalSec * (0.7 + Math.random() * 0.6);
        this.spawn();
      }
    }
    let moved = false;
    for (const t of this.trucks) {
      if (t.status !== "roaming") continue;
      const target = t.route[t.wp];
      if (!target) {
        t.wp = 0;
        continue;
      }
      const dx = target.x - t.x;
      const dz = target.z - t.z;
      const dist = Math.hypot(dx, dz);
      const step = t.speed * dt;
      if (dist < Math.max(2, step)) {
        t.wp = (t.wp + 1) % t.route.length;
      } else {
        t.x += (dx / dist) * step;
        t.z += (dz / dist) * step;
        t.heading = Math.atan2(dx, dz);
      }
      moved = true;
      // despawn stale roamers after 12 min so the city stays fresh
      if (Date.now() - t.spawnedAt > 12 * 60 * 1000) t.status = "fled";
    }
    const before = this.trucks.length;
    this.trucks = this.trucks.filter((t) => t.status !== "fled" || Date.now() - t.spawnedAt < 12 * 60 * 1000 + 5000);
    if (moved || this.trucks.length !== before) this.notify();
  }

  /** nearest roaming truck to a point (for the "mark nearest truck" HUD action) */
  nearest(x: number, z: number): ArmoredTruck | null {
    let best: ArmoredTruck | null = null;
    let bd = Infinity;
    for (const t of this.trucks) {
      if (t.status !== "roaming") continue;
      const d = Math.hypot(t.x - x, t.z - z);
      if (d < bd) {
        bd = d;
        best = t;
      }
    }
    return best ? { ...best } : null;
  }

  /**
   * Attempt a breach. crewPower ~ sum of muscle skill + player backup.
   * Returns the outcome; on success the truck spills loot to collect.
   */
  breach(truckId: string, crewPower: number, loud: boolean): BreachResult | null {
    const t = this.trucks.find((x) => x.id === truckId);
    if (!t || t.status !== "roaming") return null;
    const log: string[] = [];
    const guardPower = t.guards * 2.2 + Math.random() * 2;
    const power = crewPower + (loud ? 2 : 0) + Math.random() * 2;
    const success = power >= guardPower * 0.8;
    const guardsDown = success ? t.guards : Math.floor(Math.random() * t.guards);
    const heatSpike = loud ? 45 : 25;
    if (success) {
      t.status = "breached";
      t.speed = 0;
      const spilled = Math.round(t.lootEstimate * (0.75 + Math.random() * 0.35));
      t.lootEstimate = spilled;
      log.push(`💥 Truck breached — ${guardsDown}/${t.guards} guards down.`);
      log.push(`💰 $${spilled.toLocaleString()} CITY spilled. Grab it fast.`);
      this.notify();
      return { success: true, guardsDown, lootSpilled: spilled, heatSpike, log };
    }
    log.push(`🛡️ Breach failed — guards held the truck. It radioed for backup.`);
    this.notify();
    return { success: false, guardsDown, lootSpilled: 0, heatSpike: heatSpike + 15, log };
  }

  /** scoop spilled cash after a successful breach */
  collect(truckId: string): number {
    const t = this.trucks.find((x) => x.id === truckId);
    if (!t || t.status !== "breached") return 0;
    t.status = "looted";
    const loot = t.lootEstimate;
    t.lootEstimate = 0;
    this.notify();
    return loot;
  }

  setStatus(truckId: string, status: TruckStatus): void {
    const t = this.trucks.find((x) => x.id === truckId);
    if (t) {
      t.status = status;
      this.notify();
    }
  }
}
