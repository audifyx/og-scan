import { getWorldStreets } from "./worlds";
import { collidesAt, mulberry32, randomOpenPoint } from "./collision";
import type { CityId, StreetSegment, WorldBlockConfig } from "./types";

/**
 * OrbitX City — mission definitions (Worker 3).
 *
 * All coordinates are COMPUTED from the active WorldBlockConfig (spawn,
 * bounds, streets) — nothing is hardcoded to a single city. Seeded RNG keeps
 * layouts stable per city so markers don't jump between sessions.
 */

export type ObjectiveKind = "goto" | "checkpoint" | "pickup" | "dropoff" | "collect";

export interface ObjectiveDef {
  kind: ObjectiveKind;
  label: string;
  x: number;
  z: number;
  /** Arrival radius in meters. */
  radius: number;
  /** For "collect": how many to gather. */
  count?: number;
}

export interface MissionDef {
  id: string;
  name: string;
  tagline: string;
  briefing: string;
  payout: number;
  /** Seconds allowed; 0 = no timer. */
  timeLimit: number;
  color: string;
  icon: string;
  /** Where the mission starts (green beacon). */
  start: { x: number; z: number; label: string };
  objectives: ObjectiveDef[];
}

export interface MissionInstance {
  defId: string;
  startedAt: number;
  deadline: number; // 0 = no timer
  objectiveIndex: number;
  /** Collector: shards banked when the mission started. */
  shardsAtStart: number;
  /** Collector: shards gathered so far. */
  progress: number;
}

function streetPoint(s: StreetSegment, t: number, lane = 0): { x: number; z: number } {
  const a = s.from + (s.to - s.from) * t;
  if (s.o === "h") return { x: a, z: s.at + lane };
  return { x: s.at + lane, z: a };
}

function streetLen(s: StreetSegment): number {
  return Math.abs(s.to - s.from);
}

/** Offset a point off the roadway so beacons sit on walkable ground. */
function roadside(
  x: number,
  z: number,
  block: WorldBlockConfig,
  rand: () => number,
): { x: number; z: number } {
  for (let i = 0; i < 24; i++) {
    const a = rand() * Math.PI * 2;
    const r = 4 + rand() * 6;
    const px = x + Math.cos(a) * r;
    const pz = z + Math.sin(a) * r;
    if (
      px > block.bounds.minX + 2 &&
      px < block.bounds.maxX - 2 &&
      pz > block.bounds.minZ + 2 &&
      pz < block.bounds.maxZ - 2 &&
      !collidesAt(px, pz, 0.8, block)
    ) {
      return { x: px, z: pz };
    }
  }
  const p = randomOpenPoint(rand, 3, block);
  return { x: p.x, z: p.z };
}

function farStreetEnd(
  streets: StreetSegment[],
  fromX: number,
  fromZ: number,
): { x: number; z: number } {
  let best: { x: number; z: number } | null = null;
  let bestD = -1;
  for (const s of streets) {
    if (streetLen(s) < 14) continue;
    for (const t of [0.06, 0.94]) {
      const p = streetPoint(s, t);
      const d = Math.hypot(p.x - fromX, p.z - fromZ);
      if (d > bestD) {
        bestD = d;
        best = p;
      }
    }
  }
  return best ?? { x: fromX + 40, z: fromZ };
}

