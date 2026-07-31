import { NYC_DEMO_BLOCK, STREETS, TELEPORT_POINTS } from "../demoBlock";
import type { CityId, StreetSegment, Vec3, WorldBlockConfig } from "../types";
import { BOSTON_BLOCK, BOSTON_STREETS, BOSTON_TELEPORT_POINTS } from "./bostonBlock";
import { LA_BLOCK, LA_STREETS, LA_TELEPORT_POINTS } from "./laBlock";
import { MIAMI_BLOCK, MIAMI_STREETS, MIAMI_TELEPORT_POINTS } from "./miamiBlock";
import { NYC_OSM_BLOCK, NYC_OSM_STREETS, NYC_OSM_TELEPORT_POINTS, OSM_ATTRIBUTION } from "./nycOsmBlock";

export { BOSTON_BLOCK, BOSTON_STREETS, BOSTON_TELEPORT_POINTS } from "./bostonBlock";
export { LA_BLOCK, LA_STREETS, LA_TELEPORT_POINTS } from "./laBlock";
export { MIAMI_BLOCK, MIAMI_STREETS, MIAMI_TELEPORT_POINTS } from "./miamiBlock";
export { NYC_OSM_BLOCK, NYC_OSM_STREETS, NYC_OSM_TELEPORT_POINTS, OSM_ATTRIBUTION } from "./nycOsmBlock";

export type TeleportPoint = { id: string; label: string; x: number; z: number; accent: string };

export function getWorldBlock(cityId: CityId): WorldBlockConfig {
  switch (cityId) {
    case "miami":
      return MIAMI_BLOCK;
    case "la":
      return LA_BLOCK;
    case "boston":
      return BOSTON_BLOCK;
    case "nyc":
      return NYC_OSM_BLOCK;
    default:
      return NYC_DEMO_BLOCK;
  }
}

export function getWorldStreets(cityId: CityId): StreetSegment[] {
  switch (cityId) {
    case "miami":
      return MIAMI_STREETS;
    case "la":
      return LA_STREETS;
    case "boston":
      return BOSTON_STREETS;
    case "nyc":
      return NYC_OSM_STREETS;
    default:
      return STREETS;
  }
}

export function getTeleportPoints(cityId: CityId): TeleportPoint[] {
  switch (cityId) {
    case "miami":
      return MIAMI_TELEPORT_POINTS;
    case "la":
      return LA_TELEPORT_POINTS;
    case "boston":
      return BOSTON_TELEPORT_POINTS;
    case "nyc":
      return [...NYC_OSM_TELEPORT_POINTS];
    default:
      return TELEPORT_POINTS;
  }
}

export function getWorldSize(block: WorldBlockConfig): number {
  return Math.max(block.bounds.maxX - block.bounds.minX, block.bounds.maxZ - block.bounds.minZ);
}

export type NearestLandmark = { label: string; dist: number; kind: "zone" | "district" };

/** Nearest interaction zone (or district centroid) for HUD / minimap orientation. */
export function getNearestLandmark(block: WorldBlockConfig, pos: Vec3): NearestLandmark {
  let best: NearestLandmark | null = null;
  for (const z of block.zones) {
    const dist = Math.hypot(pos.x - z.position.x, pos.z - z.position.z);
    if (!best || dist < best.dist) best = { label: z.label, dist, kind: "zone" };
  }
  for (const d of block.districts) {
    const dist = Math.hypot(pos.x - d.center.x, pos.z - d.center.z);
    if (!best || dist < best.dist) best = { label: d.name, dist, kind: "district" };
  }
  return best ?? { label: block.name, dist: 0, kind: "district" };
}
