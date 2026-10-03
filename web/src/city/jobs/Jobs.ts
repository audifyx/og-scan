import * as THREE from "three";
import { addCityPoints } from "../cityState";
import { loadQuestStore, saveQuestStore } from "../quests";
import { getTreasuryStatus, queuePayout } from "./treasury";

/**
 * OrbitX City — jobs (cashier / delivery / security patrol).
 *
 * EXTENDS the insane-polish lane's daily quest system (web/src/city/quests.ts)
 * instead of building a second one: job completions are recorded in the SAME
 * per-wallet-per-day localStorage store (claimed keys "job:<id>"), and all
 * CITY payouts go through the shared cityState store.
 *
 * - CITY points: always paid, immediately, via addCityPoints.
 * - ORBITX: paid ONLY from a funded city treasury (see treasury.ts). Until
 *   the owner funds it, rewards honestly show "paused — treasury empty" and
 *   nothing is fabricated. When funded, completions are QUEUED for the
 *   owner's sweep — the client never signs for the treasury.
 */

// ── job definitions ───────────────────────────────────────────────

export type JobId = "cashier" | "delivery" | "patrol";

export interface JobDef {
  id: JobId;
  name: string;
  desc: string;
  location: string;
  cityReward: number;
  orbitxReward: number;
}

export const JOBS: JobDef[] = [
  {
    id: "cashier",
    name: "Cashier Shift",
    desc: "Tap-timing mini-game at the register — 10 rounds, tap in the green zone.",
    location: "WallOrbit · McOrbit's",
    cityReward: 20,
    orbitxReward: 0.5,
  },
  {
    id: "delivery",
    name: "Delivery Run",
    desc: "Pick up the package, carry it to the marked building before the timer ends.",
    location: "Citywide",
    cityReward: 15,
    orbitxReward: 0.5,
  },
  {
    id: "patrol",
    name: "Security Patrol",
    desc: "Walk the checkpoint route around the district — each checkpoint pings +2 CITY.",
    location: "District loop",
    cityReward: 10,
    orbitxReward: 0.25,
  },
];

export interface JobPayout {
  cityPaid: number;
  orbitxQueued: number;
  orbitxPaused: boolean;
  firstToday: boolean;
}

/**
 * Complete a job: pays CITY immediately (full reward first completion of the
 * day, half on repeats), records it in the daily quest store, and queues any
 * ORBITX for the treasury sweep when funded.
 */
export function completeJob(wallet: string | null, jobId: JobId, bonusCity = 0): JobPayout {
  const def = JOBS.find((j) => j.id === jobId)!;
  const key = `job:${jobId}`;
  const s = loadQuestStore(wallet);
  const firstToday = !s.claimed.includes(key);
  const cityPaid = Math.floor(def.cityReward * (firstToday ? 1 : 0.5)) + Math.max(0, Math.floor(bonusCity));
  addCityPoints(cityPaid);
  if (firstToday) {
    s.claimed.push(key);
    saveQuestStore(wallet, s);
  }
  const ts = getTreasuryStatus();
  let orbitxQueued = 0;
  if (ts.funded && def.orbitxReward > 0) {
    queuePayout(wallet, jobId, def.orbitxReward);
    orbitxQueued = def.orbitxReward;
  }
  return { cityPaid, orbitxQueued, orbitxPaused: !ts.funded, firstToday };
}

/** Has this job been completed today (full-reward already claimed)? */
export function jobDoneToday(wallet: string | null, jobId: JobId): boolean {
  return loadQuestStore(wallet).claimed.includes(`job:${jobId}`);
}

// ── cashier: tap-timing mini-game ─────────────────────────────────

export class CashierGame {
  round = 0;
  hits = 0;
  marker = 0;          // 0..1 position of the moving marker
  active = false;
  private dir = 1;
  private speed = 0.9; // marker sweeps/sec; ramps each round
  readonly totalRounds = 10;
  readonly zoneCenter = 0.5;
  readonly zoneHalf = 0.11;

  start(): void {
    this.round = 0; this.hits = 0; this.marker = 0;
    this.dir = 1; this.speed = 0.9; this.active = true;
  }

  tick(dt: number): void {
    if (!this.active) return;
    this.marker += this.dir * this.speed * dt;
    if (this.marker >= 1) { this.marker = 1; this.dir = -1; }
    if (this.marker <= 0) { this.marker = 0; this.dir = 1; }
  }

  /** Player taps — returns true when the marker is inside the green zone. */
  tap(): boolean {
    if (!this.active || this.round >= this.totalRounds) return false;
    const hit = Math.abs(this.marker - this.zoneCenter) <= this.zoneHalf;
    if (hit) this.hits += 1;
    this.round += 1;
    this.speed = Math.min(1.9, this.speed + 0.09);
    if (this.round >= this.totalRounds) this.active = false;
    return hit;
  }

  get done(): boolean { return this.round >= this.totalRounds; }
  /** Bonus CITY for accuracy: +10 when 8+/10 in the zone. */
  get accuracyBonus(): number { return this.hits >= 8 ? 10 : 0; }
}

