/** Character class visual kits — accessories + optional OrbitX GLTF hero path. */
import type { CharacterClassId } from "../characterClasses";
import { resolveModelPath, type OrbitxModelId } from "./catalog";

export type CharacterAccessory =
  | "briefcase"
  | "hard-hat"
  | "headset"
  | "hand-mic"
  | "compass";

export interface CharacterKit {
  classId: CharacterClassId;
  accessory: CharacterAccessory;
  /** Emissive intensity for accessory neon */
  glow: number;
  /** Catalog id for optional hero GLB */
  modelId: OrbitxModelId;
  accent: string;
}

export const CHARACTER_KITS: CharacterKit[] = [
  { classId: "trader", accessory: "briefcase", glow: 0.35, modelId: "character-trader", accent: "#c5a26f" },
  { classId: "builder", accessory: "hard-hat", glow: 0.4, modelId: "character-builder", accent: "#5b8def" },
  { classId: "gamer", accessory: "headset", glow: 0.65, modelId: "character-gamer", accent: "#ff4d6a" },
  { classId: "creator", accessory: "hand-mic", glow: 0.75, modelId: "character-creator", accent: "#b388ff" },
  { classId: "explorer", accessory: "compass", glow: 0.5, modelId: "character-explorer", accent: "#00ff9f" },
];

export function getCharacterKit(classId: CharacterClassId | string | undefined): CharacterKit {
  return CHARACTER_KITS.find((k) => k.classId === classId) ?? CHARACTER_KITS[0]!;
}

/** OrbitX hero GLB path when art is available; otherwise null → use CharacterMesh. */
export function getCharacterGltfPath(classId: CharacterClassId | string | undefined): string | null {
  const kit = getCharacterKit(classId);
  return resolveModelPath(kit.modelId);
}
