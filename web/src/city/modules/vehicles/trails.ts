/**
 * OrbitXCity — Vehicles module: BMX / dirt bike trails.
 *
 * Dirt routes out past the dunes: BMX pump tracks, dirt-bike single-track,
 * and the big downhill line. Timed runs with trick multipliers; paper-CITY
 * payouts for medals. Trails are for bikes — cars can't enter the gate.
 */
import type { MapPoint, PaperDelta } from "./types";

export interface Trail extends MapPoint {
  trailId: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  lengthM: number;
  /** Allowed kinds. */
  bikes: ("bmx" | "dirtbike")[];
  description: string;
}

export const TRAILS: Trail[] = [
  { trailId: "pump-junior", name: "Junior Pump Track", x: -260, z: -40, blip: "🚵 Pump Track", difficulty: 1, lengthM: 600, bikes: ["bmx"], description: "Rollers and berms — learn to pump." },
  { trailId: "cactus-single", name: "Cactus Singletrack", x: -320, z: 80, blip: "🚵 Singletrack", difficulty: 2, lengthM: 1800, bikes: ["bmx", "dirtbike"], description: "Tight desert single-track through the cacti." },
  { trailId: "dune-whoops", name: "Dune Whoops", x: -420, z: -120, blip: "🏍️ Whoops", difficulty: 3, lengthM: 2400, bikes: ["dirtbike"], description: "Whoop-de-doos at speed. Commit or crash." },
  { trailId: "mesa-drop", name: "Mesa Drop Line", x: -520, z: 40, blip: "🚵 Downhill", difficulty: 4, lengthM: 3100, bikes: ["bmx", "dirtbike"], description: "Steep mesa descent with rock gardens." },
  { trailId: "widowmaker", name: "Widowmaker Ridge", x: -640, z: -60, blip: "⚠️ Widowmaker", difficulty: 5, lengthM: 4200, bikes: ["dirtbike"], description: "Exposed ridge, zero margin. Legends only." },
];

export type TrailMedal = "none" | "bronze" | "silver" | "gold";

/** Par time scales with difficulty; faster = better medal. */
export function medalForTime(trail: Trail, seconds: number): TrailMedal {
  const par = trail.lengthM / (trail.difficulty * 6 + 8); // ~m/s pace model
  if (seconds <= par * 0.9) return "gold";
  if (seconds <= par) return "silver";
  if (seconds <= par * 1.25) return "bronze";
  return "none";
}

const MEDAL_PAYOUT: Record<TrailMedal, number> = { none: 0, bronze: 120, silver: 300, gold: 750 };

export interface TrailRun {
  trailId: string;
  startedAt: number;
  checkpointsHit: number;
  tricks: number; // trick multiplier events
  crashes: number;
}

export function startTrailRun(trailId: string): TrailRun {
  return { trailId, startedAt: Date.now(), checkpointsHit: 0, tricks: 0, crashes: 0 };
}

/** Finishes a run: time + tricks − crashes → medal + paper payout. */
export function finishTrailRun(run: TrailRun, now = Date.now()): {
  seconds: number;
  medal: TrailMedal;
  payout: PaperDelta;
} {
  const trail = TRAILS.find((t) => t.trailId === run.trailId);
  if (!trail) throw new Error(`Unknown trail: ${run.trailId}`);
  const seconds = (now - run.startedAt) / 1000;
  // tricks shave effective time, crashes add it
  const effective = seconds * Math.pow(0.97, run.tricks) + run.crashes * 12;
  const medal = medalForTime(trail, effective);
  const amount = Math.floor(MEDAL_PAYOUT[medal] * (1 + trail.difficulty * 0.25));
  return {
    seconds,
    medal,
    payout: {
      amount,
      label: `${trail.name} — ${medal} medal`,
      source: "vehicles:trails",
    },
  };
}

/** Trailhead gate check: is this vehicle allowed on the trail? */
export function canEnterTrail(trailId: string, kind: "bmx" | "dirtbike" | string): boolean {
  const trail = TRAILS.find((t) => t.trailId === trailId);
  return !!trail && (trail.bikes as string[]).includes(kind);
}
