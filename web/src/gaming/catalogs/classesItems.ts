import type { CosmeticDef, ItemDef, PlayerClassDef } from "../types";

export const PLAYER_CLASSES: PlayerClassDef[] = [
  {
    id: "striker",
    name: "Striker",
    tagline: "Frontline pressure",
    description: "High power and aggressive plays. Dominates PvE events and arena rushes.",
    accent: "#ff4d5e",
    baseStats: { power: 8, speed: 6, vitality: 5, focus: 4, charisma: 3, luck: 4 },
    starterItems: ["blade-spark", "jacket-street", "boots-runner"],
  },
  {
    id: "scout",
    name: "Scout",
    tagline: "Speed & intel",
    description: "Fast movement, map control, and discovery bonuses across OrbitX City.",
    accent: "#3de7ff",
    baseStats: { power: 4, speed: 9, vitality: 4, focus: 7, charisma: 4, luck: 5 },
    starterItems: ["visor-pulse", "cloak-breeze", "boots-runner"],
  },
  {
    id: "tank",
    name: "Tank",
    tagline: "Unbreakable line",
    description: "Extra vitality and defense. Anchors parties in multiplayer events.",
    accent: "#f5c542",
    baseStats: { power: 5, speed: 3, vitality: 10, focus: 4, charisma: 3, luck: 3 },
    starterItems: ["shield-plate", "armor-bulk", "boots-heavy"],
  },
  {
    id: "socialite",
    name: "Socialite",
    tagline: "Presence & influence",
    description: "Charisma-focused. Better voice lobby rewards and social mission payouts.",
    accent: "#ff4d9a",
    baseStats: { power: 3, speed: 5, vitality: 4, focus: 5, charisma: 10, luck: 5 },
    starterItems: ["mic-neon", "fit-stage", "trail-spark"],
  },
  {
    id: "operator",
    name: "Operator",
    tagline: "Systems mastery",
    description: "Focus and luck for puzzles, missions, and economy loops.",
    accent: "#17ff4d",
    baseStats: { power: 4, speed: 5, vitality: 5, focus: 9, charisma: 4, luck: 7 },
    starterItems: ["pad-ops", "suit-tech", "aura-grid"],
  },
];

export const COSMETICS: CosmeticDef[] = [
  { id: "skin-default", name: "Traveler Skin", slot: "skin", rarity: "common", colors: ["#e8d5c0", "#c9a07a", "#8d5524"] },
  { id: "hair-short", name: "Short Cut", slot: "hair", rarity: "common", colors: ["#101014", "#3a2318", "#d9d0c3"] },
  { id: "hair-mohawk", name: "Neon Mohawk", slot: "hair", rarity: "rare", colors: ["#17ff4d", "#3de7ff", "#ff4d9a"], unlockLevel: 5 },
  { id: "outfit-street", name: "Street Kit", slot: "outfit", rarity: "common" },
  { id: "outfit-neon", name: "Neon Circuit", slot: "outfit", rarity: "epic", unlockLevel: 10, priceShards: 400 },
  { id: "trail-spark", name: "Spark Trail", slot: "trail", rarity: "uncommon", priceShards: 120 },
  { id: "aura-grid", name: "Grid Aura", slot: "aura", rarity: "rare", unlockLevel: 8, priceShards: 250 },
  { id: "emote-idle-cool", name: "Cool Idle", slot: "emote_idle", rarity: "common" },
  { id: "emote-idle-dance", name: "Idle Dance", slot: "emote_idle", rarity: "rare", priceShards: 180 },
];

