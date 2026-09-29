/**
 * OrbitXCity — Real Estate catalog data.
 * Districts, property tiers, buyable properties, furniture, hotels, auction
 * lot templates. Pure data + deterministic helpers; no side effects.
 */
import type {
  AuctionLot,
  CatalogProperty,
  District,
  FurnitureItem,
  Hotel,
  PropertyTier,
} from "../types";

export const DISTRICTS: District[] = [
  { id: "downtown", name: "Downtown Core", tagline: "Glass towers, money weather", baseTraffic: 0.95, rentMultiplier: 1.6, color: "#38bdf8" },
  { id: "neon", name: "Neon Strip", tagline: "The city never sleeps here", baseTraffic: 1.0, rentMultiplier: 1.45, color: "#f0f" },
  { id: "marina", name: "Marina Bay", tagline: "Yachts, sunsets, soft money", baseTraffic: 0.7, rentMultiplier: 1.5, color: "#2dd4bf" },
  { id: "oldtown", name: "Old Town", tagline: "Brick, history, foot traffic", baseTraffic: 0.8, rentMultiplier: 1.2, color: "#fbbf24" },
  { id: "vista", name: "Vista Hills", tagline: "Views for days, quiet streets", baseTraffic: 0.4, rentMultiplier: 1.35, color: "#a78bfa" },
  { id: "industrial", name: "Industrial Flats", tagline: "Cheap land, big plays", baseTraffic: 0.35, rentMultiplier: 0.9, color: "#94a3b8" },
];

export function districtById(id: string): District {
  return DISTRICTS.find((d) => d.id === id) ?? DISTRICTS[0];
}

/** Upgrade ladder. Tier 0 = raw lot (as bought). Costs are ORBITX, burned. */
export const PROPERTY_TIERS: PropertyTier[] = [
  { tier: 0, label: "Raw Lot", buildName: "Empty lot", multiplier: 1.0, upgradeCostOrbitx: 0 },
  { tier: 1, label: "Squat", buildName: "Corner kiosk", multiplier: 1.6, upgradeCostOrbitx: 40 },
  { tier: 2, label: "Walkup", buildName: "Two-story walkup", multiplier: 2.6, upgradeCostOrbitx: 120 },
  { tier: 3, label: "Loft", buildName: "Designer loft block", multiplier: 4.2, upgradeCostOrbitx: 350 },
  { tier: 4, label: "Tower", buildName: "Mid-rise tower", multiplier: 6.8, upgradeCostOrbitx: 900 },
  { tier: 5, label: "Landmark", buildName: "City landmark", multiplier: 11.0, upgradeCostOrbitx: 2200 },
];

export function tierByLevel(tier: number): PropertyTier {
  return PROPERTY_TIERS[Math.max(0, Math.min(5, tier))] ?? PROPERTY_TIERS[0];
}

const P = (
  id: string,
  districtId: string,
  name: string,
  kind: CatalogProperty["kind"],
  basePriceOrbitx: number,
  baseRentCityPerHour: number,
  description: string,
): CatalogProperty => ({ id, districtId, name, kind, basePriceOrbitx, baseRentCityPerHour, description });

