/**
 * OrbitXCity — Vehicles module: gas stations + EV chargers.
 *
 * Fuel is a survival resource: run dry and the engine cuts until you refuel.
 * Gas/diesel costs paper CITY; EV charging is paper too but slower at public
 * chargers (fast-charge costs more). The integrator ticks `consumeFuel`
 * per frame while driving and calls `refuelQuote` at stations.
 */
import { vehicleDef } from "./data/catalog";
import type { MapPoint, PaperDelta, VehicleInstance } from "./types";

export interface FuelStation extends MapPoint {
  fuel: "gas" | "diesel" | "electric";
  /** Paper CITY per unit. */
  pricePerUnit: number;
  /** Fill speed units/sec (game time). */
  fillRate: number;
}

export const FUEL_STATIONS: FuelStation[] = [
  { name: "OrbitX Fuel — Downtown", x: 64, z: 40, blip: "⛽ Gas", fuel: "gas", pricePerUnit: 2, fillRate: 4 },
  { name: "OrbitX Fuel — Harbor", x: -40, z: 160, blip: "⛽ Gas", fuel: "gas", pricePerUnit: 2, fillRate: 4 },
  { name: "Diesel Depot — Docks", x: -160, z: 120, blip: "⛽ Diesel", fuel: "diesel", pricePerUnit: 3, fillRate: 5 },
  { name: "Volt Point — Midtown", x: -32, z: -48, blip: "⚡ EV Charger", fuel: "electric", pricePerUnit: 1, fillRate: 2 },
  { name: "Volt Point — Beach", x: 120, z: 140, blip: "⚡ EV Charger", fuel: "electric", pricePerUnit: 1, fillRate: 2 },
  { name: "Volt Fast — Marina", x: 168, z: 96, blip: "⚡ Fast Charge", fuel: "electric", pricePerUnit: 3, fillRate: 8 },
];

export function stationsFor(defId: string): FuelStation[] {
  const ft = vehicleDef(defId).fuelType;
  if (ft === "none") return [];
  return FUEL_STATIONS.filter((s) => s.fuel === ft);
}

/** Units burned per second at full throttle (scaled by throttle in the integrator). */
export function burnRatePerSec(defId: string): number {
  const def = vehicleDef(defId);
  if (def.fuelType === "none" || def.fuelCapacity <= 0) return 0;
  // bigger, faster machines drink more
  return (0.25 + def.topSpeedKmh / 400) * (def.kind === "yacht" ? 3 : def.kind === "submarine" ? 1.5 : 1);
}

/** Tick fuel down; returns true if the tank just ran dry. */
export function consumeFuel(instance: VehicleInstance, dtSec: number, throttle01: number): VehicleInstance {
  const def = vehicleDef(instance.defId);
  if (def.fuelType === "none" || def.fuelCapacity <= 0 || instance.fuel <= 0) return instance;
  const used = (burnRatePerSec(def.id) * throttle01 * dtSec) / def.fuelCapacity;
  return { ...instance, fuel: Math.max(0, instance.fuel - used) };
}

export interface RefuelQuote {
  units: number;
  costCity: number;
  paperDelta: PaperDelta;
  station: FuelStation;
}

/** Quote a full fill-up at a station; integrator charges the delta then calls applyRefuel. */
export function refuelQuote(instance: VehicleInstance, station: FuelStation): RefuelQuote {
  const def = vehicleDef(instance.defId);
  if (def.fuelType !== station.fuel) {
    throw new Error(`${station.name} serves ${station.fuel}, not ${def.fuelType}`);
  }
  const units = def.fuelCapacity * (1 - instance.fuel);
  const costCity = Math.max(1, Math.ceil(units * station.pricePerUnit));
  return {
    units,
    costCity,
    station,
    paperDelta: {
      amount: -costCity,
      label: `${station.name} — refuel ${instance.nickname}`,
      source: "vehicles:fuel",
    },
  };
}

export function applyRefuel(instance: VehicleInstance): VehicleInstance {
  return { ...instance, fuel: 1 };
}

/** Low-fuel warning threshold (HUD). */
export const LOW_FUEL_AT = 0.15;
