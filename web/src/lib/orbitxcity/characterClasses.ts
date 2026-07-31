/** Character classes for OrbitX City — distinct silhouettes + palettes. */
import type { AvatarAppearance } from "./types";

export type CharacterClassId = "trader" | "builder" | "gamer" | "creator" | "explorer";

export interface CharacterStat {
  label: string;
  value: number;
}

export interface CharacterClassDef {
  id: CharacterClassId;
  name: string;
  tagline: string;
  neon: string;
  gold: string;
  bodyColor: string;
  accentColor: string;
  skinColor: string;
  /** Relative body scale for in-world mesh differentiation */
  scale: { x: number; y: number; z: number };
  stats: CharacterStat[];
}

export const CHARACTER_CLASSES: CharacterClassDef[] = [
  {
    id: "trader",
    name: "Trader",
    tagline: "Market predator · execution first",
    neon: "#c5a26f",
    gold: "#e0c48a",
    bodyColor: "#1a1f2a",
    accentColor: "#c5a26f",
    skinColor: "#e8d5c0",
    scale: { x: 1, y: 1.02, z: 1 },
    stats: [
      { label: "Instinct", value: 92 },
      { label: "Speed", value: 78 },
      { label: "Risk", value: 86 },
      { label: "Focus", value: 80 },
    ],
  },
  {
    id: "builder",
    name: "Builder",
    tagline: "Systems · protocols · craft",
    neon: "#5b8def",
    gold: "#8eb0ff",
    bodyColor: "#243044",
    accentColor: "#5b8def",
    skinColor: "#c9a07a",
    scale: { x: 1.18, y: 1.05, z: 1.12 },
    stats: [
      { label: "Craft", value: 90 },
      { label: "Stamina", value: 84 },
      { label: "Vision", value: 72 },
      { label: "Focus", value: 88 },
    ],
  },
  {
    id: "gamer",
    name: "Gamer",
    tagline: "Arenas · streaks · clutch plays",
    neon: "#ff4d6a",
    gold: "#ffd700",
    bodyColor: "#1c1420",
    accentColor: "#ff4d6a",
    skinColor: "#f0d5b8",
    scale: { x: 0.92, y: 0.96, z: 0.92 },
    stats: [
      { label: "Reflex", value: 95 },
      { label: "Speed", value: 90 },
      { label: "Luck", value: 70 },
      { label: "Focus", value: 82 },
    ],
  },
  {
    id: "creator",
    name: "Creator",
    tagline: "Signal · culture · narrative",
    neon: "#b388ff",
    gold: "#c5a26f",
    bodyColor: "#2a1f36",
    accentColor: "#b388ff",
    skinColor: "#f2dcc8",
    scale: { x: 0.98, y: 1.04, z: 0.98 },
    stats: [
      { label: "Style", value: 93 },
      { label: "Reach", value: 85 },
      { label: "Charm", value: 88 },
      { label: "Focus", value: 74 },
    ],
  },
  {
    id: "explorer",
    name: "Explorer",
    tagline: "Frontier routes · discovery",
    neon: "#00ff9f",
    gold: "#d4af37",
    bodyColor: "#1e2a22",
    accentColor: "#3d9a6a",
    skinColor: "#8d5524",
    scale: { x: 1.04, y: 1.08, z: 1.04 },
    stats: [
      { label: "Range", value: 91 },
      { label: "Stamina", value: 87 },
      { label: "Instinct", value: 80 },
      { label: "Focus", value: 76 },
    ],
  },
];

export function getCharacterClass(id: CharacterClassId | string | undefined): CharacterClassDef {
  return CHARACTER_CLASSES.find((c) => c.id === id) ?? CHARACTER_CLASSES[0]!;
}

/** Live class perks used by InteractionMarkers / Map panel. */
export function hasGamerMarkerPerk(classId?: CharacterClassId | string | null): boolean {
  return classId === "gamer";
}

export function hasExplorerMapPerk(classId?: CharacterClassId | string | null): boolean {
  return classId === "explorer";
}

export function hasTraderTerminalPerk(classId?: CharacterClassId | string | null): boolean {
  return classId === "trader";
}

export function hasBuilderMissionPerk(classId?: CharacterClassId | string | null): boolean {
  return classId === "builder";
}

export function hasCreatorPresencePerk(classId?: CharacterClassId | string | null): boolean {
  return classId === "creator";
}

/** City-board claim cooldown. Builder at HQ is nearly instant. */
export function missionClaimCooldownMs(
  classId?: CharacterClassId | string | null,
  atHq = false,
): number {
  if (hasBuilderMissionPerk(classId)) return atHq ? 2_000 : 8_000;
  return 30_000;
}

export function appearanceFromClass(cls: CharacterClassDef, name?: string): AvatarAppearance {
  const hairByClass = {
    trader: { hairStyle: "short" as const, hairColor: "#2a2218" },
    builder: { hairStyle: "buzz" as const, hairColor: "#1a1814" },
    gamer: { hairStyle: "mohawk" as const, hairColor: cls.accentColor },
    creator: { hairStyle: "bun" as const, hairColor: "#c5a26f" },
    explorer: { hairStyle: "long" as const, hairColor: "#3a2410" },
  }[cls.id];

  const outfitByClass = {
    trader: "suit" as const,
    builder: "street" as const,
    gamer: "sport" as const,
    creator: "neon" as const,
    explorer: "street" as const,
  }[cls.id];

  return {
    name: name?.trim() || cls.name,
    bodyColor: cls.bodyColor,
    accentColor: cls.accentColor,
    skinColor: cls.skinColor,
    classId: cls.id,
    hairStyle: hairByClass.hairStyle,
    hairColor: hairByClass.hairColor,
    outfit: outfitByClass,
    faceStyle: cls.id === "creator" ? "smile" : cls.id === "gamer" ? "cool" : "neutral",
  };
}