/** 18 buyable properties across 6 districts. */
export const PROPERTIES: CatalogProperty[] = [
  P("neon-loft-3", "neon", "Neon Loft Block 3", "building", 420, 14, "Three floors of raw space above the loudest corner of the Strip."),
  P("neon-kiosk-7", "neon", "Strip Kiosk 7", "storefront", 150, 9, "A glass kiosk dead-center in the midnight foot-traffic river."),
  P("neon-lot-12", "neon", "Back-Alley Lot 12", "plot", 60, 4, "Grimy, loud, perfect. Build something the Strip will notice."),
  P("dt-tower-apex", "downtown", "Apex Tower — Floors 40–42", "building", 780, 22, "Skyline-defining office stack with helipad rights."),
  P("dt-arcade-2", "downtown", "Meridian Arcade Unit 2", "storefront", 200, 11, "Corner retail under the Meridian arches. Bankers buy lunch here."),
  P("dt-lot-5", "downtown", "Founders' Lot 5", "plot", 95, 5, "The last unbuilt parcel on Founders' Row. Zoning is generous."),
  P("marina-pier-9", "marina", "Pier 9 Warehouse", "building", 520, 16, "Converted warehouse on the water. Rooftop potential is unreal."),
  P("marina-cafe-1", "marina", "Boardwalk Café 1", "storefront", 170, 10, "Sunset-view café with a line out the door every evening."),
  P("marina-slip-4", "marina", "Slip 4 Parcel", "plot", 70, 4, "Waterfront dirt. The view alone prints money."),
  P("old-brick-14", "oldtown", "Brick Row 14", "building", 310, 12, "1890s brick, gut-renovated. Tourists photograph your doorway."),
  P("old-market-3", "oldtown", "Old Market Stall 3", "storefront", 110, 8, "A stall in the covered market, oldest foot traffic in the city."),
  P("old-court-8", "oldtown", "Courtyard Lot 8", "plot", 45, 3, "Cobblestone courtyard parcel behind the clock tower."),
  P("vista-ridge-1", "vista", "Ridge Villa Plot 1", "plot", 85, 4, "Build above the clouds. The whole bay is your backyard."),
  P("vista-lodge-2", "vista", "Summit Lodge", "building", 460, 13, "Timber-and-glass lodge with a private funicular stop."),
  P("vista-kiosk-1", "vista", "Overlook Kiosk", "storefront", 130, 7, "The only coffee on the scenic route. A license to print."),
  P("ind-yard-21", "industrial", "Yard 21", "plot", 28, 2, "Two acres of concrete and possibility. No neighbors to annoy."),
  P("ind-depot-6", "industrial", "Depot 6", "building", 240, 9, "Rail-adjacent depot with 40ft ceilings. Warehouses are the new lofts."),
  P("ind-diner-9", "industrial", "Graveyard Diner", "storefront", 80, 6, "24-hour diner feeding the night shift. Cash business."),
];

export function propertyById(id: string): CatalogProperty | undefined {
  return PROPERTIES.find((p) => p.id === id);
}

/** Foot-traffic factor for a district at a given time (0.55 .. 1.0+).
 *  Deterministic: peaks ~20:00 local, troughs ~04:00. */
export function footTrafficAt(districtId: string, at: number = Date.now()): number {
  const d = districtById(districtId);
  const hour = new Date(at).getHours() + new Date(at).getMinutes() / 60;
  // Gaussian-ish peak centered at 20:00, trough at 04:00.
  const peak = 20;
  let dist = Math.abs(hour - peak);
  if (dist > 12) dist = 24 - dist;
  const curve = Math.exp(-(dist * dist) / 18); // 1 at peak → ~0.04 at trough
  const swing = 0.45;
  return d.baseTraffic * (1 - swing + swing * curve) + 0.12 * curve;
}

/** Paper-CITY rent per hour for a deed at a given tier & time. */
export function rentPerHour(propertyId: string, tier: number, at: number = Date.now()): number {
  const p = propertyById(propertyId);
  if (!p) return 0;
  const d = districtById(p.districtId);
  return p.baseRentCityPerHour * d.rentMultiplier * tierByLevel(tier).multiplier * footTrafficAt(p.districtId, at);
}

/* ── Furniture catalog ───────────────────────────────────────────── */

export const FURNITURE: FurnitureItem[] = [
  { id: "neon-sign", name: "Neon wall sign", icon: "🪩", costCity: 120, blurb: "Your name in light. Obviously." },
  { id: "pool-table", name: "Pool table", icon: "🎱", costCity: 300, blurb: "Settle beef the classy way." },
  { id: "arcade-cab", name: "Arcade cabinet", icon: "🕹️", costCity: 450, blurb: "Plays the city chart game. Loudly." },
  { id: "vault-door", name: "Vault door", icon: "🚪", costCity: 200, blurb: "Safehouse energy. Nobody asks questions." },
  { id: "rooftop-bar", name: "Rooftop bar", icon: "🍸", costCity: 800, blurb: "Sunset views, expensive taste." },
  { id: "gym-rack", name: "Gym rack", icon: "🏋️", costCity: 350, blurb: "Gains are the real currency." },
  { id: "studio-desk", name: "Studio desk", icon: "🎛️", costCity: 500, blurb: "Mix tapes at 3am." },
  { id: "aquarium", name: "Wall aquarium", icon: "🐠", costCity: 650, blurb: "Sharks would be cheaper emotionally." },
  { id: "holo-fire", name: "Hologram fireplace", icon: "🔥", costOrbitx: 25, blurb: "Premium warmth. Zero smoke." },
  { id: "orb-chandelier", name: "Orbit chandelier", icon: "💠", costOrbitx: 60, blurb: "A miniature solar system over dinner." },
  { id: "ai-butler", name: "AI butler core", icon: "🤖", costOrbitx: 120, blurb: "Greets guests. Judges them silently." },
  { id: "sky-deck", name: "Glass sky deck", icon: "🌃", costOrbitx: 200, blurb: "Floor-to-nothing views. Vertigo included." },
  { id: "vault-gallery", name: "NFT gallery wall", icon: "🖼️", costOrbitx: 90, blurb: "Show off the collection." },
  { id: "race-sim", name: "Racing sim rig", icon: "🏎️", costCity: 700, blurb: "Practice for the streets. Legally." },
  { id: "garden-pod", name: "Garden pod", icon: "🌿", costCity: 250, blurb: "Oxygen, but make it interior design." },
  { id: "dj-booth", name: "DJ booth", icon: "🎧", costOrbitx: 150, blurb: "Your place is now the afterparty." },
];

