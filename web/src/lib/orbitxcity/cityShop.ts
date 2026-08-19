/**
 * OrbitX City shop — clothes, characters, ads, listings, perks.
 * Prices are USD ($1–$200). Checkout buys ORBITX on Jupiter then burns it.
 */
import { OGSCAN_TOKEN_MINT } from "@/lib/og";
import type { AvatarAppearance, BuildingBanner, HairStyle, InventoryItem, OutfitStyle } from "./types";

export const CITY_SHOP_MINT = OGSCAN_TOKEN_MINT;
export const CITY_SHOP_STORAGE = "oxc_city_shop_v1";

export type ShopCategory = "wear" | "character" | "ads" | "listing" | "perk";

export interface ShopItem {
  id: string;
  category: ShopCategory;
  name: string;
  blurb: string;
  priceUsd: number;
  accent: string;
  /** Applied to the in-world humanoid when equipped. */
  appearance?: Partial<AvatarAppearance>;
  adDays?: number;
  listingTier?: "watch" | "board" | "featured" | "prime";
}

export interface ShopPurchase {
  itemId: string;
  wallet: string;
  boughtAt: number;
  expiresAt?: number;
  swapSig: string;
  burnSig: string;
  usd: number;
  orbitxBurned: number;
  equipped?: boolean;
  listingMint?: string;
  bannerTitle?: string;
  bannerSubtitle?: string;
  bannerImageUrl?: string;
}

