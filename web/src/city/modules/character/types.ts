/**
 * ORBITXCITY — character module types.
 *
 * Covers all five approved character ideas:
 *  1. Character creator (face, fits, tattoos — all ORBITX-burn purchases)
 *  2. Clothing stores (outfits grant small gameplay buffs)
 *  3. Barber + tattoo shops (cosmetic upgrades, ORBITX burn)
 *  4. Gym (train strength/stamina; stats drive gameplay effects)
 *  5. Companion bot (follows you, named after your favorite agent)
 */

/** Billing provider shape — mirrors web/src/city/BILLING_CONTRACT.md exactly.
 *  Injected by the integrator as a prop once @/tokenomics/useOrbitxBilling lands. */
export interface CharacterBillingProvider {
  ready: boolean;
  balance: number | null;
  spend: (opts: { amount: number; reason: string; ref?: string }) => Promise<{ signature: string }>;
  beginAuth: () => void;
}

export interface BurnReceipt {
  itemId: string;
  kind: "clothing" | "tattoo" | "barber" | "gym-boost";
  amount: number; // whole ORBITX burned
  signature: string;
  at: number;
}

/** Flat stat bonus points granted by equipped clothing. */
export interface StatBuffs {
  strength?: number;
  stamina?: number;
  speed?: number;
}

export type OutfitSlot = "head" | "top" | "bottom" | "shoes" | "outer";

export interface ClothingItem {
  id: string;
  name: string;
  slot: OutfitSlot;
  /** Whole ORBITX burned on purchase. */
  price: number;
  /** Gameplay buff (small, additive stat points) — not just looks. */
  buffs: StatBuffs;
  /** Primary fabric color (hex). */
  color: number;
  blurb: string;
}

export type HairStyleId =
  | "buzz" | "fade" | "curls" | "ponytail" | "mohawk" | "slick" | "dreads" | "bald";

export type FacialHairId = "none" | "stubble" | "goatee" | "beard" | "mustache";

export interface BarberStyle {
  id: HairStyleId;
  name: string;
  price: number; // ORBITX
  blurb: string;
}

export type TattooZone = "armL" | "armR" | "chest" | "back" | "neck";

export interface TattooDesign {
  id: string;
  name: string;
  zone: TattooZone;
  price: number; // ORBITX
  blurb: string;
}

export interface SkinTone {
  id: string;
  name: string;
  color: number;
}

export interface HairColor {
  id: string;
  name: string;
  color: number;
}

export interface Appearance {
  skinToneId: string;
  hairStyleId: HairStyleId;
  hairColorId: string;
  facialHairId: FacialHairId;
}

export type TrainableStat = "strength" | "stamina" | "agility";

export interface CharacterStats {
  strength: number; // 1..100 — melee/shove power
  stamina: number;  // 1..100 — sprint duration + regen
  agility: number;  // 1..100 — accel / climb / evade
}

export interface GymExercise {
  id: string;
  name: string;
  stat: TrainableStat;
  /** progress points (100 = +1 stat point) */
  gain: number;
  /** paper CITY fee per session */
  cityCost: number;
  cooldownMs: number;
  blurb: string;
}

export interface CharacterProfile {
  id: string;
  name: string;
  appearance: Appearance;
  /** equipped clothing item ids per slot */
  outfit: Partial<Record<OutfitSlot, string>>;
  /** owned clothing item ids */
  wardrobe: string[];
  /** owned tattoo design ids */
  tattoos: string[];
  /** owned barber style ids (haircuts are services; each visit = one purchase) */
  cuts: string[];
  stats: CharacterStats;
  /** fractional progress toward the next point, per stat */
  progress: Record<TrainableStat, number>;
  /** paper CITY wallet (in-module until the shared economy ledger lands) */
  cityBalance: number;
  companionName: string;
  companionColor: number;
  companionEnabled: boolean;
  /** last trained timestamps per exercise id */
  lastTrained: Record<string, number>;
  receipts: BurnReceipt[];
  createdAt: number;
  updatedAt: number;
}

export interface StoreLocation {
  id: string;
  name: string;
  kind: "clothing" | "barber" | "tattoo" | "gym";
  /** world coords (city streets; see core/CityBuilder) */
  x: number;
  z: number;
  blurb: string;
}

/** Derived gameplay effects from stats + outfit buffs (consumed by core). */
export interface DerivedEffects {
  strength: number;
  stamina: number;
  agility: number;
  /** sprint top-speed multiplier */
  sprintSpeedMult: number;
  /** seconds of full sprint before exhaustion */
  sprintStaminaSec: number;
  /** melee / shove damage multiplier */
  meleeDamageMult: number;
  /** acceleration multiplier */
  accelMult: number;
}

export interface CompanionHandle {
  setName: (name: string) => void;
  setColor: (hex: number) => void;
  dispose: () => void;
}