export function furnitureById(id: string): FurnitureItem | undefined {
  return FURNITURE.find((f) => f.id === id);
}

/* ── Hotels ──────────────────────────────────────────────────────── */

export const HOTELS: Hotel[] = [
  {
    id: "halcyon",
    name: "The Halcyon",
    districtId: "downtown",
    stars: 5,
    roomNightCity: 180,
    blurb: "Marble, silence, and a lobby that smells like money.",
    suites: [
      { id: "halcyon-sky", name: "Sky Suite", priceOrbitx: 400, loginBonusCity: 120, streakBonusPct: 0.05, blurb: "Top floor. The city is your screensaver." },
      { id: "halcyon-royal", name: "Royal Orbit Suite", priceOrbitx: 950, loginBonusCity: 300, streakBonusPct: 0.08, blurb: "Butler, observatory, private elevator." },
    ],
  },
  {
    id: "neonest",
    name: "Neon Nest",
    districtId: "neon",
    stars: 4,
    roomNightCity: 120,
    blurb: "Sleep above the Strip. Blackout curtains are structural.",
    suites: [
      { id: "neonest-pent", name: "Strip Penthouse", priceOrbitx: 600, loginBonusCity: 200, streakBonusPct: 0.06, blurb: "Wraparound balcony over the neon river." },
    ],
  },
  {
    id: "driftwood",
    name: "Driftwood Inn",
    districtId: "marina",
    stars: 3,
    roomNightCity: 70,
    blurb: "Salt air, slow mornings, honest prices.",
    suites: [
      { id: "driftwood-harbor", name: "Harbor Suite", priceOrbitx: 280, loginBonusCity: 90, streakBonusPct: 0.04, blurb: "Wake up to foghorns and gulls." },
    ],
  },
];

export function hotelById(id: string): Hotel | undefined {
  return HOTELS.find((h) => h.id === id);
}

export function suiteById(suiteId: string): { hotel: Hotel; suite: import("../types").Suite } | undefined {
  for (const hotel of HOTELS) {
    const suite = hotel.suites.find((s) => s.id === suiteId);
    if (suite) return { hotel, suite };
  }
  return undefined;
}

/* ── Penthouse auction lot templates (flagship) ──────────────────── */

interface LotTemplate {
  title: string;
  districtId: string;
  tagline: string;
  imageGlyph: string;
  startingBidOrbitx: number;
}

const LOT_TEMPLATES: LotTemplate[] = [
  { title: "Apex Crown Penthouse", districtId: "downtown", tagline: "3 floors. Private helipad. Zero neighbors above you.", imageGlyph: "🏙️", startingBidOrbitx: 1500 },
  { title: "Neon Mirage Skyloft", districtId: "neon", tagline: "Glass walls over the Strip. The view never logs off.", imageGlyph: "🌃", startingBidOrbitx: 1200 },
  { title: "Marina Meridian Penthouse", districtId: "marina", tagline: "360° water views. Dock your yacht, elevator home.", imageGlyph: "🌅", startingBidOrbitx: 1100 },
  { title: "Vista Celestial Villa", districtId: "vista", tagline: "Above the clouds with an infinity edge on the sky.", imageGlyph: "☁️", startingBidOrbitx: 900 },
  { title: "Old Town Clocktower Loft", districtId: "oldtown", tagline: "Live inside the landmark. The bells are yours now.", imageGlyph: "🕰️", startingBidOrbitx: 750 },
  { title: "Foundry Sky Foundry", districtId: "industrial", tagline: "Brutalist masterpiece. Concrete has never felt this rich.", imageGlyph: "🏭", startingBidOrbitx: 600 },
];

