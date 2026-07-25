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
  | "token";

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
  tokenMint?: string;
  projectName?: string;
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

export interface WorldBlockConfig {
  cityId: CityId;
  name: string;
  spawn: Vec3;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  districts: DistrictDefinition[];
  buildings: BuildingDefinition[];
  billboards: BillboardDefinition[];
  zones: InteractionZone[];
}

export type HudPanel =
  | "none"
  | "map"
  | "inventory"
  | "profile"
  | "marketplace"
  | "live"
  | "community"
  | "events"
  | "token"
  | "trading"
  | "launch";

export interface AvatarAppearance {
  bodyColor: string;
  accentColor: string;
  name: string;
}

export interface InventoryItem {
  id: string;
  kind: "token" | "badge" | "key" | "ad_slot";
  label: string;
  detail?: string;
  mint?: string;
}
