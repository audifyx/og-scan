/**
 * OrbitXCity — Vehicles module: deep sea diving (treasure chests).
 *
 * Freediving the shallows is free; the Abyss Dive Supply shop sells scuba
 * gear (paper CITY) that unlocks the deep sites. Treasure chests sit on the
 * seabed at fixed spots — crack one for a paper-CITY haul, then it respawns
 * after 24h. Oxygen is the timer: run dry and you're forced to surface.
 */
import type { MapPoint, PaperDelta } from "./types";

export const DIVE_SHOP: MapPoint = {
  name: "Abyss Dive Supply",
  x: 216,
  z: 152,
  blip: "🤿 Dive Shop",
};

/** Scuba gear price (paper CITY); unlocks dives deeper than 20m. */
export const SCUBA_GEAR_PRICE_CITY = 1200;

/** Freedive limit without gear. */
export const FREEDIVE_LIMIT_M = 20;
/** Max depth with scuba gear. */
export const SCUBA_LIMIT_M = 60;

export function quoteScubaGear(): PaperDelta {
  return {
    amount: -SCUBA_GEAR_PRICE_CITY,
    label: "Abyss Dive Supply — scuba gear",
    source: "vehicles:diving",
  };
}

export interface DiveSite extends MapPoint {
  siteId: string;
  maxDepthM: number;
  description: string;
}

export const DIVE_SITES: DiveSite[] = [
  { siteId: "shallow-reef", name: "Shallow Reef", x: 280, z: 220, blip: "🐠 Reef Dive", maxDepthM: 15, description: "Sunlit reef. Freedive friendly." },
  { siteId: "coral-gardens", name: "Coral Gardens", x: 340, z: 260, blip: "🐠 Coral Dive", maxDepthM: 30, description: "Coral canyons — scuba recommended." },
  { siteId: "galleon-approach", name: "Galleon Approach", x: 540, z: 320, blip: "⚓ Galleon Dive", maxDepthM: 45, description: "Debris field leading to the ancient galleon." },
  { siteId: "trench-wall", name: "Trench Wall", x: 660, z: 400, blip: "⚠️ Trench Dive", maxDepthM: 58, description: "Sheer wall dropping into the dark. Experts only." },
];

export function siteOf(siteId: string): DiveSite {
  const s = DIVE_SITES.find((x) => x.siteId === siteId);
  if (!s) throw new Error(`Unknown dive site: ${siteId}`);
  return s;
}

export type ChestTier = "common" | "rare" | "legendary";

export interface TreasureChest {
  chestId: string;
  siteId: string;
  tier: ChestTier;
  depthM: number;
  /** x/z offset (meters) from the site center. */
  dx: number;
  dz: number;
  /** Timestamp of last loot; null = never looted. */
  lootedAt: number | null;
}

export const CHESTS: TreasureChest[] = [
  // shallow reef (freedive)
  { chestId: "reef-1", siteId: "shallow-reef", tier: "common", depthM: 8, dx: 12, dz: -6, lootedAt: null },
  { chestId: "reef-2", siteId: "shallow-reef", tier: "common", depthM: 12, dx: -18, dz: 14, lootedAt: null },
  { chestId: "reef-3", siteId: "shallow-reef", tier: "common", depthM: 14, dx: 24, dz: 20, lootedAt: null },
  // coral gardens
  { chestId: "coral-1", siteId: "coral-gardens", tier: "common", depthM: 18, dx: 10, dz: 8, lootedAt: null },
  { chestId: "coral-2", siteId: "coral-gardens", tier: "rare", depthM: 26, dx: -22, dz: -10, lootedAt: null },
  { chestId: "coral-3", siteId: "coral-gardens", tier: "rare", depthM: 30, dx: 30, dz: -24, lootedAt: null },
  // galleon approach
  { chestId: "galleon-1", siteId: "galleon-approach", tier: "rare", depthM: 32, dx: -14, dz: 18, lootedAt: null },
  { chestId: "galleon-2", siteId: "galleon-approach", tier: "rare", depthM: 40, dx: 20, dz: -12, lootedAt: null },
  { chestId: "galleon-3", siteId: "galleon-approach", tier: "legendary", depthM: 45, dx: -30, dz: -28, lootedAt: null },
  // trench wall
  { chestId: "trench-1", siteId: "trench-wall", tier: "rare", depthM: 48, dx: 8, dz: 10, lootedAt: null },
  { chestId: "trench-2", siteId: "trench-wall", tier: "legendary", depthM: 55, dx: -16, dz: 22, lootedAt: null },
  { chestId: "trench-3", siteId: "trench-wall", tier: "legendary", depthM: 58, dx: 26, dz: -18, lootedAt: null },
];