const AUCTION_DURATION_MS = 30 * 60_000; // 30 min per lot
const AUCTION_GAP_MS = 5 * 60_000; // 5 min breather between lots
export const ANTI_SNIPE_MS = 60_000; // late bids extend the lot
export const ANTI_SNIPE_WINDOW_MS = 60_000;

/** Deterministic lot schedule anchored at a fixed epoch so every client
 *  agrees on which lot is live without a server. */
const SCHEDULE_ANCHOR = Date.UTC(2026, 8, 29, 12, 0, 0); // 2026-09-29 12:00 UTC

export function lotForSlot(slot: number): AuctionLot {
  const t = LOT_TEMPLATES[((slot % LOT_TEMPLATES.length) + LOT_TEMPLATES.length) % LOT_TEMPLATES.length];
  const startsAt = SCHEDULE_ANCHOR + slot * (AUCTION_DURATION_MS + AUCTION_GAP_MS);
  return {
    lotId: `penthouse-${slot}`,
    title: t.title,
    districtId: t.districtId,
    tagline: t.tagline,
    imageGlyph: t.imageGlyph,
    startsAt,
    endsAt: startsAt + AUCTION_DURATION_MS,
    startingBidOrbitx: t.startingBidOrbitx,
    minIncrementPct: 0.05,
    status: "upcoming",
    wonByPlayer: false,
  };
}

export function currentSlot(now: number = Date.now()): number {
  return Math.floor((now - SCHEDULE_ANCHOR) / (AUCTION_DURATION_MS + AUCTION_GAP_MS));
}

export function auctionDurationMs(): number {
  return AUCTION_DURATION_MS;
}

/* ── Homes: apartments (ORBITX) + safehouses (CITY) ─────────────────── */

import type { HomeTemplate } from "../types";

const H = (
  id: string,
  kind: HomeTemplate["kind"],
  name: string,
  districtId: string,
  decoSlots: number,
  blurb: string,
  cost: { costOrbitx?: number; costCity?: number },
): HomeTemplate => ({ id, kind, name, districtId, decoSlots, blurb, ...cost });

export const HOMES: HomeTemplate[] = [
  H("apt-stack-7", "apartment", "The Stacks — Unit 7", "downtown", 8,
    "Concrete-and-glass corner unit 30 floors up. The skyline is your wallpaper.",
    { costOrbitx: 260 }),
  H("apt-strip-sky", "apartment", "Strip Sky Suite", "neon", 10,
    "Wraparound windows over the neon river. Blackout shades for the mornings after.",
    { costOrbitx: 480 }),
  H("apt-marina-sun", "apartment", "Marina Sundeck Flat", "marina", 8,
    "Salt air, a private sundeck, and gulls as your alarm clock.",
    { costOrbitx: 390 }),
  H("safe-cellar", "safehouse", "Old Town Cellar", "oldtown", 4,
    "Brick vault under the market. Nobody knows you're here.",
    { costCity: 1500 }),
  H("safe-lockup", "safehouse", "Industrial Lockup", "industrial", 4,
    "Roller door, concrete, no questions. The night shift waves hello.",
    { costCity: 800 }),
  H("safe-cabin", "safehouse", "Vista Hills Cabin", "vista", 4,
    "Timber cabin above the clouds. Off the grid, on the map.",
    { costCity: 1200 }),
];

export function homeTemplateById(id: string): HomeTemplate | undefined {
  return HOMES.find((h) => h.id === id);
}

/** Synthetic catalog property for a won penthouse lot (tier 5 landmark). */
export function penthousePropertyFor(lotId: string, title: string, districtId: string): CatalogProperty {
  return {
    id: `deed:${lotId}`,
    districtId,
    name: title,
    kind: "building",
    basePriceOrbitx: 0,
    baseRentCityPerHour: 34,
    description: `Won at auction — a landmark penthouse above ${districtById(districtId).name}.`,
  };
}
