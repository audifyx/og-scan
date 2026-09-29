/**
 * OrbitXCity — Real Estate module shared types.
 *
 * Self-contained: NO imports from other city modules. The billing provider
 * interface below is intentionally duplicated from the economy module's
 * `OrbitxBillingProvider` (and mirrors `web/src/city/BILLING_CONTRACT.md`)
 * so this module compiles with zero cross-module imports.
 *
 * Currency split (locked by the user):
 *  - CITY   — paper coins for gameplay (rent payouts, hotel rooms, basic
 *             furniture, login bonuses). Local ledger only, never on-chain.
 *  - ORBITX — real on-chain token for premium: deed purchases, tier
 *             upgrades, auction bids (ALL bids burned, win or lose), suite
 *             purchases, premium furniture. Every spend = backend-signed
 *             buy-and-burn. The game never custodies keys or holds funds.
 */

export type Currency = "CITY" | "ORBITX";

/**
 * Expected interface of the tokenomics-provided billing primitive
 * (`web/src/tokenomics/useOrbitxBilling` — see
 * `web/src/city/BILLING_CONTRACT.md`).
 *
 * The real estate module does NOT import `@/tokenomics/*` directly (the
 * directory does not exist yet — importing it would break the build).
 * The integrator injects a provider implementing this interface into the
 * UI via props: `<RealEstateHub billing={useOrbitxBilling()} />`.
 * Until then, premium UI renders the auth-required state and the world
 * runs on paper CITY only.
 */
export interface OrbitxBillingProvider {
  /** Auth-once complete; backend can sign spends. */
  ready: boolean;
  /** On-chain ORBITX balance in the in-app wallet. Null = unknown/loading. */
  balance: number | null;
  /** Backend-signed burn spend. No wallet popup, ever. */
  spend: (opts: {
    amount: number; // whole ORBITX tokens
    reason: string; // e.g. "city-realestate:deed:neon-loft-3"
    ref?: string; // idempotency / ledger ref
  }) => Promise<{ signature: string }>;
  /** Kicks the dashboard auth-code flow if not authed yet. */
  beginAuth: () => void;
}

/** One record of a real ORBITX burn made from this module. */
export interface BurnRecord {
  at: number;
  itemId: string;
  itemLabel: string;
  amount: number; // ORBITX burned
  signature: string;
  ref: string;
}

/** Paper-CITY sink/credit callbacks injected by the integrator (wired to the
 *  economy module's paper wallet). Defaults are no-ops so the module works
 *  standalone. */
export interface PaperLedger {
  /** Credit paper CITY (rent payouts, login bonuses). */
  credit: (amount: number, label: string, source: string) => void;
  /** Debit paper CITY (hotel rooms, basic furniture). Throws if insufficient. */
  debit: (amount: number, label: string, source: string) => void;
  /** Current paper balance (for affordability checks). Null = unknown. */
  balance: () => number | null;
}

/* ── Districts & tiers ─────────────────────────────────────────────── */

export interface District {
  id: string;
  name: string;
  tagline: string;
  /** Base foot-traffic 0..1 (midday). */
  baseTraffic: number;
  /** Rent payout multiplier. */
  rentMultiplier: number;
  /** Accent color for UI. */
  color: string;
}

export type PropertyKind = "plot" | "storefront" | "building";

export interface PropertyTier {
  tier: number; // 0 = raw lot … 5 = landmark
  label: string;
  buildName: string;
  /** Rent multiplier applied at this tier. */
  multiplier: number;
  /** ORBITX to upgrade INTO this tier from the previous one. */
  upgradeCostOrbitx: number;
}

export interface CatalogProperty {
  id: string;
  districtId: string;
  name: string;
  kind: PropertyKind;
  basePriceOrbitx: number;
  /** Base paper-CITY rent per hour at tier 0, midday traffic. */
  baseRentCityPerHour: number;
  description: string;
}

/* ── Deeds (NFT deeds) ────────────────────────────────────────────── */

export interface Deed {
  deedId: string;
  propertyId: string;
  propertyName: string;
  districtId: string;
  kind: PropertyKind;
  ownerId: string;
  tier: number; // 0..5
  purchasedAt: number; // epoch ms
  purchasePriceOrbitx: number;
  purchaseSignature: string; // burn tx signature
  upgrades: { tier: number; at: number; signature: string }[];
  /** Listed on the market (local flag; settlement via /nft market). */
  listed?: { priceOrbitx: number; at: number };
  /** On-chain NFT mint address once the deed NFT is minted (backend-signed
   *  desk-wallet flow, recorded via `deedStore.recordDeedNftMint`). */
  mintAddress?: string;
  /** Mint tx signature for the on-chain deed NFT. */
  mintSignature?: string;
  /** Provenance for the NFT metadata payload. */
  nft: DeedNftMetadata;
}

