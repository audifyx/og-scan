import { NYC_DEMO_BLOCK, buildingColliders } from "./demoBlock";

const boxes = buildingColliders(NYC_DEMO_BLOCK);
const { bounds } = NYC_DEMO_BLOCK;

/** 2D collision against building AABBs + world bounds. */
export function collidesAt(x: number, z: number, radius = 0.45): boolean {
  for (const b of boxes) {
    if (x + radius > b.minX && x - radius < b.maxX && z + radius > b.minZ && z - radius < b.maxZ) {
      return true;
    }
  }
  return x < bounds.minX || x > bounds.maxX || z < bounds.minZ || z > bounds.maxZ;
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

const cameraSolids = [
  ...NYC_DEMO_BLOCK.buildings.map((b) => ({
    minX: b.position.x - b.size.width / 2 - 0.3,
    maxX: b.position.x + b.size.width / 2 + 0.3,
    minZ: b.position.z - b.size.depth / 2 - 0.3,
    maxZ: b.position.z + b.size.depth / 2 + 0.3,
    minY: 0,
    maxY: b.size.height + 0.7,
  })),
  // Billboards are rotated thin planes — use a conservative square footprint
  // so the chase camera never parks inside their neon glow.
  ...NYC_DEMO_BLOCK.billboards.map((bb) => {
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

/** 3D point-in-solid test used for chase-camera occlusion. */
export function pointInBuilding(x: number, y: number, z: number): boolean {
  for (const s of cameraSolids) {
    if (x > s.minX && x < s.maxX && z > s.minZ && z < s.maxZ && y > s.minY && y < s.maxY) return true;
  }
  return false;
}

/** Random walkable point inside the block (NPC waypoints, coin spawns). */
export function randomOpenPoint(rand: () => number, margin = 3): { x: number; z: number } {
  for (let i = 0; i < 24; i++) {
    const x = bounds.minX + margin + rand() * (bounds.maxX - bounds.minX - margin * 2);
    const z = bounds.minZ + margin + rand() * (bounds.maxZ - bounds.minZ - margin * 2);
    if (!collidesAt(x, z, 0.9)) return { x, z };
  }
  return { x: 0, z: 6 };
}