/** Build the 4 launch missions for the given city block. */
export function buildMissionDefs(block: WorldBlockConfig, cityId: CityId): MissionDef[] {
  const streets = getWorldStreets(cityId).filter((s) => streetLen(s) >= 14);
  const rand = mulberry32(
    [...cityId].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7),
  );
  const spawn = block.spawn;

  // --- Delivery: depot near spawn → farthest street end ---
  const depot = roadside(spawn.x + 6, spawn.z + 4, block, rand);
  const dropRaw = farStreetEnd(streets, depot.x, depot.z);
  const drop = roadside(dropRaw.x, dropRaw.z, block, rand);

  // --- Race: checkpoints along the longest streets, in order ---
  const sorted = [...streets].sort((a, b) => streetLen(b) - streetLen(a)).slice(0, 5);
  const racePoints: ObjectiveDef[] = sorted.map((s, i) => {
    const p = streetPoint(s, 0.25 + 0.12 * i);
    const rs = roadside(p.x, p.z, block, rand);
    return {
      kind: "checkpoint",
      label: `Checkpoint ${i + 1}/${sorted.length}`,
      x: rs.x,
      z: rs.z,
      radius: 5,
    };
  });

  // --- Taxi: pickup on a random street → dropoff across town ---
  const taxiStreet = streets.length
    ? streets[Math.floor(rand() * streets.length)]!
    : null;
  const pickupRaw = taxiStreet ? streetPoint(taxiStreet, 0.3 + rand() * 0.4) : { x: spawn.x + 20, z: spawn.z };
  const pickup = roadside(pickupRaw.x, pickupRaw.z, block, rand);
  const taxiDropRaw = farStreetEnd(streets, pickup.x, pickup.z);
  const taxiDrop = roadside(taxiDropRaw.x, taxiDropRaw.z, block, rand);

  // --- Collector: shards anywhere, start at the plaza beacon ---
  const plaza = roadside(spawn.x - 4, spawn.z - 6, block, rand);

  return [
    {
      id: "midtown-drop",
      name: "Midtown Drop",
      tagline: "Courier run across the district",
      briefing:
        "A client needs a sealed package moved across the district — no questions, no stops. Reach the gold drop-off beacon before the timer burns out. On foot or behind the wheel, your call.",
      payout: 250,
      timeLimit: 100,
      color: "#ffd23f",
      icon: "📦",
      start: { x: depot.x, z: depot.z, label: "Pickup depot" },
      objectives: [
        { kind: "dropoff", label: "Deliver the package", x: drop.x, z: drop.z, radius: 4.5 },
      ],
    },
    {
      id: "neon-sprint",
      name: "Neon Sprint",
      tagline: `${racePoints.length}-checkpoint street race`,
      briefing:
        "The underground racing crew marked a sprint through the district. Hit every checkpoint IN ORDER before the clock dies. Miss the line and the run is void.",
      payout: 400,
      timeLimit: 150,
      color: "#3de7ff",
      icon: "🏁",
      start: { x: racePoints[0]?.x ?? spawn.x, z: racePoints[0]?.z ?? spawn.z, label: "Start line" },
      objectives: racePoints,
    },
    {
      id: "shard-rush",
      name: "Shard Rush",
      tagline: "Sweep the district for OBX shards",
      briefing:
        "Shards are scattered all over the district and the collectors' market is hot. Grab 6 coin shards before time runs out — every shard you bank counts.",
      payout: 300,
      timeLimit: 180,
      color: "#17ff4d",
      icon: "💠",
      start: { x: plaza.x, z: plaza.z, label: "Rush beacon" },
      objectives: [
        { kind: "collect", label: "Collect 6 shards", x: plaza.x, z: plaza.z, radius: 4, count: 6 },
      ],
    },
    {
      id: "cab-runner",
      name: "Cab Runner",
      tagline: "Fare across town",
      briefing:
        "A fare is waiting at the pickup beacon and they're already late. Get them in the car (or on foot — no judgment), then run them to the destination before the meter runs dry.",
      payout: 350,
      timeLimit: 150,
      color: "#ff7a9a",
      icon: "🚕",
      start: { x: pickup.x, z: pickup.z, label: "Waiting fare" },
      objectives: [
        { kind: "pickup", label: "Pick up the fare", x: pickup.x, z: pickup.z, radius: 4 },
        { kind: "dropoff", label: "Drop off the fare", x: taxiDrop.x, z: taxiDrop.z, radius: 4.5 },
      ],
    },
  ];
}

export function currentObjective(def: MissionDef, instance: MissionInstance): ObjectiveDef | null {
  return def.objectives[instance.objectiveIndex] ?? null;
}

export function objectiveProgressLabel(def: MissionDef, instance: MissionInstance): string {
  const obj = currentObjective(def, instance);
  if (!obj) return "Done";
  if (obj.kind === "collect" && obj.count) {
    return `${obj.label} · ${Math.min(instance.progress, obj.count)}/${obj.count}`;
  }
  if (def.objectives.length > 1) {
    return `${obj.label} (${instance.objectiveIndex + 1}/${def.objectives.length})`;
  }
  return obj.label;
}