/** Chests respawn 24h after being looted. */
export const CHEST_RESPAWN_MS = 24 * 60 * 60 * 1000;

export function chestAvailable(chest: TreasureChest, now = Date.now()): boolean {
  return chest.lootedAt === null || now - chest.lootedAt >= CHEST_RESPAWN_MS;
}

export function chestsAt(siteId: string, now = Date.now()): TreasureChest[] {
  return CHESTS.filter((c) => c.siteId === siteId && chestAvailable(c, now));
}

export interface DiveSession {
  id: string;
  siteId: string;
  startedAt: number;
  /** True when the player owns scuba gear. */
  hasGear: boolean;
  /** Oxygen 0..1 — forced surface at zero. */
  oxygen01: number;
  /** Chest ids cracked this dive. */
  opened: string[];
  /** True once oxygen ran dry (dive over, loot kept). */
  surfaced: boolean;
}

export function startDive(siteId: string, hasGear: boolean, now = Date.now()): DiveSession {
  const site = siteOf(siteId);
  const limit = hasGear ? SCUBA_LIMIT_M : FREEDIVE_LIMIT_M;
  if (site.maxDepthM > limit) {
    throw new Error(`${site.name} hits ${site.maxDepthM}m — buy scuba gear first`);
  }
  return {
    id: `dive-${now.toString(36)}-${Math.floor(Math.random() * 1e4)}`,
    siteId,
    startedAt: now,
    hasGear,
    oxygen01: 1,
    opened: [],
    surfaced: false,
  };
}

/** Oxygen tick: deeper = faster drain. Returns updated session (surfaced at 0). */
export function tickOxygen(session: DiveSession, dtSec: number, depthM: number): DiveSession {
  if (session.surfaced || session.oxygen01 <= 0) return { ...session, surfaced: true };
  const base = session.hasGear ? 0.008 : 0.02; // ~2min geared, ~50s freedive
  const drain = (base + (depthM / SCUBA_LIMIT_M) * base) * dtSec;
  const oxygen01 = Math.max(0, session.oxygen01 - drain);
  return { ...session, oxygen01, surfaced: oxygen01 <= 0 };
}

export const LOW_OXYGEN_AT = 0.25;

const CHEST_LOOT: Record<ChestTier, [number, number]> = {
  common: [50, 150],
  rare: [200, 500],
  legendary: [800, 2000],
};

export interface ChestOpening {
  session: DiveSession;
  chest: TreasureChest;
  /** Null when the chest was already cracked this dive. */
  loot: PaperDelta | null;
}

/**
 * Crack a chest. All loot is paper CITY (premium never drops from chests —
 * it always burns, per product law). Mutates the shared CHESTS lootedAt via
 * the returned chest copy; the integrator persists it.
 */
export function openChest(
  session: DiveSession,
  chest: TreasureChest,
  now = Date.now(),
): ChestOpening {
  if (session.surfaced) throw new Error("Dive is over — surface first");
  if (!chestAvailable(chest, now)) throw new Error("Chest already looted — it respawns in 24h");
  const limit = session.hasGear ? SCUBA_LIMIT_M : FREEDIVE_LIMIT_M;
  if (chest.depthM > limit) throw new Error(`Chest is at ${chest.depthM}m — out of reach without scuba gear`);
  if (session.opened.includes(chest.chestId)) {
    return { session, chest, loot: null };
  }
  const [lo, hi] = CHEST_LOOT[chest.tier];
  const amount = Math.floor(lo + Math.random() * (hi - lo));
  return {
    session: { ...session, opened: [...session.opened, chest.chestId] },
    chest: { ...chest, lootedAt: now },
    loot: {
      amount,
      label: `Treasure chest — ${chest.tier} (${chest.chestId})`,
      source: "vehicles:diving",
    },
  };
}

/** World position of a chest (integrator places the 3D marker). */
export function chestWorldPos(chest: TreasureChest): { x: number; z: number; depthM: number } {
  const site = siteOf(chest.siteId);
  return { x: site.x + chest.dx, z: site.z + chest.dz, depthM: chest.depthM };
}
