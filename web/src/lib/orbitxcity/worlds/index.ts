import { NYC_DEMO_BLOCK, STREETS, TELEPORT_POINTS } from "../demoBlock";
import type { CityId, StreetSegment, WorldBlockConfig } from "../types";
import { BOSTON_BLOCK, BOSTON_STREETS, BOSTON_TELEPORT_POINTS } from "./bostonBlock";
import { LA_BLOCK, LA_STREETS, LA_TELEPORT_POINTS } from "./laBlock";
import { MIAMI_BLOCK, MIAMI_STREETS, MIAMI_TELEPORT_POINTS } from "./miamiBlock";

export { BOSTON_BLOCK, BOSTON_STREETS, BOSTON_TELEPORT_POINTS } from "./bostonBlock";
export { LA_BLOCK, LA_STREETS, LA_TELEPORT_POINTS } from "./laBlock";
export { MIAMI_BLOCK, MIAMI_STREETS, MIAMI_TELEPORT_POINTS } from "./miamiBlock";

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
    default:
      return TELEPORT_POINTS;
  }
}

export function getWorldSize(block: WorldBlockConfig): number {
  return Math.max(block.bounds.maxX - block.bounds.minX, block.bounds.maxZ - block.bounds.minZ);
}
