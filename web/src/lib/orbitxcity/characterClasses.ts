/**
 * OrbitX City — playable crypto-native operatives.
 *
 * Six original mascots built on crypto-culture archetypes. Designs are
 * OrbitX-original stylised meshes (blocky, Roblox-adjacent proportions), not
 * reproductions of third-party meme artwork.
 *
 * Legacy save data (trader/builder/gamer/creator/explorer) resolves forward
 * through CLASS_ALIASES.
 */
import type { AvatarAppearance } from "./types";

export type CharacterClassId =
  | "pepe"
  | "wojak"
  | "chad"
  | "doge"
  | "anon"
  | "vitalik";

/** Legacy class ids still stored on interiors / old sessions. */
export type LegacyClassId =
  | "trader"
  | "builder"
  | "gamer"
  | "creator"
  | "explorer";

export const CLASS_ALIASES: Record<LegacyClassId, CharacterClassId> = {
  trader: "pepe",
  builder: "anon",
  gamer: "chad",
  creator: "wojak",
  explorer: "doge",
};

export type ClassRarity = "common" | "rare" | "epic" | "legendary";

export const RARITY_META: Record<
  ClassRarity,
  { label: string; color: string; glow: string; order: number }
> = {
  common: { label: "Common", color: "#9aa4b2", glow: "rgba(154,164,178,0.45)", order: 0 },
  rare: { label: "Rare", color: "#4aa3ff", glow: "rgba(74,163,255,0.50)", order: 1 },
  epic: { label: "Epic", color: "#b76cff", glow: "rgba(183,108,255,0.55)", order: 2 },
  legendary: { label: "Legendary", color: "#ffb427", glow: "rgba(255,180,39,0.60)", order: 3 },
};

export interface CharacterStat {
  label: string;
  value: number;
}

/** Silhouette recipe consumed by the blocky in-world mesh. */
export interface CharacterBuild {
  /** Head shape driver. */
  head: "round" | "block" | "wide" | "tall" | "snout";
  /** Torso mass. */
  torso: "slim" | "regular" | "broad" | "bulk";
  /** Signature headgear rendered above the head. */
  headgear: "none" | "cap" | "hood" | "visor" | "crown" | "beanie";
  /** Emissive eye treatment. */
  eyes: "flat" | "laser" | "glow" | "shade";
  /** Trailing accessory. */
  trail: "none" | "scarf" | "tail" | "cape";
}

export interface CharacterClassDef {
  id: CharacterClassId;
  name: string;
  handle: string;
  tagline: string;
  rarity: ClassRarity;
  neon: string;
  gold: string;
  bodyColor: string;
  accentColor: string;
  skinColor: string;
  /** Secondary colour for trim, cuffs, headgear. */
  trimColor: string;
  /** Relative body scale for in-world mesh differentiation. */
  scale: { x: number; y: number; z: number };
  /** Movement tuning multipliers applied by the player controller. */
  movement: { speed: number; jump: number; accel: number };
  build: CharacterBuild;
  stats: CharacterStat[];
}

export const CHARACTER_CLASSES: CharacterClassDef[] = [
  {
    id: "pepe",
    name: "Pip",
    handle: "@pip.ox",
    tagline: "Tape reader · lives on the 1-minute",
    rarity: "rare",
    neon: "#5cb85c",
    gold: "#c5e07a",
    bodyColor: "#2f6b34",
    accentColor: "#c23b3b",
    skinColor: "#63c264",
    trimColor: "#8fd97a",
    scale: { x: 1.08, y: 0.94, z: 1.08 },
    movement: { speed: 1.0, jump: 1.06, accel: 1.12 },
    build: { head: "wide", torso: "regular", headgear: "none", eyes: "flat", trail: "none" },
    stats: [
      { label: "Instinct", value: 94 },
      { label: "Degen", value: 96 },
      { label: "Risk", value: 88 },
      { label: "Focus", value: 71 },
    ],
  },
  {
    id: "wojak",
    name: "Vex",
    handle: "@vex.ox",
    tagline: "Culture layer · turns rugs into lore",
    rarity: "common",
    neon: "#e8b4c8",
    gold: "#c5a26f",
    bodyColor: "#5b6472",
    accentColor: "#e8b4c8",
    skinColor: "#f0d2bd",
    trimColor: "#8e99a8",
    scale: { x: 0.95, y: 1.02, z: 0.95 },
    movement: { speed: 0.98, jump: 1.0, accel: 1.0 },
    build: { head: "round", torso: "slim", headgear: "beanie", eyes: "flat", trail: "scarf" },
    stats: [
      { label: "Reach", value: 92 },
      { label: "Signal", value: 84 },
      { label: "Resolve", value: 78 },
      { label: "Focus", value: 66 },
    ],
  },
  {
    id: "chad",
    name: "Titan",
    handle: "@titan.ox",
    tagline: "Clutch heat checks · never re-reads a chart",
    rarity: "epic",
    neon: "#f0c27a",
    gold: "#ffd700",
    bodyColor: "#1c1420",
    accentColor: "#d4a017",
    skinColor: "#d4a574",
    trimColor: "#f2c96b",
    scale: { x: 1.24, y: 1.12, z: 1.12 },
    movement: { speed: 0.94, jump: 1.18, accel: 0.9 },
    build: { head: "block", torso: "bulk", headgear: "none", eyes: "shade", trail: "none" },
    stats: [
      { label: "Aura", value: 99 },
      { label: "Reflex", value: 91 },
      { label: "Clutch", value: 93 },
      { label: "Focus", value: 80 },
    ],
  },
  {
    id: "doge",
    name: "Scout",
    handle: "@scout.ox",
    tagline: "Frontier runner · maps blocks nobody walks",
    rarity: "rare",
    neon: "#e8a54b",
    gold: "#f5d08a",
    bodyColor: "#c8802f",
    accentColor: "#a8332a",
    skinColor: "#e8a54b",
    trimColor: "#f3c479",
    scale: { x: 1.04, y: 0.9, z: 1.14 },
    movement: { speed: 1.14, jump: 1.02, accel: 1.16 },
    build: { head: "snout", torso: "regular", headgear: "none", eyes: "glow", trail: "tail" },
    stats: [
      { label: "Range", value: 97 },
      { label: "Pace", value: 93 },
      { label: "Stamina", value: 86 },
      { label: "Focus", value: 74 },
    ],
  },
  {
    id: "anon",
    name: "Nul",
    handle: "@nul.ox",
    tagline: "Ships rails · never doxxes",
    rarity: "legendary",
    neon: "#f7931a",
    gold: "#f5c542",
    bodyColor: "#0f1116",
    accentColor: "#f7931a",
    skinColor: "#1a1d24",
    trimColor: "#f7931a",
    scale: { x: 1.0, y: 1.06, z: 1.0 },
    movement: { speed: 1.02, jump: 1.0, accel: 1.04 },
    build: { head: "tall", torso: "slim", headgear: "hood", eyes: "laser", trail: "cape" },
    stats: [
      { label: "Craft", value: 91 },
      { label: "Conviction", value: 98 },
      { label: "Stealth", value: 95 },
      { label: "Focus", value: 90 },
    ],
  },
  {
    id: "vitalik",
    name: "Proto",
    handle: "@proto.ox",
    tagline: "Protocol architect · thinks in state trees",
    rarity: "legendary",
    neon: "#8a7dff",
    gold: "#c3bcff",
    bodyColor: "#221f3d",
    accentColor: "#8a7dff",
    skinColor: "#e7d9c4",
    trimColor: "#a99dff",
    scale: { x: 0.92, y: 1.1, z: 0.92 },
    movement: { speed: 1.0, jump: 0.96, accel: 0.98 },
    build: { head: "tall", torso: "slim", headgear: "visor", eyes: "glow", trail: "none" },
    stats: [
      { label: "Craft", value: 99 },
      { label: "Insight", value: 96 },
      { label: "Stamina", value: 70 },
      { label: "Focus", value: 97 },
    ],
  },
];

