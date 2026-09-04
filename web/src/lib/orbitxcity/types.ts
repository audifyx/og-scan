/** OrbitX City — core world types (scalable city / district / building model). */

export type CityId = "nyc" | "miami" | "la" | "boston";

export type DistrictKind =
  | "trading"
  | "launch"
  | "meme_market"
  | "social"
  | "advertising"
  | "hq"
  | "creator"
  | "developer"
  | "community";

export type BuildingKind =
  | "hq"
  | "market"
  | "launch_arena"
  | "trading_floor"
  | "social_hub"
  | "ad_tower"
  | "shop"
  | "plaza"
  | "generic";

export type InteractionKind =
  | "marketplace"
  | "launch"
  | "trading"
  | "community"
  | "billboard"
  | "hq"
  | "token"
  | "voice"
  | "games"
  | "nft";

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface CityDefinition {
  id: CityId;
  name: string;
  tagline: string;
  purpose: string;
  accent: string;
  unlocked: boolean;
}

export interface DistrictDefinition {
  id: string;
  cityId: CityId;
  kind: DistrictKind;
  name: string;
  description: string;
  center: Vec3;
  size: { width: number; depth: number };
}

export interface BuildingDefinition {
  id: string;
  districtId: string;
  kind: BuildingKind;
  name: string;
  position: Vec3;
  size: { width: number; height: number; depth: number };
  color: string;
  accent: string;
  interaction?: InteractionKind;
  label?: string;
  /** Local-space ground footprint (relative to building.position). When set, mesh uses extruded OSM outline. */
  footprint?: Array<{ x: number; z: number }>;
}

export interface BillboardDefinition {
  id: string;
  position: Vec3;
  rotationY: number;
  width: number;
  height: number;
  title: string;
  subtitle: string;
  accent: string;
  /** When set, board becomes a live token ad (price / mcap / chart / QR). */
  tokenMint?: string;
  projectName?: string;
  website?: string;
}

export interface InteractionZone {
  id: string;
  kind: InteractionKind;
  label: string;
  hint: string;
  position: Vec3;
  radius: number;
  buildingId?: string;
  tokenMint?: string;
}

/** Signature landmark mesh (one hero asset per city when OrbitX GLB is present). */
export interface LandmarkDefinition {
  id: string;
  /** Catalog model id, e.g. landmark-nyc */
  modelId: string;
  position: Vec3;
  rotationY?: number;
  /** Target AABB for fit-to-box scaling (meters). */
  size: { width: number; height: number; depth: number };
  label?: string;
}

export interface WorldBlockConfig {
  cityId: CityId;
  name: string;
  spawn: Vec3;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  districts: DistrictDefinition[];
  buildings: BuildingDefinition[];
  billboards: BillboardDefinition[];
  zones: InteractionZone[];
  /** Optional hero landmarks — rendered when custom GLB is available. */
  landmarks?: LandmarkDefinition[];
}

export type HudPanel =
  | "none"
  | "map"
  | "inventory"
  | "profile"
  | "missions"
  | "leaderboards"
  | "friends"
  | "marketplace"
  | "live"
  | "community"
  | "events"
  | "token"
  | "trading"
  | "launch"
  | "chat"
  | "voice"
  | "social"
  | "games"
  | "nft"
  | "settings"
  | "help"
  | "lobbies"
  | "character";

export type HairStyle = "short" | "long" | "buzz" | "bun" | "mohawk";
export type OutfitStyle = "street" | "suit" | "sport" | "neon";
export type FaceStyle = "neutral" | "cool" | "smile";

export interface StreetSegment {
  /** "h" runs along X at z=at; "v" runs along Z at x=at. */
  o: "h" | "v";
  at: number;
  from: number;
  to: number;
  w: number;
  curbA: string;
  curbB: string;
}

export interface AvatarAppearance {
  bodyColor: string;
  accentColor: string;
  skinColor: string;
  name: string;
  /** Selected mascot (crypto-native) or a legacy class alias. */
  classId?: "pepe" | "wojak" | "chad" | "doge" | "anon" | "trader" | "builder" | "gamer" | "creator" | "explorer";
  /** Sims-style cosmetics rendered by CharacterMesh. */
  hairStyle: HairStyle;
  hairColor: string;
  outfit: OutfitStyle;
  faceStyle: FaceStyle;
}

/** Pre-world gate screens for AAA menu flow. */
export type CityGate = "menu" | "characters" | "lobbies" | "settings" | "world";


export interface InventoryItem {
  id: string;
  kind: "token" | "badge" | "key" | "ad_slot";
  label: string;
  detail?: string;
  mint?: string;
}

export interface TokenDetail {
  mint: string;
  name: string;
  symbol: string;
  icon?: string;
  priceUsd?: number;
  mcap?: number;
  fdv?: number;
  liquidity?: number;
  volume24h?: number;
  change24h?: number;
  holderCount?: number;
  decimals?: number;
  website?: string;
  twitter?: string;
}
