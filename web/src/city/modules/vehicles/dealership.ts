/**
 * OrbitXCity — Vehicles module: car dealership.
 *
 * Premium Motors showroom: paper-CITY cars on the floor, ORBITX-premium
 * machines behind the velvet rope. Purchase flow is two-phase —
 * `quotePurchase` prices it, the integrator charges paper / burns ORBITX,
 * then `finalizePurchase` registers the title in the garage.
 */
import { effectiveStats, VEHICLE_DEFS, vehicleDef } from "./data/catalog";
import type { Garage } from "./garage";
import { pricePurchase } from "./garage";
import type { PaperDelta, VehicleDef, VehicleInstance } from "./types";

export const DEALERSHIP = {
  name: "Premium Motors",
  x: 96,
  z: -64,
  blip: "🚗 Premium Motors",
};

export interface ShowroomListing {
  def: VehicleDef;
  /** Effective stats with zero mods (for the showroom card). */
  stats: ReturnType<typeof effectiveStats>;
  purchasable: boolean;
  currency: "CITY" | "ORBITX";
  price: number;
}

export function showroomListings(): ShowroomListing[] {
  return VEHICLE_DEFS
    .filter((d) => d.paperPrice > 0 || d.orbitxPrice > 0)
    .map((def) => {
      const orbitx = def.orbitxPrice > 0;
      return {
        def,
        stats: effectiveStats(def, []),
        purchasable: true,
        currency: orbitx ? "ORBITX" : "CITY",
        price: orbitx ? def.orbitxPrice : def.paperPrice,
      };
    });
}

export interface DealershipPurchase {
  instance: VehicleInstance;
  paperDelta: PaperDelta | null; // charge via integrator ledger
  orbitxBurn: { amount: number; reason: string; ref: string } | null;
}

/**
 * Two-phase purchase. Call this to get the charges, execute them via the
 * integrator (paperWallet / burn provider), then call finalizePurchase.
 */
export function quotePurchase(defId: string, nickname?: string): DealershipPurchase {
  const priced = pricePurchase({ defId, nickname });
  const def = vehicleDef(defId);
  return {
    instance: priced.instance,
    paperDelta: priced.paperCharge > 0
      ? { amount: -priced.paperCharge, label: `Dealership — ${def.name}`, source: "vehicles:dealership" }
      : null,
    orbitxBurn: priced.orbitxCharge > 0
      ? { amount: priced.orbitxCharge, reason: priced.burnReason, ref: `veh-dealer-${priced.instance.uid}` }
      : null,
  };
}

export function finalizePurchase(garage: Garage, purchase: DealershipPurchase): VehicleInstance {
  garage.addOwned(purchase.instance);
  return purchase.instance;
}

/** Test-drive: spawns a temp vehicle the player can drive for 60s (no ownership). */
export function testDrive(defId: string): { def: VehicleDef; durationSec: number } {
  return { def: vehicleDef(defId), durationSec: 60 };
}