const VALID_IDS = new Set<string>(CHARACTER_CLASSES.map((c) => c.id));

export function isCharacterClassId(
  value: string | undefined | null,
): value is CharacterClassId {
  return typeof value === "string" && VALID_IDS.has(value);
}

export function resolveClassId(id: string | undefined | null): CharacterClassId {
  if (isCharacterClassId(id)) return id;
  if (id && id in CLASS_ALIASES) return CLASS_ALIASES[id as LegacyClassId];
  return "pepe";
}

export function getCharacterClass(
  id: CharacterClassId | string | undefined,
): CharacterClassDef {
  return (
    CHARACTER_CLASSES.find((c) => c.id === resolveClassId(id)) ??
    CHARACTER_CLASSES[0]!
  );
}

export function getRarityMeta(id: CharacterClassId | string | undefined) {
  return RARITY_META[getCharacterClass(id).rarity];
}

/** Overall power index (0-100) used for roster sorting and the compare bar. */
export function classPowerIndex(id: CharacterClassId | string | undefined): number {
  const stats = getCharacterClass(id).stats;
  if (!stats.length) return 0;
  return Math.round(stats.reduce((a, s) => a + s.value, 0) / stats.length);
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
  const id = resolveClassId(classId);
  return id === "anon" || id === "vitalik";
}

export function hasCreatorPresencePerk(classId?: CharacterClassId | string | null): boolean {
  return resolveClassId(classId) === "wojak";
}

/** Proto reads contract internals at terminals without a scan cost. */
export function hasProtocolInspectPerk(classId?: CharacterClassId | string | null): boolean {
  return resolveClassId(classId) === "vitalik";
}

/** City-board claim cooldown. Builder classes at HQ are nearly instant. */
export function missionClaimCooldownMs(
  classId?: CharacterClassId | string | null,
  atHq = false,
): number {
  if (hasBuilderMissionPerk(classId)) return atHq ? 2_000 : 8_000;
  return 30_000;
}

export function appearanceFromClass(
  cls: CharacterClassDef,
  name?: string,
): AvatarAppearance {
  const look: Record<
    CharacterClassId,
    {
      hairStyle: AvatarAppearance["hairStyle"];
      hairColor: string;
      outfit: AvatarAppearance["outfit"];
      faceStyle: AvatarAppearance["faceStyle"];
    }
  > = {
    pepe: { hairStyle: "short", hairColor: "#2f6b34", outfit: "street", faceStyle: "cool" },
    wojak: { hairStyle: "buzz", hairColor: "#6b5344", outfit: "street", faceStyle: "neutral" },
    chad: { hairStyle: "short", hairColor: "#1a1410", outfit: "sport", faceStyle: "cool" },
    doge: { hairStyle: "short", hairColor: "#c47a28", outfit: "street", faceStyle: "smile" },
    anon: { hairStyle: "buzz", hairColor: "#0f1116", outfit: "suit", faceStyle: "neutral" },
    vitalik: { hairStyle: "short", hairColor: "#3b3468", outfit: "suit", faceStyle: "neutral" },
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
