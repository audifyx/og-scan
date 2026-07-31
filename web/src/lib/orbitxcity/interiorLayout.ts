import type { BuildingDefinition, HudPanel } from "./types";

export type RoomTheme =
  | "trade"
  | "lounge"
  | "market"
  | "club"
  | "theater"
  | "hq"
  | "launch"
  | "lobby";

export type FurnitureSolid = { x: number; z: number; w: number; d: number };

/** Pick a furnished room template from venue role / OSM interaction / id. */
export function resolveRoomTheme(building: BuildingDefinition): RoomTheme {
  const id = building.id.toLowerCase();
  const name = building.name.toLowerCase();
  const interaction = building.interaction;

  if (id.includes("club") || interaction === "voice") return "club";
  if (id.includes("casino") || id.includes("arcade") || interaction === "games") return "theater";
  if (
    id.includes("cinema") ||
    id.includes("theater") ||
    id.includes("theatre") ||
    name.includes("theatre") ||
    name.includes("theater")
  ) {
    return "theater";
  }
  if (id.includes("coffee") || interaction === "community" || building.kind === "social_hub") return "lounge";
  if (interaction === "trading" || interaction === "billboard" || building.kind === "trading_floor") return "trade";
  if (
    interaction === "marketplace" ||
    interaction === "token" ||
    building.kind === "market" ||
    building.kind === "shop"
  ) {
    return "market";
  }
  if (interaction === "hq" || building.kind === "hq") return "hq";
  if (interaction === "launch" || building.kind === "launch_arena") return "launch";
  if (interaction === "nft") return "theater";
  return "lobby";
}

export function panelForBuilding(building: BuildingDefinition): HudPanel {
  const map: Record<string, HudPanel> = {
    hq: "live",
    marketplace: "marketplace",
    launch: "launch",
    trading: "trading",
    community: "community",
    billboard: "live",
    voice: "voice",
    games: "games",
    nft: "nft",
    token: "token",
  };
  if (building.interaction && map[building.interaction]) return map[building.interaction]!;
  switch (resolveRoomTheme(building)) {
    case "trade":
      return "trading";
    case "market":
      return "marketplace";
    case "lounge":
      return "community";
    case "club":
      return "voice";
    case "theater":
      return "games";
    case "hq":
      return "map";
    case "launch":
      return "launch";
    default:
      return "live";
  }
}

export function roomTitle(theme: RoomTheme, building: BuildingDefinition): string {
  switch (theme) {
    case "trade":
      return "LIVE TRADING FLOOR";
    case "lounge":
      return "COMMUNITY LOUNGE";
    case "market":
      return `${building.label ?? "ORBITX"} MARKET`;
    case "club":
      return "PULSE · LIVE ROOM";
    case "theater":
      return "ORBITX SCREEN · PLAY";
    case "hq":
      return "ORBITX HQ · COMMAND FLOOR";
    case "launch":
      return "LAUNCH ARENA";
    default:
      return (building.label ?? building.name).toUpperCase();
  }
}

/** Collision solids in local room space — keep the south doorway clear (±1.4 on X). */
export function furnitureSolids(theme: RoomTheme, width: number, depth: number): FurnitureSolid[] {
  const wallZ = -depth / 2 + 0.7;
  const midZ = -depth * 0.08;
  const side = Math.min(width / 2 - 1.15, 3.2);
  switch (theme) {
    case "trade":
      return [
        { x: -side * 0.72, z: wallZ, w: 2.55, d: 0.9 },
        { x: side * 0.72, z: wallZ, w: 2.55, d: 0.9 },
        { x: -side * 0.55, z: midZ, w: 1.85, d: 0.85 },
        { x: side * 0.55, z: midZ, w: 1.85, d: 0.85 },
        { x: 0, z: wallZ + 1.1, w: 1.55, d: 0.8 },
        { x: -side, z: 0.55, w: 1.05, d: 0.75 },
        { x: side, z: 0.55, w: 1.05, d: 0.75 },
      ];
    case "lounge":
      return [
        { x: -side * 0.55, z: -0.15, w: 1.65, d: 0.9 },
        { x: side * 0.55, z: -0.15, w: 1.65, d: 0.9 },
        { x: 0, z: wallZ, w: Math.min(width - 1.6, 4.2), d: 0.95 },
        { x: -side, z: 0.55, w: 1.15, d: 0.85 },
        { x: side, z: 0.55, w: 1.15, d: 0.85 },
        { x: -side * 0.35, z: wallZ + 1.35, w: 1.2, d: 0.7 },
        { x: side * 0.35, z: wallZ + 1.35, w: 1.2, d: 0.7 },
      ];
    case "market":
      return [
        { x: -side * 0.75, z: wallZ + 0.1, w: 1.5, d: 1.05 },
        { x: 0, z: wallZ + 0.1, w: 1.5, d: 1.05 },
        { x: side * 0.75, z: wallZ + 0.1, w: 1.5, d: 1.05 },
        { x: -side * 0.55, z: midZ + 0.2, w: 1.35, d: 0.9 },
        { x: side * 0.55, z: midZ + 0.2, w: 1.35, d: 0.9 },
        { x: 0, z: 0.7, w: Math.min(width - 2.2, 2.8), d: 0.9 },
      ];
    case "club":
      return [
        { x: 0, z: wallZ, w: Math.min(width - 1.8, 4.4), d: 1.0 },
        { x: -side, z: 0.2, w: 1.15, d: 0.85 },
        { x: side, z: 0.2, w: 1.15, d: 0.85 },
        { x: -side * 0.45, z: midZ, w: 1.25, d: 0.75 },
        { x: side * 0.45, z: midZ, w: 1.25, d: 0.75 },
      ];
    case "theater":
      return [
        { x: -1.45, z: 0.35, w: 1.55, d: 0.85 },
        { x: 0, z: 0.35, w: 1.55, d: 0.85 },
        { x: 1.45, z: 0.35, w: 1.55, d: 0.85 },
        { x: -1.45, z: -0.85, w: 1.55, d: 0.85 },
        { x: 1.45, z: -0.85, w: 1.55, d: 0.85 },
        { x: side, z: wallZ + 0.35, w: 1.15, d: 0.85 },
      ];
    case "hq":
      return [
        { x: 0, z: wallZ, w: Math.min(width - 1.2, 5.6), d: 1.25 },
        { x: -side * 0.72, z: 0.1, w: 1.8, d: 0.95 },
        { x: side * 0.72, z: 0.1, w: 1.8, d: 0.95 },
        { x: -side, z: 0.9, w: 1.15, d: 0.85 },
        { x: side, z: 0.9, w: 1.15, d: 0.85 },
        { x: 0, z: -0.55, w: 2.2, d: 1.05 },
        { x: -side * 0.45, z: wallZ + 1.45, w: 1.25, d: 0.75 },
        { x: side * 0.45, z: wallZ + 1.45, w: 1.25, d: 0.75 },
      ];
    case "launch":
      return [
        { x: 0, z: -0.15, w: 2.9, d: 2.9 },
        { x: -side, z: wallZ + 0.15, w: 1.15, d: 0.85 },
        { x: side, z: wallZ + 0.15, w: 1.15, d: 0.85 },
        { x: -side * 0.55, z: 1.0, w: 1.1, d: 0.75 },
        { x: side * 0.55, z: 1.0, w: 1.1, d: 0.75 },
      ];
    default:
      return [
        { x: 0, z: wallZ, w: Math.min(width - 1.6, 4.0), d: 0.95 },
        { x: -side * 0.7, z: 0.25, w: 1.6, d: 0.85 },
        { x: side * 0.7, z: 0.25, w: 1.6, d: 0.85 },
        { x: -side, z: wallZ + 1.2, w: 1.1, d: 0.75 },
        { x: side, z: wallZ + 1.2, w: 1.1, d: 0.75 },
      ];
  }
}

