import type { CharacterLoadout, GameProfile, PlayerClassId } from "../types";
import { getClass } from "../catalogs/classesItems";
import { addItem } from "./economy";
import { unlockAchievement } from "./progression";

export function defaultCharacter(name = "Traveler"): CharacterLoadout {
  return {
    name,
    classId: "operator",
    skinColor: "#e8d5c0",
    hairColor: "#101014",
    bodyColor: "#1a2438",
    accentColor: "#17ff4d",
    hairStyle: "short",
    faceStyle: "cool",
    cosmetics: {
      skin: "skin-default",
      hair: "hair-short",
      outfit: "outfit-street",
      emote_idle: "emote-idle-cool",
    },
    equipment: {},
  };
}

export function applyClass(profile: GameProfile, classId: PlayerClassId): GameProfile {
  const cls = getClass(classId);
  if (!cls) return profile;
  let next: GameProfile = {
    ...profile,
    character: {
      ...profile.character,
      classId,
      accentColor: cls.accent,
    },
    updatedAt: Date.now(),
  };
  for (const itemId of cls.starterItems) {
    next = addItem(next, itemId, 1);
  }
  const unlocked = unlockAchievement(next.progression, "class_pick");
  next = { ...next, progression: unlocked.prog };
  return next;
}

export function renameCharacter(profile: GameProfile, name: string): GameProfile {
  return {
    ...profile,
    character: { ...profile.character, name: name.trim().slice(0, 24) || "Traveler" },
    updatedAt: Date.now(),
  };
}

export function patchCosmetics(
  profile: GameProfile,
  patch: Partial<Pick<CharacterLoadout, "skinColor" | "hairColor" | "bodyColor" | "accentColor" | "hairStyle" | "faceStyle">> & {
    cosmetics?: CharacterLoadout["cosmetics"];
  },
): GameProfile {
  return {
    ...profile,
    character: {
      ...profile.character,
      ...patch,
      cosmetics: { ...profile.character.cosmetics, ...patch.cosmetics },
    },
    updatedAt: Date.now(),
  };
}
