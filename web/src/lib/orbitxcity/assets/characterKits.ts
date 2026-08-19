/** Character visual kits — accessories + optional OrbitX GLTF hero path. */
import type { CharacterClassId } from "../characterClasses";
import { resolveClassId } from "../characterClasses";
import { resolveModelPath, type OrbitxModelId } from "./catalog";

export type CharacterAccessory = "briefcase" | "hard-hat" | "headset" | "hand-mic" | "compass";

export interface CharacterKit {
  classId: CharacterClassId;
  accessory: CharacterAccessory;
  glow: number;
  modelId: OrbitxModelId;
  accent: string;
}

export const CHARACTER_KITS: CharacterKit[] = [
  { classId: "pepe", accessory: "briefcase", glow: 0.35, modelId: "character-trader", accent: "#5cb85c" },
  { classId: "anon", accessory: "hard-hat", glow: 0.4, modelId: "character-builder", accent: "#f7931a" },
  { classId: "chad", accessory: "headset", glow: 0.65, modelId: "character-gamer", accent: "#d4a017" },
  { classId: "wojak", accessory: "hand-mic", glow: 0.75, modelId: "character-creator", accent: "#e8b4c8" },
  { classId: "doge", accessory: "compass", glow: 0.5, modelId: "character-explorer", accent: "#e8a54b" },
];

export function getCharacterKit(classId: CharacterClassId | string | undefined): CharacterKit {
  const id = resolveClassId(classId);
  return CHARACTER_KITS.find((k) => k.classId === id) ?? CHARACTER_KITS[0]!;
}

/** OrbitX hero GLB path when art is available; otherwise null → use mascot mesh. */
export function getCharacterGltfPath(classId: CharacterClassId | string | undefined): string | null {
  const kit = getCharacterKit(classId);
  return resolveModelPath(kit.modelId);
}
