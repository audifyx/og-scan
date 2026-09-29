/**
 * ORBITXCITY — Districts module shared types.
 *
 * Self-contained: no imports from sibling modules or tokenomics.
 * Core (`../../core`) types are intentionally NOT imported here so this
 * module stays merge-safe; plain tuples are used for positions instead.
 */

export type Vec3T = [number, number, number];

/** A walk-up door in the outdoor world that teleports into an interior. */
export interface DoorTrigger {
  id: string;
  label: string;
  /** Outdoor world position (x, y, z). Core's world spawns around origin; units are meters. */
  position: Vec3T;
  /** Proximity radius (m) that shows the "Press E" prompt. */
  radius: number;
  prompt: string;
  interiorId: string;
  /** Where the player spawns inside the interior. */
  interiorSpawn: Vec3T;
  /** Where the player returns when exiting. */
  exitPosition: Vec3T;
}

/** Minimal live quote shape. The integrator feeds this from `useLivePrices`. */
export interface TokenQuote {
  symbol: string;
  price: number;
  change24h: number;
  mint?: string;
}

/** Result of a paper trade executed on a terminal. */
export interface PaperTradeResult {
  ok: boolean;
  message: string;
  symbol: string;
  side: "buy" | "sell";
  qty: number;
  price: number;
  notionalCity: number;
}

/** Wanted-level source of truth lives with the integrator; this is the adapter shape. */
export interface WantedProvider {
  getStars(): number;
  clear(): void;
}

/** Hospital respawn configuration. */
export interface RespawnConfig {
  position: Vec3T;
  heading: number;
}

/** A construction site driven by shipped platform features. */
export interface ConstructionSpec {
  id: string;
  name: string;
  description: string;
  position: Vec3T;
  footprint: [number, number];
  /** 0 = scaffolding … 1 = complete */
  progress: number;
  status: "scaffolding" | "framing" | "finishing" | "complete";
  /** OrbitX feature this construction unlocks in-world. */
  linkedFeature: string;
}

/** A dead-token exhibit in the Museum of Rugs. */
export interface RugExhibit {
  mint: string;
  symbol: string;
  name: string;
  peakPrice: number;
  lastPrice: number;
  /** -1 … 0 */
  drawdown: number;
  verdict: "confirmed-rug" | "slow-bleed" | "comeback?" | "hall-of-fame";
  epitaph: string;
}

/** A library archive entry. */
export interface ArchiveEntry {
  id: string;
  title: string;
  date: string;
  body: string[];
  tags: string[];
}

/** A constellation mapped to an NFT concept. */
export interface Constellation {
  id: string;
  name: string;
  symbol: string;
  /** indices into the star field */
  stars: number[];
  rarity: "common" | "rare" | "epic" | "legendary";
  lore: string;
  /** NFT plumbing lands later; this is the design-time mapping. */
  nft: { collection: string; trait: string };
}

/** City hall firm registration. */
export interface FirmRecord {
  id: string;
  name: string;
  owner: string;
  registeredAt: number;
  tier: "standard" | "premium";
}

/** Mayoral candidacy / vote. */
export interface MayorCandidate {
  id: string;
  name: string;
  platform: string;
  votes: number;
}

/** Fine issued by the city. */
export interface FineRecord {
  id: string;
  reason: string;
  amountCity: number;
  issuedAt: number;
  paid: boolean;
}

/** Pluggable second-island zone descriptor (core owns the bridge seam). */
export interface IslandZoneSpec {
  id: string;
  name: string;
  biome: "volcanic" | "tropical" | "neon-docks" | "arctic";
  /** Center of the island in world coords. */
  center: Vec3T;
  /** Radius in meters. */
  radius: number;
  tagline: string;
}
