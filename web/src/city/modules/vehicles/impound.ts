/**
 * OrbitXCity — Vehicles module: impound lot.
 *
 * Reckless driving has consequences: the city tows your ride. Pay the paper
 * fine to get it back, or bribe the attendant with a small ORBITX burn to
 * skip the paperwork (and the wait). Bikes under "none" fuel can't be towed.
 */
import type { MapPoint, PaperDelta, VehicleInstance } from "./types";

export const IMPOUND_LOT: MapPoint = {
  name: "City Impound Lot",
  x: -200,
  z: -120,
  blip: "🚔 Impound",
};

export type SeizeReason = "reckless-driving" | "illegal-parking" | "pink-slip-default" | "bounty-forfeit";

export interface ImpoundRecord {
  vehicleUid: string;
  reason: SeizeReason;
  seizedAt: number;
  /** Paper-CITY fine. */
  fine: number;
  /** ORBITX bribe alternative (burn). */
  bribeOrbitx: number;
}

const FINES: Record<SeizeReason, number> = {
  "reckless-driving": 500,
  "illegal-parking": 150,
  "pink-slip-default": 1000,
  "bounty-forfeit": 750,
};

/** Seizes a vehicle; returns the record and the updated instance. */
export function seizeVehicle(
  instance: VehicleInstance,
  reason: SeizeReason,
): { instance: VehicleInstance; record: ImpoundRecord } {
  const rec: ImpoundRecord = {
    vehicleUid: instance.uid,
    reason,
    seizedAt: Date.now(),
    fine: FINES[reason],
    bribeOrbitx: 2,
  };
  return { instance: { ...instance, impounded: true }, record: rec };
}

export interface ReleaseQuote {
  paperDelta: PaperDelta;
  bribe: { amount: number; reason: string; ref: string };
}

/** Quote both release paths; integrator charges one, then calls applyRelease. */
export function releaseQuote(record: ImpoundRecord, nickname: string): ReleaseQuote {
  return {
    paperDelta: {
      amount: -record.fine,
      label: `Impound fine — ${nickname}`,
      source: "vehicles:impound",
    },
    bribe: {
      amount: record.bribeOrbitx,
      reason: `city:vehicles:impound-bribe`,
      ref: `veh-bribe-${record.vehicleUid}-${record.seizedAt}`,
    },
  };
}

export function applyRelease(instance: VehicleInstance): VehicleInstance {
  return { ...instance, impounded: false };
}

/** Seized vehicles can't be driven until released. */
export function isDrivable(instance: VehicleInstance): boolean {
  return !instance.impounded;
}