export const ITEMS: ItemDef[] = [
  { id: "blade-spark", name: "Spark Blade", kind: "weapon", rarity: "uncommon", slot: "weapon", stackable: false, maxStack: 1, stats: { power: 3 }, description: "Starter striker edge.", tradeable: false },
  { id: "visor-pulse", name: "Pulse Visor", kind: "armor", rarity: "uncommon", slot: "head", stackable: false, maxStack: 1, stats: { focus: 2, speed: 1 }, description: "Scout optics.", tradeable: false },
  { id: "shield-plate", name: "Bulk Shield", kind: "armor", rarity: "uncommon", slot: "hands", stackable: false, maxStack: 1, stats: { vitality: 3 }, description: "Tank barrier.", tradeable: false },
  { id: "mic-neon", name: "Neon Mic", kind: "accessory", rarity: "uncommon", slot: "accessory", stackable: false, maxStack: 1, stats: { charisma: 3 }, description: "Socialite tool.", tradeable: false },
  { id: "pad-ops", name: "Ops Pad", kind: "accessory", rarity: "uncommon", slot: "accessory", stackable: false, maxStack: 1, stats: { focus: 3, luck: 1 }, description: "Operator deck.", tradeable: false },
  { id: "jacket-street", name: "Street Jacket", kind: "armor", rarity: "common", slot: "body", stackable: false, maxStack: 1, stats: { vitality: 1 }, description: "Light armor.", tradeable: true, priceShards: 40 },
  { id: "cloak-breeze", name: "Breeze Cloak", kind: "armor", rarity: "common", slot: "back", stackable: false, maxStack: 1, stats: { speed: 2 }, description: "Scout cloak.", tradeable: true },
  { id: "armor-bulk", name: "Bulk Frame", kind: "armor", rarity: "common", slot: "body", stackable: false, maxStack: 1, stats: { vitality: 2 }, description: "Heavy plating.", tradeable: false },
  { id: "fit-stage", name: "Stage Fit", kind: "armor", rarity: "common", slot: "body", stackable: false, maxStack: 1, stats: { charisma: 2 }, description: "Spotlight ready.", tradeable: true },
  { id: "suit-tech", name: "Tech Suit", kind: "armor", rarity: "common", slot: "body", stackable: false, maxStack: 1, stats: { focus: 2 }, description: "Operator wear.", tradeable: false },
  { id: "boots-runner", name: "Runner Boots", kind: "armor", rarity: "common", slot: "feet", stackable: false, maxStack: 1, stats: { speed: 2 }, description: "Sprint ready.", tradeable: true, priceShards: 60 },
  { id: "boots-heavy", name: "Heavy Boots", kind: "armor", rarity: "common", slot: "feet", stackable: false, maxStack: 1, stats: { vitality: 2 }, description: "Planted stance.", tradeable: false },
  { id: "trail-spark", name: "Spark Trail Pack", kind: "accessory", rarity: "uncommon", slot: "back", stackable: false, maxStack: 1, description: "Cosmetic trail unlock token.", tradeable: true, priceShards: 120 },
  { id: "aura-grid", name: "Grid Aura Pack", kind: "accessory", rarity: "rare", slot: "accessory", stackable: false, maxStack: 1, description: "Cosmetic aura unlock token.", tradeable: true, priceShards: 250 },
  { id: "shard-pouch", name: "Shard Pouch", kind: "consumable", rarity: "common", stackable: true, maxStack: 99, description: "Grants 50 shards when used.", tradeable: false },
  { id: "xp-boost", name: "XP Boost (1h)", kind: "consumable", rarity: "rare", stackable: true, maxStack: 20, description: "+25% XP for one hour.", tradeable: true, priceShards: 200 },
  { id: "key-nyc", name: "NYC District Key", kind: "key", rarity: "uncommon", stackable: false, maxStack: 1, description: "Fast-travel access in OrbitX City.", tradeable: false },
  { id: "badge-pioneer", name: "City Pioneer", kind: "badge", rarity: "rare", stackable: false, maxStack: 1, description: "Founding season badge.", tradeable: false },
  { id: "emote-dance", name: "Dance Emote", kind: "emote", rarity: "common", stackable: false, maxStack: 1, description: "B-button dance in City.", tradeable: true, priceShards: 80 },
  { id: "title-neon", name: "Title: Neon Wolf", kind: "title", rarity: "epic", stackable: false, maxStack: 1, description: "Equipable player title.", tradeable: false },
];

export function getClass(id: string): PlayerClassDef | undefined {
  return PLAYER_CLASSES.find((c) => c.id === id);
}

export function getItem(id: string): ItemDef | undefined {
  return ITEMS.find((i) => i.id === id);
}

export function getCosmetic(id: string): CosmeticDef | undefined {
  return COSMETICS.find((c) => c.id === id);
}
