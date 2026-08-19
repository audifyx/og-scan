import type {
  BuildingDefinition,
  HudPanel,
  OutfitStyle,
} from "./types";
import type { CharacterClassId, LegacyClassId } from "./characterClasses";

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

export type InteriorNpcRole = "vendor" | "patron" | "staff";

/** Local-space crowd slot inside a walk-in venue. */
export interface InteriorNpcSlot {
  id: string;
  role: InteriorNpcRole;
  x: number;
  z: number;
  rotY: number;
  classId: CharacterClassId | LegacyClassId;
  outfit: OutfitStyle;
  /** Idle speech bubble lines (cycled). */
  lines: string[];
  /** Vendor interaction — E opens this panel when nearby. */
  panel?: HudPanel;
  vendorLabel?: string;
  vendorHint?: string;
  /** Club / theater patrons bob to the beat. */
  dancing?: boolean;
}

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

/**
 * Theme-matched NPCs + one vendor per room. Positions stay clear of the south doorway
 * (±1.4 on X near +depth/2) so walk-in/out stays open.
 */
export function interiorNpcSlots(theme: RoomTheme, width: number, depth: number): InteriorNpcSlot[] {
  const wallZ = -depth / 2 + 1.15;
  const midZ = -depth * 0.05;
  const side = Math.min(width / 2 - 1.25, 2.9);
  const doorClearZ = depth / 2 - 2.1;

  switch (theme) {
    case "trade":
      return [
        {
          id: "desk-trader",
          role: "vendor",
          x: 0,
          z: wallZ + 0.35,
          rotY: Math.PI,
          classId: "trader",
          outfit: "suit",
          lines: ["Tape is hot", "Size in carefully", "Liquidity looks clean"],
          panel: "trading",
          vendorLabel: "Floor desk",
          vendorHint: "E · open trading tools",
        },
        {
          id: "side-scout",
          role: "patron",
          x: -side * 0.85,
          z: midZ,
          rotY: Math.PI / 2,
          classId: "explorer",
          outfit: "street",
          lines: ["Charts look spicy", "Don't chase the wick"],
        },
        {
          id: "chart-watcher",
          role: "patron",
          x: side * 0.85,
          z: midZ + 0.2,
          rotY: -Math.PI / 2,
          classId: "gamer",
          outfit: "sport",
          lines: ["Clutch entry", "I'm long bias"],
        },
      ];
    case "market":
      return [
        {
          id: "cashier",
          role: "vendor",
          x: 0,
          z: 0.35,
          rotY: Math.PI,
          classId: "trader",
          outfit: "street",
          lines: ["Fresh mints up front", "Bags or browse?"],
          panel: "marketplace",
          vendorLabel: "Market cashier",
          vendorHint: "E · open marketplace",
        },
        {
          id: "stall-left",
          role: "staff",
          x: -side * 0.7,
          z: wallZ + 0.25,
          rotY: Math.PI,
          classId: "creator",
          outfit: "neon",
          lines: ["Limited drops only", "Scan before you ape"],
        },
        {
          id: "browser",
          role: "patron",
          x: side * 0.55,
          z: doorClearZ - 0.4,
          rotY: -0.4,
          classId: "builder",
          outfit: "street",
          lines: ["Need a holder key", "Floor looks healthy"],
        },
      ];
    case "club":
      return [
        {
          id: "bartender",
          role: "vendor",
          x: 0,
          z: wallZ + 0.2,
          rotY: Math.PI,
          classId: "creator",
          outfit: "neon",
          lines: ["Voice booths live", "gm — grab a seat"],
          panel: "voice",
          vendorLabel: "Pulse bartender",
          vendorHint: "E · open voice plaza",
        },
        {
          id: "dancer-a",
          role: "patron",
          x: -side * 0.55,
          z: midZ,
          rotY: 0.6,
          classId: "gamer",
          outfit: "sport",
          lines: ["This drop slaps", "LFG"],
          dancing: true,
        },
        {
          id: "dancer-b",
          role: "patron",
          x: side * 0.55,
          z: midZ + 0.15,
          rotY: -0.5,
          classId: "creator",
          outfit: "neon",
          lines: ["Stream is live", "Say gm in chat"],
          dancing: true,
        },
      ];
    case "hq":
      return [
        {
          id: "front-desk",
          role: "vendor",
          x: 0,
          z: depth / 2 - 2.55,
          rotY: Math.PI,
          classId: "builder",
          outfit: "suit",
          lines: ["Welcome to OrbitX HQ", "Missions at the desk"],
          panel: "missions",
          vendorLabel: "HQ front desk",
          vendorHint: "E · claim missions",
        },
        {
          id: "ops-left",
          role: "staff",
          x: -side * 0.75,
          z: 0.15,
          rotY: Math.PI / 2,
          classId: "trader",
          outfit: "suit",
          lines: ["DEX rails green", "Launch queue clear"],
        },
        {
          id: "ops-right",
          role: "staff",
          x: side * 0.75,
          z: 0.15,
          rotY: -Math.PI / 2,
          classId: "explorer",
          outfit: "street",
          lines: ["Map is updated", "Midtown is online"],
        },
      ];
    case "launch":
      return [
        {
          id: "stage-host",
          role: "vendor",
          x: 0,
          z: -0.35,
          rotY: Math.PI,
          classId: "gamer",
          outfit: "sport",
          lines: ["Next launch in queue", "Stage is hot"],
          panel: "launch",
          vendorLabel: "Launch host",
          vendorHint: "E · open launchpad",
        },
        {
          id: "hype-a",
          role: "patron",
          x: -side * 0.7,
          z: wallZ + 0.4,
          rotY: 0.3,
          classId: "creator",
          outfit: "neon",
          lines: ["Aped already", "Don't miss the open"],
        },
        {
          id: "hype-b",
          role: "patron",
          x: side * 0.7,
          z: wallZ + 0.4,
          rotY: -0.3,
          classId: "trader",
          outfit: "suit",
          lines: ["Size wisely", "I'm watching the curve"],
        },
      ];
    case "theater":
      return [
        {
          id: "arcade-host",
          role: "vendor",
          x: side * 0.85,
          z: wallZ + 0.5,
          rotY: -Math.PI / 2,
          classId: "gamer",
          outfit: "sport",
          lines: ["Queues open", "Ranked heat check"],
          panel: "games",
          vendorLabel: "Games host",
          vendorHint: "E · open games",
        },
        {
          id: "seat-a",
          role: "patron",
          x: -1.1,
          z: 0.55,
          rotY: Math.PI,
          classId: "explorer",
          outfit: "street",
          lines: ["This trailer hits", "Pass the controller"],
        },
        {
          id: "seat-b",
          role: "patron",
          x: 1.1,
          z: 0.55,
          rotY: Math.PI,
          classId: "creator",
          outfit: "neon",
          lines: ["Clip that moment", "W streak loading"],
          dancing: true,
        },
      ];
    case "lounge":
      return [
        {
          id: "host",
          role: "vendor",
          x: 0,
          z: wallZ + 0.25,
          rotY: Math.PI,
          classId: "creator",
          outfit: "neon",
          lines: ["Community desk open", "Pull up a seat"],
          panel: "community",
          vendorLabel: "Lounge host",
          vendorHint: "E · open social tools",
        },
        {
          id: "sofa-a",
          role: "patron",
          x: -side * 0.55,
          z: -0.05,
          rotY: Math.PI * 0.15,
          classId: "builder",
          outfit: "street",
          lines: ["gm ser", "Building in public"],
        },
        {
          id: "sofa-b",
          role: "patron",
          x: side * 0.55,
          z: -0.05,
          rotY: -Math.PI * 0.15,
          classId: "trader",
          outfit: "suit",
          lines: ["Quiet before the storm", "Coffee then charts"],
        },
      ];
    default:
      return [
        {
          id: "concierge",
          role: "vendor",
          x: 0,
          z: wallZ + 0.2,
          rotY: Math.PI,
          classId: "explorer",
          outfit: "street",
          lines: ["Need directions?", "Map has fast travel"],
          panel: "map",
          vendorLabel: "Concierge",
          vendorHint: "E · open world map",
        },
        {
          id: "waiting",
          role: "patron",
          x: -side * 0.65,
          z: 0.35,
          rotY: 0.4,
          classId: "builder",
          outfit: "street",
          lines: ["Waiting on a friend", "City feels alive"],
        },
      ];
  }
}

