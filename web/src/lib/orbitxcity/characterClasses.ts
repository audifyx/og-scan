/** Character classes for OrbitX City selection pods (AAA art direction). */
import type { AvatarAppearance } from "./types";

export type CharacterClassId = "trader" | "builder" | "gamer" | "creator" | "explorer";

export interface CharacterStat {
  label: string;
  value: number; // 0–100
}

export interface CharacterClassDef {
  id: CharacterClassId;
  name: string;
  tagline: string;
  /** Neon pod / beam color */
  neon: string;
  /** Metallic gold accent for premium frames */
  gold: string;
  bodyColor: string;
  accentColor: string;
  skinColor: string;
  stats: CharacterStat[];
}

export const CHARACTER_CLASSES: CharacterClassDef[] = [
  {
    id: "trader",
    name: "Trader",
    tagline: "Market predator · execution first",
    neon: "#00ff9f",
    gold: "#c5a26f",
    bodyColor: "#12181f",
    accentColor: "#00ff9f",
    skinColor: "#e8d5c0",
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
    neon: "#39ff14",
    gold: "#b8924a",
    bodyColor: "#1a2418",
    accentColor: "#39ff14",
    skinColor: "#c9a07a",
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
    neon: "#00ff9f",
    gold: "#ffd700",
    bodyColor: "#141c28",
    accentColor: "#00ffc3",
    skinColor: "#f0d5b8",
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
    neon: "#7dffb0",
    gold: "#c5a26f",
    bodyColor: "#161e24",
    accentColor: "#7dffb0",
    skinColor: "#e8d5c0",
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
    bodyColor: "#101820",
    accentColor: "#00ff9f",
    skinColor: "#8d5524",
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

export function appearanceFromClass(cls: CharacterClassDef, name?: string): AvatarAppearance {
  return {
    name: name?.trim() || cls.name,
    bodyColor: cls.bodyColor,
    accentColor: cls.accentColor,
    skinColor: cls.skinColor,
    classId: cls.id,
    hairStyle: cls.id === "explorer" ? "long" : cls.id === "gamer" ? "mohawk" : "short",
    hairColor: cls.id === "creator" ? "#c5a26f" : "#151018",
    outfit: cls.id === "trader" ? "suit" : cls.id === "gamer" ? "sport" : cls.id === "builder" ? "street" : "neon",
    faceStyle: cls.id === "creator" ? "smile" : "cool",
  };
}