export const CITY_SHOP_ITEMS: ShopItem[] = [
  { id: "wear-gold-street", category: "wear", name: "Gold Street", blurb: "Matte black + gold jacket that reads at camera distance.", priceUsd: 5, accent: "#c5a26f", appearance: { outfit: "gold", bodyColor: "#c5a26f", accentColor: "#ffd700" } },
  { id: "wear-hoodie", category: "wear", name: "City Hoodie", blurb: "Everyday Midtown hoodie. Hang-out default.", priceUsd: 8, accent: "#00ff9f", appearance: { outfit: "hoodie", bodyColor: "#2a3344", accentColor: "#00ff9f" } },
  { id: "wear-neon-pulse", category: "wear", name: "Neon Pulse", blurb: "Emissive sneakers + trim. Night-safe even in daylight.", priceUsd: 12, accent: "#00ff9f", appearance: { outfit: "neon", bodyColor: "#1c2a38", accentColor: "#00ff9f" } },
  { id: "wear-royal", category: "wear", name: "Royal Suit", blurb: "HQ floor formal. Gold trim, black cloth.", priceUsd: 25, accent: "#e0c48a", appearance: { outfit: "royal", bodyColor: "#1a1428", accentColor: "#e0c48a" } },
  { id: "wear-pilot", category: "wear", name: "Midtown Pilot", blurb: "Flight jacket for plaza walks and launch nights.", priceUsd: 35, accent: "#3de7ff", appearance: { outfit: "pilot", bodyColor: "#3a4a58", accentColor: "#3de7ff" } },
  { id: "wear-legend", category: "wear", name: "OrbitX Legend", blurb: "Full neon kit. The city can see you from the park.", priceUsd: 80, accent: "#00ff9f", appearance: { outfit: "legend", bodyColor: "#0c1410", accentColor: "#00ff9f" } },
  { id: "hair-fade", category: "wear", name: "Fade Cut", blurb: "Clean fade. Reads from third-person.", priceUsd: 3, accent: "#c5a26f", appearance: { hairStyle: "fade", hairColor: "#1a1410" } },
  { id: "hair-twin", category: "wear", name: "Twin Tails", blurb: "Two-tail silhouette for the plaza.", priceUsd: 6, accent: "#ff4d9a", appearance: { hairStyle: "twin", hairColor: "#3a2318" } },
  { id: "hair-gold-hawk", category: "wear", name: "Gold Mohawk", blurb: "High-contrast hawk in OrbitX gold.", priceUsd: 15, accent: "#ffd700", appearance: { hairStyle: "mohawk", hairColor: "#e0c48a" } },

  { id: "char-pepe-gold", category: "character", name: "Pepe Gold", blurb: "Human Pepe kit — green jacket, gold trim. Still a person.", priceUsd: 20, accent: "#5cb85c", appearance: { classId: "pepe", outfit: "gold", bodyColor: "#3d7a38", accentColor: "#d4a017", skinColor: "#c9a07a" } },
  { id: "char-wojak-rose", category: "character", name: "Wojak Rose", blurb: "Soft hoodie + rose accent. Culture layer.", priceUsd: 18, accent: "#e8b4c8", appearance: { classId: "wojak", outfit: "hoodie", bodyColor: "#6b7280", accentColor: "#e8b4c8", skinColor: "#f3d5c0" } },
  { id: "char-chad-gold", category: "character", name: "Chad Aura", blurb: "Sport kit + gold chain. Clutch readable.", priceUsd: 40, accent: "#d4a017", appearance: { classId: "chad", outfit: "sport", bodyColor: "#3a5a72", accentColor: "#d4a017", skinColor: "#d4a574" } },
  { id: "char-doge-king", category: "character", name: "Doge King", blurb: "Gold collar scout. Such wow, still human.", priceUsd: 45, accent: "#e8a54b", appearance: { classId: "doge", outfit: "gold", bodyColor: "#d4893a", accentColor: "#c0392b", skinColor: "#d4a574", faceStyle: "smile" } },
  { id: "char-anon-crown", category: "character", name: "Anon Crown", blurb: "Laser-eye maxi in a royal suit.", priceUsd: 50, accent: "#f7931a", appearance: { classId: "anon", outfit: "royal", bodyColor: "#3a4454", accentColor: "#f7931a", skinColor: "#e8d5c0", faceStyle: "neutral" } },

  { id: "ad-plaza-1d", category: "ads", name: "Plaza Banner · 1 day", blurb: "South-face plaza ad on a Midtown walk-in.", priceUsd: 10, accent: "#c5a26f", adDays: 1 },
  { id: "ad-hq-3d", category: "ads", name: "HQ Face · 3 days", blurb: "OrbitX HQ east face. Projects notice.", priceUsd: 35, accent: "#00ff9f", adDays: 3 },
  { id: "ad-district-7d", category: "ads", name: "District Wrap · 7 days", blurb: "Games + Community faces for a week.", priceUsd: 75, accent: "#a78bfa", adDays: 7 },
  { id: "ad-citywide-7d", category: "ads", name: "Citywide · 7 days", blurb: "HQ + DEX + Market + Social. Maximum Midtown.", priceUsd: 200, accent: "#ffd700", adDays: 7 },

  { id: "list-watch", category: "listing", name: "HUD Watch Pin", blurb: "Pin any mint on your city tape.", priceUsd: 1, accent: "#00ff9f", listingTier: "watch" },
  { id: "list-board", category: "listing", name: "Live Board Listing", blurb: "Show your token on the city live wall.", priceUsd: 15, accent: "#3de7ff", listingTier: "board" },
  { id: "list-featured", category: "listing", name: "Featured Midtown", blurb: "Featured slot on the meme market + live tape.", priceUsd: 60, accent: "#c5a26f", listingTier: "featured" },
  { id: "list-prime", category: "listing", name: "Prime Tape + HQ", blurb: "Prime listing across HQ wall and city tape.", priceUsd: 150, accent: "#ffd700", listingTier: "prime" },

  { id: "perk-emote", category: "perk", name: "Hype Emote Pack", blurb: "Stronger dance emote on the plaza.", priceUsd: 8, accent: "#ff4d9a" },
  { id: "perk-nameplate", category: "perk", name: "Gold Nameplate", blurb: "Gold remote nametag so friends find you.", priceUsd: 12, accent: "#c5a26f" },
  { id: "perk-vip", category: "perk", name: "VIP Plaza Pass", blurb: "VIP badge + faster mission claims at HQ.", priceUsd: 25, accent: "#00ff9f" },
];

/** Banner targets: exact building id, `kind:hq`, or `kind:walkin`. */
const AD_TARGETS: Record<string, string[]> = {
  "ad-plaza-1d": ["kind:walkin"],
  "ad-hq-3d": ["kind:hq"],
  "ad-district-7d": ["kind:shop", "kind:social_hub"],
  "ad-citywide-7d": ["kind:walkin"],
};

export function bannerTargetsBuilding(targetId: string, buildingId: string, kind: string, walkIn: boolean): boolean {
  if (targetId === buildingId) return true;
  if (targetId === `kind:${kind}`) return true;
  if (targetId === "kind:walkin") return walkIn;
  return false;
}

export function getShopItem(id: string): ShopItem | undefined {
  return CITY_SHOP_ITEMS.find((item) => item.id === id);
}

export function shopItemsByCategory(category: ShopCategory): ShopItem[] {
  return CITY_SHOP_ITEMS.filter((item) => item.category === category);
}

export function shopPriceOk(item: ShopItem): boolean {
  return item.priceUsd >= 1 && item.priceUsd <= 200;
}

function storageKey(wallet: string): string {
  return `${CITY_SHOP_STORAGE}:${wallet}`;
}

