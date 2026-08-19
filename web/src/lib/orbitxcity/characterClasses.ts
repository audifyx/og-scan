/** Crypto-native playable mascots for OrbitX City. */
import type { AvatarAppearance } from "./types";

export type CharacterClassId = "pepe" | "wojak" | "chad" | "doge" | "anon";

/** Legacy class ids still stored on interiors / old sessions. */
export type LegacyClassId = "trader" | "builder" | "gamer" | "creator" | "explorer";

export const CLASS_ALIASES: Record<LegacyClassId, CharacterClassId> = {
  trader: "pepe",
  builder: "anon",
  gamer: "chad",
  creator: "wojak",
  explorer: "doge",
};

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
    id: "pepe",
    name: "Pepe",
    tagline: "The frog · degen tape reader",
    neon: "#5cb85c",
    gold: "#c5e07a",
    bodyColor: "#3d7a38",
    accentColor: "#c23b3b",
    skinColor: "#5cb85c",
    scale: { x: 1.08, y: 0.92, z: 1.08 },
    stats: [
      { label: "Instinct", value: 94 },
      { label: "Degen", value: 96 },
      { label: "Risk", value: 88 },
      { label: "Focus", value: 71 },
    ],
  },
  {
    id: "wojak",
    name: "Wojak",
    tagline: "Feels guy · culture layer",
    neon: "#e8b4c8",
    gold: "#c5a26f",
    bodyColor: "#6b7280",
    accentColor: "#e8b4c8",
    skinColor: "#f3d5c0",
    scale: { x: 0.94, y: 1.02, z: 0.94 },
    stats: [
      { label: "Feels", value: 98 },
      { label: "Reach", value: 84 },
      { label: "Cope", value: 90 },
      { label: "Focus", value: 62 },
    ],
  },
  {
    id: "chad",
    name: "Chad",
    tagline: "Gigachad · clutch heat checks",
    neon: "#f0c27a",
    gold: "#ffd700",
    bodyColor: "#1c1420",
    accentColor: "#d4a017",
    skinColor: "#d4a574",
    scale: { x: 1.22, y: 1.12, z: 1.1 },
    stats: [
      { label: "Aura", value: 99 },
      { label: "Reflex", value: 91 },
      { label: "Clutch", value: 93 },
      { label: "Focus", value: 80 },
    ],
  },
  {
    id: "doge",
    name: "Doge",
    tagline: "Such wow · frontier scout",
    neon: "#e8a54b",
    gold: "#f5d08a",
    bodyColor: "#d4893a",
    accentColor: "#c0392b",
    skinColor: "#e8a54b",
    scale: { x: 1.06, y: 0.88, z: 1.14 },
    stats: [
      { label: "Wow", value: 97 },
      { label: "Range", value: 88 },
      { label: "Stamina", value: 86 },
      { label: "Focus", value: 74 },
    ],
  },
  {
    id: "anon",
    name: "Anon",
    tagline: "Laser eyes · protocol maxi",
    neon: "#f7931a",
    gold: "#f5c542",
    bodyColor: "#111318",
    accentColor: "#f7931a",
    skinColor: "#f4f1ea",
    scale: { x: 1.02, y: 1.06, z: 1.02 },
    stats: [
      { label: "Craft", value: 91 },
      { label: "Conviction", value: 95 },
      { label: "Stamina", value: 82 },
      { label: "Focus", value: 90 },
    ],
  },
];

export function isCharacterClassId(value: string | undefined | null): value is CharacterClassId {
  return value === "pepe" || value === "wojak" || value === "chad" || value === "doge" || value === "anon";
}

export function resolveClassId(id: string | undefined | null): CharacterClassId {
  if (isCharacterClassId(id)) return id;
  if (id && id in CLASS_ALIASES) return CLASS_ALIASES[id as LegacyClassId];
  return "pepe";
}

export function getCharacterClass(id: CharacterClassId | string | undefined): CharacterClassDef {
  return CHARACTER_CLASSES.find((c) => c.id === resolveClassId(id)) ?? CHARACTER_CLASSES[0]!;
}

export function hasGamerMarkerPerk(classId?: CharacterClassId | string | null): boolean {
  return resolveClassId(classId) === "chad";
}

export function hasExplorerMapPerk(classId?: CharacterClassId | string | null): boolean {
  return resolveClassId(classId) === "doge";
}

export function hasTraderTerminalPerk(classId?: CharacterClassId | string | null): boolean {
  return resolveClassId(classId) === "pepe";
}

export function hasBuilderMissionPerk(classId?: CharacterClassId | string | null): boolean {
  return resolveClassId(classId) === "anon";
}

export function hasCreatorPresencePerk(classId?: CharacterClassId | string | null): boolean {
  return resolveClassId(classId) === "wojak";
}

/** City-board claim cooldown. Anon at HQ is nearly instant. */
export function missionClaimCooldownMs(
  classId?: CharacterClassId | string | null,
  atHq = false,
): number {
  if (hasBuilderMissionPerk(classId)) return atHq ? 2_000 : 8_000;
  return 30_000;
}

export function appearanceFromClass(cls: CharacterClassDef, name?: string): AvatarAppearance {
  const look: Record<
    CharacterClassId,
    { hairStyle: AvatarAppearance["hairStyle"]; hairColor: string; outfit: AvatarAppearance["outfit"]; faceStyle: AvatarAppearance["faceStyle"] }
  > = {
    pepe: { hairStyle: "short", hairColor: "#3d7a38", outfit: "street", faceStyle: "cool" },
    wojak: { hairStyle: "buzz", hairColor: "#6b5344", outfit: "street", faceStyle: "neutral" },
    chad: { hairStyle: "short", hairColor: "#1a1410", outfit: "sport", faceStyle: "cool" },
    doge: { hairStyle: "short", hairColor: "#c47a28", outfit: "street", faceStyle: "smile" },
    anon: { hairStyle: "buzz", hairColor: "#111318", outfit: "suit", faceStyle: "neutral" },
  };

  const kit = look[cls.id];
  return {
    name: name?.trim() || cls.name,
    bodyColor: cls.bodyColor,
    accentColor: cls.accentColor,
    skinColor: cls.skinColor,
    classId: cls.id,
    hairStyle: kit.hairStyle,
    hairColor: kit.hairColor,
    outfit: kit.outfit,
    faceStyle: kit.faceStyle,
  };
}