export interface FurnitureSlot {
  path: string;
  x: number;
  z: number;
  rotY: number;
  scale: number;
}

/**
 * Place catalog furniture set into room slots along walls / lounge areas.
 * Paths come from FURNITURE_SETS; positions avoid the south doorway.
 */
export function furnitureSlots(
  theme: RoomTheme,
  width: number,
  depth: number,
  paths: readonly string[],
): FurnitureSlot[] {
  if (!paths.length) return [];
  const wallZ = -depth / 2 + 0.85;
  const side = Math.min(width / 2 - 1.1, 2.8);
  const presets: Array<{ x: number; z: number; rotY: number; scale: number }> = [
    { x: -side * 0.7, z: wallZ, rotY: 0, scale: 1 },
    { x: side * 0.7, z: wallZ, rotY: 0, scale: 1 },
    { x: 0, z: wallZ + 0.15, rotY: 0, scale: 1.05 },
    { x: -side, z: 0.35, rotY: Math.PI / 2, scale: 0.95 },
    { x: side, z: 0.35, rotY: -Math.PI / 2, scale: 0.95 },
    { x: -side * 0.45, z: -depth * 0.05, rotY: Math.PI * 0.15, scale: 0.92 },
    { x: side * 0.45, z: -depth * 0.05, rotY: -Math.PI * 0.15, scale: 0.92 },
    { x: 0, z: wallZ + 1.2, rotY: Math.PI, scale: 0.9 },
  ];
  if (theme === "lounge" || theme === "lobby") {
    presets[0] = { x: -side * 0.55, z: -0.15, rotY: Math.PI, scale: 1 };
    presets[1] = { x: side * 0.55, z: -0.15, rotY: Math.PI, scale: 1 };
    presets[5] = { x: -side * 0.35, z: wallZ + 1.4, rotY: 0, scale: 0.88 };
    presets[6] = { x: side * 0.35, z: wallZ + 1.4, rotY: 0, scale: 0.88 };
  }
  if (theme === "trade" || theme === "hq") {
    presets[5] = { x: -side * 0.55, z: -depth * 0.08, rotY: Math.PI / 2, scale: 0.95 };
    presets[6] = { x: side * 0.55, z: -depth * 0.08, rotY: -Math.PI / 2, scale: 0.95 };
  }
  if (theme === "launch") {
    presets[0] = { x: -side, z: wallZ, rotY: 0, scale: 0.9 };
    presets[1] = { x: side, z: wallZ, rotY: 0, scale: 0.9 };
    presets[2] = { x: 0, z: wallZ + 0.2, rotY: 0, scale: 0.85 };
  }
  if (theme === "market") {
    presets[5] = { x: -side * 0.5, z: 0.4, rotY: Math.PI, scale: 0.9 };
    presets[6] = { x: side * 0.5, z: 0.4, rotY: Math.PI, scale: 0.9 };
  }
  return paths.slice(0, presets.length).map((path, i) => {
    const p = presets[i]!;
    return { path, x: p.x, z: p.z, rotY: p.rotY, scale: p.scale };
  });
}