/** Metadata payload the platform's existing NFT infra can mint/list.
 *  Produced by `deedToNftMetadata()` — the actual on-chain mint happens
 *  through the existing `/nft/create` flow (read-only reuse, never rebuilt). */
export interface DeedNftMetadata {
  name: string;
  symbol: string;
  description: string;
  /** Attributes in the marketplace's standard trait format. */
  attributes: { trait_type: string; value: string | number }[];
  /** Stable external id linking the NFT back to this deed. */
  externalId: string;
}

/** Rent accrual state per deed (persisted). */
export interface RentState {
  deedId: string;
  /** Paper CITY accrued but not yet collected. */
  pendingCity: number;
  /** Epoch ms of the last accrual tick. */
  lastTickAt: number;
}

/* ── Penthouse auctions ───────────────────────────────────────────── */

export type AuctionStatus = "upcoming" | "live" | "ended";

export interface AuctionLot {
  lotId: string;
  title: string;
  districtId: string;
  tagline: string;
  imageGlyph: string; // emoji/text glyph — no asset deps
  startsAt: number; // epoch ms
  endsAt: number; // epoch ms (extends on late bids — anti-snipe)
  startingBidOrbitx: number;
  minIncrementPct: number; // e.g. 0.05 = +5%
  status: AuctionStatus;
  winnerBidId?: string;
  winningBidderId?: string;
  winningBidderName?: string;
  winningAmountOrbitx?: number;
  /** True when the winner is the local player (deed minted). */
  wonByPlayer: boolean;
}

export interface Bid {
  bidId: string;
  lotId: string;
  bidderId: string;
  bidderName: string;
  amountOrbitx: number;
  at: number;
  /** Burn tx signature (real bids). NPC/simulated bids have none. */
  signature?: string;
  /** True for simulated rival bidders (paper only, never touch the chain). */
  npc: boolean;
}

/* ── Apartments & safehouses ──────────────────────────────────────── */

export type HomeKind = "apartment" | "safehouse";

export interface Home {
  homeId: string;
  kind: HomeKind;
  name: string;
  districtId: string;
  ownerId: string;
  purchasedAt: number;
  purchaseSignature?: string; // ORBITX burn (apartments); undefined for CITY safehouses
  /** Decoration slots by room area. */
  decoSlots: number;
  furniture: PlacedFurniture[];
  guests: string[]; // invited friend player-ids
  isSpawnPoint: boolean;
}

export interface FurnitureItem {
  id: string;
  name: string;
  icon: string; // emoji/text glyph — no asset deps
  costCity?: number; // paper CITY price
  costOrbitx?: number; // premium ORBITX price (burned)
  blurb: string;
}

export interface PlacedFurniture {
  instanceId: string;
  itemId: string;
  placedAt: number;
}

/* ── Apartments & safehouses catalog ─────────────────────────────── */

export interface HomeTemplate {
  id: string;
  kind: HomeKind;
  name: string;
  districtId: string;
  /** One-time ORBITX burn price (apartments). */
  costOrbitx?: number;
  /** Paper CITY price (safehouses). */
  costCity?: number;
  decoSlots: number;
  blurb: string;
}

/* ── Hotel chain ──────────────────────────────────────────────────── */

export type RoomKind = "standard" | "suite";

export interface Suite {
  id: string;
  name: string;
  /** One-time ORBITX purchase price (burned). */
  priceOrbitx: number;
  /** Paper-CITY login bonus granted per day while owned. */
  loginBonusCity: number;
  /** Extra % bonus per consecutive-day streak (0.05 = +5%/day). */
  streakBonusPct: number;
  blurb: string;
}

export interface Hotel {
  id: string;
  name: string;
  districtId: string;
  stars: number;
  /** Paper CITY per night for a standard room. */
  roomNightCity: number;
  suites: Suite[];
  blurb: string;
}

export interface HotelStay {
  hotelId: string;
  roomKind: RoomKind;
  suiteId?: string;
  checkedInAt: number; // epoch ms
  nights: number;
  /** For suites: the purchase burn signature. */
  purchaseSignature?: string;
}

/** Checkpoint written by "sleep to save". */
export interface SleepCheckpoint {
  at: number;
  hotelId: string;
  roomKind: RoomKind;
  suiteId?: string;
  homeId?: string;
  note: string;
}

/** Login-bonus claim result. */
export interface LoginBonus {
  claimedAt: number;
  suiteId: string;
  suiteName: string;
  baseCity: number;
  streakDays: number;
  bonusCity: number; // total credited
}
