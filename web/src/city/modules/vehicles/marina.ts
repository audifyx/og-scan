/**
 * OrbitXCity — Vehicles module: yacht marina + jet skis.
 *
 * Marina del Orbit: rent a jet ski by the hour (paper CITY), charter a cuddy,
 * or burn ORBITX to own a superyacht outright. Rentals are fleet boats — they
 * don't touch your garage and vanish when the timer ends.
 */
import { vehicleDef } from "./data/catalog";
import type { MapPoint, PaperDelta } from "./types";

export const MARINA: MapPoint = {
  name: "Marina del Orbit",
  x: 200,
  z: 120,
  blip: "🛥️ Marina",
};

export interface RentalQuote {
  defId: string;
  label: string;
  minutes: number;
  paperDelta: PaperDelta;
}

/** Jet ski rental: 150 CITY per 15 min block. */
export function quoteJetSkiRental(blocks15min: number): RentalQuote {
  const n = Math.max(1, Math.floor(blocks15min));
  const cost = 150 * n;
  return {
    defId: "spark-jetski",
    label: `Jet ski rental — ${n * 15} min`,
    minutes: n * 15,
    paperDelta: { amount: -cost, label: "Marina — jet ski rental", source: "vehicles:marina" },
  };
}

/** Harbor 28 charter: 600 CITY per 30 min, captain included. */
export function quoteBoatCharter(blocks30min: number): RentalQuote {
  const n = Math.max(1, Math.floor(blocks30min));
  const cost = 600 * n;
  return {
    defId: "harbor-28",
    label: `Harbor 28 charter — ${n * 30} min`,
    minutes: n * 30,
    paperDelta: { amount: -cost, label: "Marina — boat charter", source: "vehicles:marina" },
  };
}

/** Active rental session (fleet boat, not garage-owned). */
export interface RentalSession {
  id: string;
  defId: string;
  label: string;
  startedAt: number;
  endsAt: number;
}

export function startRental(quote: RentalQuote, now = Date.now()): RentalSession {
  return {
    id: `rental-${now.toString(36)}-${Math.floor(Math.random() * 1e4)}`,
    defId: quote.defId,
    label: quote.label,
    startedAt: now,
    endsAt: now + quote.minutes * 60_000,
  };
}

export function rentalTimeLeftSec(session: RentalSession, now = Date.now()): number {
  return Math.max(0, (session.endsAt - now) / 1000);
}

export function rentalExpired(session: RentalSession, now = Date.now()): boolean {
  return now >= session.endsAt;
}

/** Superyacht berths: owning a Neptune 88 unlocks a private berth + party deck. */
export interface Berth {
  berthId: string;
  ownerVehicleUid: string | null;
  label: string;
}

export function marinaBerths(count = 8): Berth[] {
  return Array.from({ length: count }, (_, i) => ({
    berthId: `berth-${i + 1}`,
    ownerVehicleUid: null,
    label: `Berth ${i + 1}`,
  }));
}

/** Max passengers the integrator should allow aboard (seats from the def). */
export function capacityOf(defId: string): number {
  return vehicleDef(defId).seats;
}
