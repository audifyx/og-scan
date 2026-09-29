/**
 * OrbitXCity — Vehicles module: shared types.
 *
 * Self-contained: no imports from other city modules, no `@/tokenomics/*`.
 * The module is logic-only (no DOM) — rendering/HUD stays with core and the
 * integrator, which applies paper-CITY deltas through the economy module's
 * paperWallet.
 */

export type VehicleKind =
  | "sedan"
  | "sports"
  | "muscle"
  | "suv"
  | "lowrider"
  | "bmx"
  | "dirtbike"
  | "chopper" // motorcycle / biker-gang bike
  | "jetski"
  | "yacht"
  | "submarine";

export type FuelType = "gas" | "diesel" | "electric" | "none";

export interface VehicleDef {
  id: string;
  name: string;
  kind: VehicleKind;
  /** Paper-CITY price; 0 = not purchasable with paper. */
  paperPrice: number;
  /** Real-ORBITX premium price; 0 = not a premium purchase. */
  orbitxPrice: number;
  topSpeedKmh: number;
  accel01: number; // 0..1 normalized
  handling01: number; // 0..1 normalized
  seats: number;
  fuelType: FuelType;
  /** Fuel / charge capacity in "units" (liters for gas, kWh for electric). */
  fuelCapacity: number;
  watercraft: boolean;
  submersible: boolean;
  tags: string[];
}

export type VehicleCondition = "pristine" | "good" | "worn" | "wrecked";

/** A player-owned vehicle instance. */
export interface VehicleInstance {
  uid: string;
  defId: string;
  nickname: string;
  condition: VehicleCondition;
  /** Fuel/charge 0..1. "none" fuel types ignore this. */
  fuel: number;
  /** Mod ids currently installed (chop shop). */
  mods: string[];
  /** Odometer-ish wear accumulator (game ticks). */
  mileage: number;
  /** True while held at the impound lot. */
  impounded: boolean;
  acquiredAt: number;
}

export type ModSlot =
  | "engine"
  | "turbo"
  | "tires"
  | "suspension"
  | "armor"
  | "hydraulics"
  | "paint"
  | "neon"
  | "hull" // watercraft
  | "ballast"; // submarine

export interface ModDef {
  id: string;
  name: string;
  slot: ModSlot;
  description: string;
  /** Real-ORBITX burn cost (performance mods ALWAYS burn, per product law). */
  orbitxCost: number;
  /** Paper-CITY cosmetic cost; 0 = ORBITX-only mod. */
  paperCost: number;
  /** Stat deltas applied to the vehicle def (multiplicative where noted). */
  effect: {
    topSpeedMult?: number;
    accelAdd?: number;
    handlingAdd?: number;
    armorAdd?: number;
    /** Lowrider hydraulics bounce ceiling, 0..1. */
    bounceAdd?: number;
  };
  /** Vehicle kinds this mod fits. */
  fits: VehicleKind[];
}

export interface MapPoint {
  name: string;
  x: number;
  z: number;
  blip: string; // HUD blip label
}

export interface BurnReceipt {
  ok: boolean;
  signature?: string;
  amount: number;
  reason: string;
  /** True when the null (paper-only) provider handled this — billing not live yet. */
  paperOnly: boolean;
}

/** Paper-CITY delta produced by a module action, applied by the integrator. */
export interface PaperDelta {
  /** Positive = earn, negative = spend. */
  amount: number;
  label: string;
  source: string;
}

/**
 * Structural ledger the integrator satisfies with the economy module's
 * paperWallet — never imported here (no cross-module imports).
 */
export interface PaperLedger {
  earn: (amount: number, label: string, source: string) => void;
  spend: (amount: number, label: string, source: string) => boolean;
  balance: () => number;
}

/** Handling tunables the integrator can apply to core's CarPhysics per kind. */
export interface HandlingParams {
  maxSpeed: number; // m/s
  maxReverse: number; // m/s
  accel: number; // m/s^2
  brake: number; // m/s^2
  /** Higher = tighter turning; multiply into core's steerAuthority base. */
  steerMult: number;
}
