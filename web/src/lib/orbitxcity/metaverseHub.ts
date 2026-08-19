/**
 * OrbitX metaverse hub — Alpha data model.
 * Maps the existing Midtown block onto Financial / Commercial / Creative / Residential
 * zones without a new world engine. Character slots, wishlist, and party live in
 * localStorage until a privileged backend CRUD exists.
 */
import type { AvatarAppearance, BeardStyle, BodyType, WorldBlockConfig } from "./types";

export type HubZoneId = "hub" | "financial" | "commercial" | "creative" | "residential";

export interface HubZone {
  id: HubZoneId;
  label: string;
  blurb: string;
  accent: string;
  x: number;
  z: number;
}

function pickBuilding(
  block: WorldBlockConfig,
  pred: (b: WorldBlockConfig["buildings"][number]) => boolean,
): WorldBlockConfig["buildings"][number] | undefined {
  return block.buildings.find(pred);
}

/** Fast-travel / map landmarks for the Alpha hub. */
export function hubZonesForBlock(block: WorldBlockConfig): HubZone[] {
  const spawn = block.spawn;
  const hq = pickBuilding(block, (b) => b.kind === "hq" || b.interaction === "hq");
  const trade = pickBuilding(block, (b) => b.kind === "trading_floor" || b.interaction === "trading");
  const market = pickBuilding(block, (b) => b.kind === "market" || b.interaction === "marketplace");
  const social = pickBuilding(block, (b) => b.kind === "social_hub" || b.interaction === "community");
  const gallery = pickBuilding(block, (b) => b.interaction === "nft" || b.kind === "shop");
  return [
    {
      id: "hub",
      label: "Main Plaza",
      blurb: "Spawn, onboarding, merchants",
      accent: "#00ff9f",
      x: spawn.x,
      z: spawn.z,
    },
    {
      id: "financial",
      label: "Financial",
      blurb: "DEX floor · bank · HQ vault",
      accent: "#3de7ff",
      x: trade?.position.x ?? hq?.position.x ?? spawn.x,
      z: trade?.position.z ?? (hq?.position.z ?? spawn.z) + 8,
    },
    {
      id: "commercial",
      label: "Commercial",
      blurb: "Shop · meme market · ads",
      accent: "#f5c542",
      x: market?.position.x ?? spawn.x - 10,
      z: market?.position.z ?? spawn.z,
    },
    {
      id: "creative",
      label: "Creative",
      blurb: "Gallery · social · launch",
      accent: "#a78bfa",
      x: gallery?.position.x ?? social?.position.x ?? spawn.x + 10,
      z: gallery?.position.z ?? social?.position.z ?? spawn.z - 8,
    },
    {
      id: "residential",
      label: "Residential",
      blurb: "Park hangout · nightlife strip",
      accent: "#ff4d9a",
      x: spawn.x + (block.bounds.maxX > 40 ? 18 : 8),
      z: spawn.z + (block.bounds.maxZ > 40 ? 16 : 8),
    },
  ];
}

export type ShopRarity = "common" | "rare" | "epic" | "legendary";

export function shopRarity(priceUsd: number): ShopRarity {
  if (priceUsd >= 80) return "legendary";
  if (priceUsd >= 35) return "epic";
  if (priceUsd >= 12) return "rare";
  return "common";
}

const WISHLIST_KEY = "oxc_shop_wishlist_v1";

export function loadWishlist(): string[] {
  try {
    const raw = localStorage.getItem(WISHLIST_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function toggleWishlist(itemId: string): string[] {
  const next = loadWishlist().includes(itemId)
    ? loadWishlist().filter((id) => id !== itemId)
    : [...loadWishlist(), itemId];
  localStorage.setItem(WISHLIST_KEY, JSON.stringify(next.slice(0, 48)));
  return next;
}

export interface CharacterSlot {
  id: string;
  savedAt: number;
  appearance: AvatarAppearance;
}

const SLOTS_KEY = "oxc_character_slots_v1";

export function loadCharacterSlots(): CharacterSlot[] {
  try {
    const raw = localStorage.getItem(SLOTS_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((row): row is CharacterSlot => {
      return Boolean(row && typeof row === "object" && typeof (row as CharacterSlot).id === "string");
    });
  } catch {
    return [];
  }
}

export function saveCharacterSlot(appearance: AvatarAppearance): CharacterSlot[] {
  const slots = loadCharacterSlots();
  const row: CharacterSlot = {
    id: `slot-${Date.now().toString(36)}`,
    savedAt: Date.now(),
    appearance,
  };
  const next = [row, ...slots].slice(0, 6);
  localStorage.setItem(SLOTS_KEY, JSON.stringify(next));
  return next;
}

export function deleteCharacterSlot(id: string): CharacterSlot[] {
  const next = loadCharacterSlots().filter((s) => s.id !== id);
  localStorage.setItem(SLOTS_KEY, JSON.stringify(next));
  return next;
}

const PARTY_KEY = "oxc_party_v1";

export function loadPartyIds(): string[] {
  try {
    const raw = localStorage.getItem(PARTY_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function togglePartyMember(playerId: string): string[] {
  const cur = loadPartyIds();
  const next = cur.includes(playerId) ? cur.filter((id) => id !== playerId) : [...cur, playerId].slice(0, 8);
  localStorage.setItem(PARTY_KEY, JSON.stringify(next));
  return next;
}

export const BODY_TYPES: BodyType[] = ["slim", "standard", "strong"];
export const BEARD_STYLES: BeardStyle[] = ["none", "stubble", "goatee", "full"];

export function bodyTypeScale(type: BodyType | undefined): { x: number; y: number; z: number } {
  if (type === "slim") return { x: 0.92, y: 1.04, z: 0.92 };
  if (type === "strong") return { x: 1.12, y: 1.02, z: 1.1 };
  return { x: 1, y: 1, z: 1 };
}

export function sortScreener<T extends { priceUsd?: number | string; change24h?: number | string; symbol?: string }>(
  rows: T[],
  sort: "name" | "price" | "change",
): T[] {
  const copy = [...rows];
  copy.sort((a, b) => {
    if (sort === "price") return Number(b.priceUsd ?? 0) - Number(a.priceUsd ?? 0);
    if (sort === "change") return Number(b.change24h ?? 0) - Number(a.change24h ?? 0);
    return String(a.symbol ?? "").localeCompare(String(b.symbol ?? ""));
  });
  return copy;
}
