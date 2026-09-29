/**
 * ORBITXCITY — character module catalogs.
 *
 * Clothing, barber styles, tattoos, skin/hair options, gym exercises and
 * shop locations. Prices are whole ORBITX (burned per BILLING_CONTRACT.md).
 * Outfit buffs are small but real: clothing is never looks-only.
 */
import type {
  BarberStyle,
  ClothingItem,
  FacialHairId,
  GymExercise,
  HairColor,
  SkinTone,
  StoreLocation,
  TattooDesign,
} from "./types";

export const SKIN_TONES: SkinTone[] = [
  { id: "porcelain", name: "Porcelain", color: 0xf0c8a8 },
  { id: "sand", name: "Sand", color: 0xd9a583 },
  { id: "bronze", name: "Bronze", color: 0xc98a5e },
  { id: "amber", name: "Amber", color: 0xa06a42 },
  { id: "umber", name: "Umber", color: 0x8c5a3a },
  { id: "onyx", name: "Onyx", color: 0x5a3a26 },
];

export const HAIR_COLORS: HairColor[] = [
  { id: "raven", name: "Raven", color: 0x141210 },
  { id: "espresso", name: "Espresso", color: 0x2a1a10 },
  { id: "chestnut", name: "Chestnut", color: 0x5a3418 },
  { id: "copper", name: "Copper", color: 0x9a5a24 },
  { id: "ash", name: "Ash Blonde", color: 0xb8a07a },
  { id: "platinum", name: "Platinum", color: 0xd8d4cc },
  { id: "crimson", name: "Crimson", color: 0x8a1f2a },
  { id: "teal", name: "Neon Teal", color: 0x14c8b4 },
];

export const FACIAL_HAIR: { id: FacialHairId; name: string; price: number }[] = [
  { id: "none", name: "Clean shave", price: 0 },
  { id: "stubble", name: "Stubble", price: 3 },
  { id: "goatee", name: "Goatee", price: 5 },
  { id: "beard", name: "Full beard", price: 8 },
  { id: "mustache", name: "Mustache", price: 5 },
];

export const BARBER_STYLES: BarberStyle[] = [
  { id: "buzz", name: "Buzz Cut", price: 5, blurb: "Military clean. Zero maintenance." },
  { id: "fade", name: "Skin Fade", price: 8, blurb: "Sharp fade, city ready." },
  { id: "curls", name: "Curls", price: 10, blurb: "Natural volume, heavy presence." },
  { id: "ponytail", name: "Ponytail", price: 10, blurb: "Tied back, business in the front." },
  { id: "mohawk", name: "Mohawk", price: 15, blurb: "Maximum intimidation." },
  { id: "slick", name: "Slick Back", price: 12, blurb: "Old money energy." },
  { id: "dreads", name: "Dreadlocks", price: 18, blurb: "Long game, heavy culture." },
  { id: "bald", name: "Bald", price: 3, blurb: "Nothing to hide." },
];

export const TATTOOS: TattooDesign[] = [
  { id: "ink-orbit", name: "Orbit Ring", zone: "chest", price: 25, blurb: "The OrbitX ring, inked over the heart." },
  { id: "ink-skull", name: "Reaper Skull", zone: "back", price: 30, blurb: "Full-back death's head." },
  { id: "ink-flames", name: "Flame Sleeve", zone: "armR", price: 20, blurb: "Right arm, wrist to shoulder." },
  { id: "ink-tribal", name: "Tribal Band", zone: "armL", price: 15, blurb: "Left arm wrap-around band." },
  { id: "ink-bolt", name: "Lightning", zone: "neck", price: 12, blurb: "Neck bolt. Everyone sees it." },
  { id: "ink-rose", name: "Rose + Dagger", zone: "chest", price: 18, blurb: "Classic chest piece." },
  { id: "ink-code", name: "Barcode 404", zone: "armL", price: 10, blurb: "Scan it. It 404s." },
  { id: "ink-wave", name: "Koi Wave", zone: "back", price: 35, blurb: "Full-back koi current." },
];

/**
 * Clothing catalog. Every piece carries a small gameplay buff —
 * clothing is gear, not decoration.
 */