export function loadPurchases(wallet: string): ShopPurchase[] {
  if (!wallet) return [];
  try {
    const raw = localStorage.getItem(storageKey(wallet));
    const list = raw ? (JSON.parse(raw) as ShopPurchase[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function savePurchases(wallet: string, purchases: ShopPurchase[]): void {
  if (!wallet) return;
  try {
    localStorage.setItem(storageKey(wallet), JSON.stringify(purchases));
  } catch {
    /* quota / private mode */
  }
}

export function upsertPurchase(wallet: string, purchase: ShopPurchase): ShopPurchase[] {
  const next = loadPurchases(wallet).filter((row) => row.itemId !== purchase.itemId);
  next.unshift(purchase);
  savePurchases(wallet, next);
  return next;
}

export function ownsItem(purchases: ShopPurchase[], itemId: string, now = Date.now()): boolean {
  return purchases.some((row) => row.itemId === itemId && (!row.expiresAt || row.expiresAt > now));
}

export function purchasesToInventory(purchases: ShopPurchase[], now = Date.now()): InventoryItem[] {
  return purchases
    .filter((row) => !row.expiresAt || row.expiresAt > now)
    .map((row) => {
      const item = getShopItem(row.itemId);
      const kind: InventoryItem["kind"] =
        item?.category === "ads" ? "ad_slot" : item?.category === "listing" ? "listing" : item?.category === "perk" ? "perk" : item?.category === "wear" || item?.category === "character" ? "cosmetic" : "badge";
      return {
        id: row.itemId,
        kind,
        label: item?.name ?? row.itemId,
        detail: row.listingMint ? `Mint ${row.listingMint.slice(0, 6)}…` : item?.blurb,
        mint: row.listingMint,
      };
    });
}

export function applyShopAppearance(base: AvatarAppearance, purchases: ShopPurchase[]): AvatarAppearance {
  const equipped = purchases.find((row) => row.equipped && getShopItem(row.itemId)?.appearance);
  if (!equipped) return base;
  const item = getShopItem(equipped.itemId);
  return { ...base, ...item?.appearance };
}

export function equipPurchase(wallet: string, itemId: string): ShopPurchase[] {
  const next = loadPurchases(wallet).map((row) => {
    const item = getShopItem(row.itemId);
    const sameLane = item && (item.category === "wear" || item.category === "character");
    const target = getShopItem(itemId);
    const targetLane = target && (target.category === "wear" || target.category === "character");
    if (row.itemId === itemId) return { ...row, equipped: true };
    if (sameLane && targetLane && item.category === target.category) return { ...row, equipped: false };
    return row;
  });
  savePurchases(wallet, next);
  return next;
}

export function liveUserBanners(purchases: ShopPurchase[], now = Date.now()): BuildingBanner[] {
  const out: BuildingBanner[] = [];
  for (const row of purchases) {
    if (row.expiresAt && row.expiresAt <= now) continue;
    const item = getShopItem(row.itemId);
    if (!item || item.category !== "ads") continue;
    const buildings = AD_TARGETS[item.id] ?? ["kind:walkin"];
    for (const buildingId of buildings) {
      out.push({
        id: `shop-${row.itemId}-${buildingId}-${row.boughtAt}`,
        buildingId,
        face: item.id === "ad-hq-3d" ? "east" : "south",
        u: 0.5,
        v: 0.7,
        width: item.id === "ad-citywide-7d" ? 5.2 : 3.8,
        height: 1.2,
        imageUrl: row.bannerImageUrl,
        title: row.bannerTitle || item.name,
        subtitle: row.bannerSubtitle || "ORBITX CITY SHOP",
        accent: item.accent,
      });
    }
  }
  return out;
}

export function liveListings(purchases: ShopPurchase[], now = Date.now()): Array<{ mint: string; tier: NonNullable<ShopItem["listingTier"]>; name: string }> {
  return purchases
    .filter((row) => row.listingMint && (!row.expiresAt || row.expiresAt > now))
    .map((row) => ({
      mint: row.listingMint!,
      tier: getShopItem(row.itemId)?.listingTier ?? "watch",
      name: getShopItem(row.itemId)?.name ?? "Listing",
    }));
}

export function orbitxNeeded(priceUsd: number, orbitxPriceUsd: number): number {
  if (!(orbitxPriceUsd > 0) || !(priceUsd > 0)) return 0;
  return (priceUsd / orbitxPriceUsd) * 1.03;
}

export const SHOP_HAIR: HairStyle[] = ["short", "long", "buzz", "bun", "mohawk", "fade", "twin"];
export const SHOP_OUTFITS: OutfitStyle[] = ["street", "suit", "sport", "neon", "hoodie", "gold", "royal", "pilot", "legend"];
