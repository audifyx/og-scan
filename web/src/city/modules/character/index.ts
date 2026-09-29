/**
 * ORBITXCITY — character module public API.
 *
 * GTA-style character system: creator (face/fits/ink), clothing shops with
 * gameplay buffs, barber + tattoo shops (ORBITX burns), gym (trainable
 * stats), and a companion trade-bot drone that follows the player in-world.
 *
 * Mount point: <CharacterHub billing={billing} onClose={...} /> — see
 * components/CharacterHub.tsx and MODULE.md for integrator wiring.
 */
export * from "./types";
export {
  SKIN_TONES,
  HAIR_COLORS,
  FACIAL_HAIR,
  BARBER_STYLES,
  TATTOOS,
  CLOTHING,
  GYM_EXERCISES,
  STORES,
  COMPANION_NAME_PRESETS,
  clothingById,
  tattooById,
  barberStyleById,
} from "./data";
export { buildAvatar } from "./avatar";
export type { AvatarHandle } from "./avatar";
export {
  CharacterProvider,
  useCharacter,
  getActiveBuffs,
  getDerivedEffects,
  getStores,
  statProgressPct,
} from "./characterStore";
export {
  resolveBilling,
  purchaseBurn,
  useBilling,
} from "./billing";
export { createCompanionBot, COMPANION_COLORS } from "./companion/companionBot";
export type { CompanionBot, CompanionPlayer } from "./companion/companionBot";
export { CharacterHub, CHARACTER_PANEL_ID } from "./components/CharacterHub";
export { CharacterCreator, Wardrobe } from "./components/CharacterCreator";
export { ClothingStore, BarberShop, TattooShop } from "./components/Shops";
export { GymPanel } from "./components/GymPanel";
export { CompanionPanel } from "./components/CompanionPanel";
export { AvatarPreview } from "./components/AvatarPreview";
