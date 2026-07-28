import { NYC_DEMO_BLOCK } from "./demoBlock";
import { furnitureSolids, resolveRoomTheme } from "./interiorLayout";
import type { BuildingDefinition, WorldBlockConfig } from "./types";

export function interiorMetrics(building: BuildingDefinition) {
  const width = Math.max(5.2, Math.min(14, building.size.width - 0.8));
  const depth = Math.max(5.2, Math.min(14, building.size.depth - 0.8));
  const theme = resolveRoomTheme(building);
  return { width, depth, theme, solids: furnitureSolids(theme, width, depth) };
}

/** Depth of the passable south doorway slot carved out of a facade. */
const DOOR_GAP_DEPTH = 1.6;

/** Structural kinds that represent designed, enterable OrbitX venues. */
const VENUE_KINDS = new Set<string>([
  "hq",
  "market",
  "trading_floor",
  "social_hub",
  "launch_arena",
  "ad_tower",
  "shop",
]);

/**
 * A building is "walk-in" (has a physical doorway you can stroll through) only
 * when it is a designed venue — one with a venue interaction or a venue kind.
 * Generic city/OSM fill buildings stay solid so the player never auto-enters
 * arbitrary structures while walking the streets.
 */
export function isWalkInBuilding(b: BuildingDefinition): boolean {
  return Boolean(b.interaction) || VENUE_KINDS.has(b.kind);
}

/** Physical door opening width — shared by facade geometry and collision gap. */
export function buildingDoorWidth(b: BuildingDefinition): number {
  return Math.min(2.8, Math.max(1.8, b.size.width * 0.3));
}

/** World-space south face + doorway of a walk-in building. */
export function buildingDoorway(b: BuildingDefinition) {
  return {
    cx: b.position.x,
    faceZ: b.position.z + b.size.depth / 2,
    halfDoor: buildingDoorWidth(b) / 2,
  };
}

/** True when point (x,z) sits inside the open south doorway slot of `b`. */
function inDoorwaySlot(x: number, z: number, radius: number, b: BuildingDefinition): boolean {
  if (!isWalkInBuilding(b)) return false;
  const { cx, faceZ, halfDoor } = buildingDoorway(b);
  return Math.abs(x - cx) + radius <= halfDoor && z + radius > faceZ - DOOR_GAP_DEPTH;
}

/** 2D collision against building AABBs + world bounds, with south doorway gaps. */
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
      // Interactive facades have a real doorway gap: the surrounding wall stays
      // solid, but the centred south opening is passable so the player can walk
      // through it (the movement loop then triggers the interior transition).
      if (inDoorwaySlot(x, z, radius, b)) continue;
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
  const { width, depth, theme, solids } = interiorMetrics(building);
  const localX = x - building.position.x;
  const localZ = z - building.position.z;
  const halfW = width / 2;
  const halfD = depth / 2;
  const wall = 0.28;
  const halfDoor = buildingDoorWidth(building) / 2;

  // West / east / north walls are always solid.
  if (
    localX - radius < -halfW + wall ||
    localX + radius > halfW - wall ||
    localZ - radius < -halfD + wall
  ) {
    return true;
  }
  // South wall is solid except for the centred exit doorway, so the player can
  // walk back out the same opening they entered through.
  if (localZ + radius > halfD - wall) {
    const inDoor = Math.abs(localX) + radius <= halfDoor;
    if (!inDoor || localZ + radius > halfD + 0.7) return true;
  }

  if (theme === "launch" && Math.hypot(localX, localZ + 0.15) < 1.45 + radius) {
    return true;
  }

  return solids.some(
    (s) =>
      localX + radius > s.x - s.w / 2 &&
      localX - radius < s.x + s.w / 2 &&
      localZ + radius > s.z - s.d / 2 &&
      localZ - radius < s.z + s.d / 2,
  );
}

/**
 * Detect the player crossing a building's front threshold, walking inward
 * (south → north, i.e. decreasing z) through the door opening. Used by the
 * movement loop to trigger the interior transition exactly once per crossing.
 */
export function crossedEntryDoorway(
  prevZ: number,
  nextZ: number,
  x: number,
  b: BuildingDefinition,
): boolean {
  if (!isWalkInBuilding(b)) return false;
  const { cx, faceZ, halfDoor } = buildingDoorway(b);
  return prevZ > faceZ && nextZ <= faceZ && Math.abs(x - cx) <= halfDoor;
}

/**
 * Detect the player walking back out through the interior's south exit doorway
 * (north → south, increasing z past the interior wall).
 */
export function crossedExitDoorway(
  prevZ: number,
  nextZ: number,
  x: number,
  b: BuildingDefinition,
): boolean {
  const { depth } = interiorMetrics(b);
  const faceZ = b.position.z + depth / 2;
  const halfDoor = buildingDoorWidth(b) / 2;
  return prevZ <= faceZ && nextZ > faceZ && Math.abs(x - b.position.x) <= halfDoor;
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
