import { NYC_DEMO_BLOCK } from "./demoBlock";
import type { BuildingDefinition, WorldBlockConfig } from "./types";

/** 2D collision against building AABBs + world bounds. */
export function collidesAt(
  x: number,
  z: number,
  radius = 0.45,
  block: WorldBlockConfig = NYC_DEMO_BLOCK,
  ignoreBuildingId?: string | null,
): boolean {
  const { bounds } = block;
  for (const b of block.buildings) {
    if (ignoreBuildingId && b.id === ignoreBuildingId) continue;
    const minX = b.position.x - b.size.width / 2;
    const maxX = b.position.x + b.size.width / 2;
    const minZ = b.position.z - b.size.depth / 2;
    const maxZ = b.position.z + b.size.depth / 2;
    if (x + radius > minX && x - radius < maxX && z + radius > minZ && z - radius < maxZ) {
      return true;
    }
  }
  return x < bounds.minX || x > bounds.maxX || z < bounds.minZ || z > bounds.maxZ;
}

/**
 * Collision for the active building interior. Coordinates are world-space so
 * this layers cleanly over exterior collision while the active shell is
 * ignored. It keeps players within the furnished room and makes counters /
 * stages solid without adding a heavyweight physics engine.
 */
export function collidesInInterior(
  x: number,
  z: number,
  radius: number,
  building: BuildingDefinition,
): boolean {
  const width = Math.max(4.5, building.size.width - 1.2);
  const depth = Math.max(4.5, building.size.depth - 1.2);
  const localX = x - building.position.x;
  const localZ = z - building.position.z;
  const halfW = width / 2;
  const halfD = depth / 2;
  const wall = 0.28;

  if (
    localX - radius < -halfW + wall ||
    localX + radius > halfW - wall ||
    localZ - radius < -halfD + wall ||
    localZ + radius > halfD - wall
  ) {
    return true;
  }

  const hitsRect = (cx: number, cz: number, w: number, d: number) =>
    localX + radius > cx - w / 2 &&
    localX - radius < cx + w / 2 &&
    localZ + radius > cz - d / 2 &&
    localZ - radius < cz + d / 2;

  switch (building.kind) {
    case "trading_floor":
      return [-1.8, 0, 1.8].some((deskX) => hitsRect(deskX, -0.35, 1.35, 0.72));
    case "launch_arena":
      return Math.hypot(localX, localZ + 0.1) < 1.55 + radius;
    case "social_hub":
      return [-1, 1].some((tableX) => hitsRect(tableX, -0.25, 1.25, 0.75));
    case "market":
    case "shop":
      return hitsRect(0, -0.2, Math.min(width - 1.2, 4.2), 0.72);
    case "hq":
      return hitsRect(0, -0.45, Math.min(width - 1.2, 5.4), 0.9);
    default:
      return hitsRect(0, -0.35, Math.min(width - 1.4, 3.8), 0.72);
  }
}

/** Deterministic PRNG so world decoration is stable across renders. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function cameraSolidsFor(block: WorldBlockConfig, ignoreBuildingId?: string | null) {
  return [
    ...block.buildings
      .filter((b) => !ignoreBuildingId || b.id !== ignoreBuildingId)
      .map((b) => ({
        minX: b.position.x - b.size.width / 2 - 0.3,
        maxX: b.position.x + b.size.width / 2 + 0.3,
        minZ: b.position.z - b.size.depth / 2 - 0.3,
        maxZ: b.position.z + b.size.depth / 2 + 0.3,
        minY: 0,
        maxY: b.size.height + 0.7,
      })),
    // Billboards are rotated thin planes — use a conservative square footprint
    // so the chase camera never parks inside their neon glow.
    ...block.billboards.map((bb) => {
      const half = bb.width / 2 + 0.4;
      return {
        minX: bb.position.x - half,
        maxX: bb.position.x + half,
        minZ: bb.position.z - half,
        maxZ: bb.position.z + half,
        minY: bb.position.y - bb.height / 2 - 0.5,
        maxY: bb.position.y + bb.height / 2 + 0.5,
      };
    }),
  ];
}

/** 3D point-in-solid test used for chase-camera occlusion. */
export function pointInBuilding(
  x: number,
  y: number,
  z: number,
  block: WorldBlockConfig = NYC_DEMO_BLOCK,
  ignoreBuildingId?: string | null,
): boolean {
  const cameraSolids = cameraSolidsFor(block, ignoreBuildingId);
  for (const s of cameraSolids) {
    if (x > s.minX && x < s.maxX && z > s.minZ && z < s.maxZ && y > s.minY && y < s.maxY) return true;
  }
  return false;
}

/** Random walkable point inside the block (NPC waypoints, coin spawns). */
export function randomOpenPoint(rand: () => number, margin = 3, block: WorldBlockConfig = NYC_DEMO_BLOCK): { x: number; z: number } {
  const { bounds } = block;
  for (let i = 0; i < 24; i++) {
    const x = bounds.minX + margin + rand() * (bounds.maxX - bounds.minX - margin * 2);
    const z = bounds.minZ + margin + rand() * (bounds.maxZ - bounds.minZ - margin * 2);
    if (!collidesAt(x, z, 0.9, block)) return { x, z };
  }
  return { x: block.spawn.x, z: block.spawn.z };
}