export const CLOTHING: ClothingItem[] = [
  // --- head ---
  { id: "cap-orbitx", name: "OrbitX Snapback", slot: "head", price: 15, buffs: { stamina: 2 }, color: 0x14161a, blurb: "Rep the platform. +2 stamina." },
  { id: "beanie-neon", name: "Neon Beanie", slot: "head", price: 12, buffs: { stamina: 1 }, color: 0x14c8b4, blurb: "Warm head, cool buff. +1 stamina." },
  { id: "hat-fedora", name: "Night Fedora", slot: "head", price: 22, buffs: { speed: 2 }, color: 0x2a2d33, blurb: "Move quiet. +2 speed." },
  // --- top ---
  { id: "tee-basic", name: "Plain Tee", slot: "top", price: 5, buffs: {}, color: 0x8a8f98, blurb: "Starter fit." },
  { id: "tank-gym", name: "Gym Bro Tank", slot: "top", price: 18, buffs: { strength: 6 }, color: 0x8a2f2f, blurb: "Cut sleeves, cut harder. +6 strength." },
  { id: "hoodie-orbitx", name: "OrbitX Hoodie", slot: "top", price: 25, buffs: { stamina: 4 }, color: 0x1f6f5f, blurb: "Platform colors. +4 stamina." },
  { id: "shirt-silk", name: "Silk Shirt", slot: "top", price: 30, buffs: { speed: 4 }, color: 0x4a3b6a, blurb: "Slippery. +4 speed." },
  // --- bottom ---
  { id: "jeans-basic", name: "Denim Jeans", slot: "bottom", price: 8, buffs: {}, color: 0x2f3a55, blurb: "Everyday denim." },
  { id: "pants-cargo", name: "Cargo Pants", slot: "bottom", price: 20, buffs: { stamina: 3 }, color: 0x4a4a38, blurb: "Pockets for days. +3 stamina." },
  { id: "shorts-run", name: "Runner Shorts", slot: "bottom", price: 14, buffs: { speed: 3 }, color: 0x1a1a1a, blurb: "Built for the chase. +3 speed." },
  { id: "pants-leather", name: "Leather Pants", slot: "bottom", price: 35, buffs: { strength: 4 }, color: 0x1a1410, blurb: "Armor-adjacent. +4 strength." },
  // --- shoes ---
  { id: "shoes-sneak", name: "Street Sneakers", slot: "shoes", price: 12, buffs: { speed: 2 }, color: 0xe8e8e8, blurb: "Daily drivers. +2 speed." },
  { id: "shoes-runner", name: "Turbo Runners", slot: "shoes", price: 28, buffs: { speed: 6, stamina: 2 }, color: 0x14c8b4, blurb: "Carbon plates. +6 speed, +2 stamina." },
  { id: "boots-combat", name: "Combat Boots", slot: "shoes", price: 32, buffs: { strength: 5 }, color: 0x2a2018, blurb: "Stomp authority. +5 strength." },
  // --- outer ---
  { id: "jacket-denim", name: "Denim Jacket", slot: "outer", price: 20, buffs: { stamina: 2 }, color: 0x3a4a66, blurb: "Layered. +2 stamina." },
  { id: "jacket-tech", name: "OrbitX Tech Jacket", slot: "outer", price: 40, buffs: { stamina: 5, speed: 3 }, color: 0x101418, blurb: "Flagship shell. +5 stamina, +3 speed." },
  { id: "coat-trench", name: "Trench Coat", slot: "outer", price: 45, buffs: { strength: 3, stamina: 3 }, color: 0x4a3b2a, blurb: "GTA energy. +3 strength, +3 stamina." },
];

export const GYM_EXERCISES: GymExercise[] = [
  { id: "bench", name: "Bench Press", stat: "strength", gain: 14, cityCost: 25, cooldownMs: 45_000, blurb: "Chest day. +strength." },
  { id: "squat", name: "Squat Rack", stat: "strength", gain: 12, cityCost: 20, cooldownMs: 45_000, blurb: "Legs feed the wolf. +strength." },
  { id: "treadmill", name: "Treadmill", stat: "stamina", gain: 14, cityCost: 15, cooldownMs: 30_000, blurb: "Cardio is king. +stamina." },
  { id: "bag", name: "Heavy Bag", stat: "strength", gain: 8, cityCost: 15, cooldownMs: 30_000, blurb: "Hands of stone. +strength, warms agility." },
  { id: "rope", name: "Battle Ropes", stat: "stamina", gain: 10, cityCost: 18, cooldownMs: 30_000, blurb: "Engine builder. +stamina." },
  { id: "ladder", name: "Agility Ladder", stat: "agility", gain: 12, cityCost: 15, cooldownMs: 30_000, blurb: "Feet first. +agility." },
];

/**
 * Shop locations on the city grid (streets at i*PITCH offsets; see
 * core/CityBuilder — BLOCK=64, ROAD_W=14, PITCH=78, HALF=358).
 * Integrator: place 3D storefront markers at these coords; the "enter"
 * interaction teleports to the shop UI (core teleport()).
 */
export const STORES: StoreLocation[] = [
  { id: "threads", name: "THREADS", kind: "clothing", x: -160, z: -230, blurb: "Full fits. Buffs included." },
  { id: "fadez", name: "FADEZ Barber", kind: "barber", x: 80, z: -50, blurb: "Cuts from 3 ORBITX." },
  { id: "inkd", name: "INK'D Parlor", kind: "tattoo", x: 210, z: 150, blurb: "Permanent statements." },
  { id: "ironhouse", name: "IRON HOUSE Gym", kind: "gym", x: -70, z: 250, blurb: "Strength and stamina, for real." },
];

/** Companion bot name presets — nod to the OrbitX agent theme. */
export const COMPANION_NAME_PRESETS = [
  "Orbit", "Scout", "Atlas", "Neon", "Pip", "Dex", "Cipher", "Bolt",
];

export function clothingById(id: string): ClothingItem | undefined {
  return CLOTHING.find((c) => c.id === id);
}

export function tattooById(id: string): TattooDesign | undefined {
  return TATTOOS.find((t) => t.id === id);
}

export function barberStyleById(id: string): BarberStyle | undefined {
  return BARBER_STYLES.find((b) => b.id === id);
}
