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
  if (id.includes("cinema") || id.includes("theater") || id.includes("theatre") || name.includes("theatre") || name.includes("theater")) {
    return "theater";
  }
  if (id.includes("coffee") || interaction === "community" || building.kind === "social_hub") return "lounge";
  if (interaction === "trading" || building.kind === "trading_floor") return "trade";
  if (interaction === "marketplace" || building.kind === "market" || building.kind === "shop") return "market";
  if (interaction === "hq" || building.kind === "hq") return "hq";
  if (interaction === "launch" || building.kind === "launch_arena") return "launch";
  return "lobby";
}

export function panelForBuilding(building: BuildingDefinition): HudPanel {
  const map: Record<string, HudPanel> = {
    hq: "map",
    marketplace: "marketplace",
    launch: "launch",
    trading: "trading",
    community: "community",
    billboard: "live",
    voice: "voice",
    games: "games",
    nft: "nft",
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
      return "NOW SHOWING · ORBITX";
    case "hq":
      return "ORBITX HQ · OPS";
    case "launch":
      return "LAUNCH ARENA";
    default:
      return (building.label ?? building.name).toUpperCase();
  }
}

/** Collision solids in local room space — keep walkways open near the south door. */
export function furnitureSolids(theme: RoomTheme, width: number, depth: number): FurnitureSolid[] {
  const wallZ = -depth / 2 + 0.85;
  const side = Math.min(width / 2 - 1.1, 3.2);
  switch (theme) {
    case "trade":
      return [
        { x: -side * 0.7, z: wallZ + 0.2, w: 1.4, d: 0.9 },
        { x: 0, z: wallZ + 0.2, w: 1.4, d: 0.9 },
        { x: side * 0.7, z: wallZ + 0.2, w: 1.4, d: 0.9 },
        { x: -side, z: 0.1, w: 0.9, d: 0.9 },
        { x: side, z: 0.1, w: 0.9, d: 0.9 },
      ];
    case "lounge":
      return [
        { x: -side * 0.55, z: -0.35, w: 1.8, d: 0.95 },
        { x: side * 0.55, z: -0.35, w: 1.8, d: 0.95 },
        { x: 0, z: wallZ + 0.15, w: 1.6, d: 0.7 },
        { x: -side, z: 0.6, w: 0.7, d: 0.7 },
        { x: side, z: 0.6, w: 0.7, d: 0.7 },
      ];
    case "market":
      return [
        { x: 0, z: wallZ + 0.1, w: Math.min(width - 1.4, 4.2), d: 0.85 },
        { x: -side, z: -0.1, w: 0.95, d: 0.85 },
        { x: side, z: -0.1, w: 0.95, d: 0.85 },
        { x: -side * 0.4, z: 0.55, w: 0.8, d: 0.8 },
      ];
    case "club":
      return [
        { x: 0, z: wallZ + 0.2, w: Math.min(width - 1.6, 3.6), d: 0.8 },
        { x: -side, z: 0.2, w: 0.85, d: 0.85 },
        { x: side, z: 0.2, w: 0.85, d: 0.85 },
      ];
    case "theater":
      return [
        { x: -1.2, z: 0.35, w: 0.95, d: 0.85 },
        { x: 0, z: 0.55, w: 0.95, d: 0.85 },
        { x: 1.2, z: 0.35, w: 0.95, d: 0.85 },
        { x: 0, z: wallZ + 0.05, w: Math.min(width - 1.2, 5.2), d: 0.35 },
      ];
    case "hq":
      return [
        { x: 0, z: wallZ + 0.15, w: Math.min(width - 1.3, 4.8), d: 1.0 },
        { x: -side, z: 0.15, w: 0.9, d: 0.9 },
        { x: side, z: 0.15, w: 0.9, d: 0.9 },
      ];
    case "launch":
      return [
        { x: 0, z: -0.15, w: 2.6, d: 2.6 },
        { x: -side, z: wallZ + 0.3, w: 0.9, d: 0.9 },
        { x: side, z: wallZ + 0.3, w: 0.9, d: 0.9 },
      ];
    default:
      return [
        { x: 0, z: wallZ + 0.2, w: Math.min(width - 1.4, 3.6), d: 0.9 },
        { x: -side * 0.75, z: 0.2, w: 0.9, d: 0.9 },
        { x: side * 0.75, z: 0.2, w: 0.9, d: 0.9 },
      ];
  }
}