// ── delivery: pickup → dropoff against a timer ─────────────────────

export interface DeliveryLeg {
  pickup: { x: number; z: number; label: string };
  dropoff: { x: number; z: number; label: string };
  timeLimit: number; // seconds
}

export const DELIVERY_LEGS: DeliveryLeg[] = [
  {
    pickup: { x: -13, z: -10.5, label: "OrbitX Shop" },
    dropoff: { x: 25, z: -9, label: "Ramen House" },
    timeLimit: 90,
  },
  {
    pickup: { x: -26, z: -8, label: "Neon Arcade" },
    dropoff: { x: -2, z: 19, label: "OrbitX Tower" },
    timeLimit: 100,
  },
  {
    pickup: { x: -25, z: -10, label: "Corner Deli" },
    dropoff: { x: 14, z: -9, label: "Apartments" },
    timeLimit: 100,
  },
];

export type DeliveryEvent = "picked" | "delivered" | "failed" | null;

export class DeliveryJob {
  phase: "idle" | "toPickup" | "toDropoff" | "done" | "failed" = "idle";
  timeLeft = 0;
  leg: DeliveryLeg | null = null;
  hasPackage = false;

  start(leg: DeliveryLeg): void {
    this.leg = leg;
    this.phase = "toPickup";
    this.timeLeft = leg.timeLimit;
    this.hasPackage = false;
  }

  update(dt: number, px: number, pz: number): DeliveryEvent {
    if (!this.leg || this.phase === "idle" || this.phase === "done" || this.phase === "failed") return null;
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) { this.phase = "failed"; return "failed"; }
    const target = this.phase === "toPickup" ? this.leg.pickup : this.leg.dropoff;
    const dx = px - target.x, dz = pz - target.z;
    if (dx * dx + dz * dz < 4) { // 2m radius
      if (this.phase === "toPickup") {
        this.phase = "toDropoff";
        this.hasPackage = true;
        return "picked";
      }
      this.phase = "done";
      return "delivered";
    }
    return null;
  }

  /** Current navigation target (for beacon + minimap dot hook). */
  target(): { x: number; z: number; label: string } | null {
    if (!this.leg || this.phase === "idle" || this.phase === "done" || this.phase === "failed") return null;
    return this.phase === "toPickup" ? this.leg.pickup : this.leg.dropoff;
  }

  /** Speed bonus: +5 CITY when delivered with >40% of the timer left. */
  get speedBonus(): number {
    if (this.phase !== "done" || !this.leg) return 0;
    return this.timeLeft > this.leg.timeLimit * 0.4 ? 5 : 0;
  }

  reset(): void {
    this.phase = "idle"; this.leg = null; this.hasPackage = false; this.timeLeft = 0;
  }
}

/**
 * Active delivery target for the minimap-dot hook (CityWorld lane draws it).
 * Poll each frame while a delivery is active; null otherwise.
 */
export function deliveryTargetOf(job: DeliveryJob): { x: number; z: number } | null {
  const t = job.target();
  return t ? { x: t.x, z: t.z } : null;
}

// ── patrol: checkpoint route ──────────────────────────────────────

export const PATROL_ROUTE: { x: number; z: number }[] = [
  { x: -6, z: 16 },
  { x: 4, z: 16 },
  { x: 4, z: -8 },
  { x: -6, z: -8 },
];
export const PATROL_PING_REWARD = 2; // CITY per checkpoint, paid immediately

export type PatrolEvent = { reached: number } | { routeDone: true } | null;

export class PatrolJob {
  idx = 0;
  active = false;

  start(): void { this.idx = 0; this.active = true; }

  update(px: number, pz: number): PatrolEvent {
    if (!this.active) return null;
    const c = PATROL_ROUTE[this.idx];
    const dx = px - c.x, dz = pz - c.z;
    if (dx * dx + dz * dz < 6.25) { // 2.5m radius
      const reached = this.idx;
      this.idx += 1;
      addCityPoints(PATROL_PING_REWARD); // checkpoint pings immediately
      if (this.idx >= PATROL_ROUTE.length) {
        this.active = false;
        return { routeDone: true };
      }
      return { reached };
    }
    return null;
  }

  reset(): void { this.idx = 0; this.active = false; }
}

// ── waypoint beacon (3D marker; cheap, ~40 tris) ───────────────────

export function makeBeacon(color = 0x17e6d4): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: 0.55,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  const cyl = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 5, 12, 1, true), mat);
  cyl.position.y = 2.5;
  const ringMat = new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: 0.9,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.2, 1.6, 24), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.1;
  g.add(cyl, ring);
  g.userData.tick = (t: number) => {
    const s = 1 + Math.sin(t * 5) * 0.12;
    ring.scale.set(s, s, 1);
    mat.opacity = 0.45 + Math.sin(t * 5) * 0.15;
  };
  return g;
}

export function beaconTick(g: THREE.Group, t: number): void {
  (g.userData.tick as (tt: number) => void)?.(t);
}

export function disposeBeacon(g: THREE.Group): void {
  g.parent?.remove(g);
  g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    }
  });
}
