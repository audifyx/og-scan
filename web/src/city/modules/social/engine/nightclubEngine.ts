/**
 * Ownable-nightclub simulation engine (paper CITY gameplay).
 *
 * Buying the club itself is PREMIUM (real ORBITX burn, defensive — see
 * billing.ts); everything after that (DJ fees, cover, nightly earnings)
 * runs on paper CITY. Earnings sim is deterministic per night id.
 */

import type { DjBooking, NightclubState } from "../types";

/** Premium purchase price — real ORBITX burned when billing is ready. */
export const CLUB_PRICE_ORBITX = 25;
/** Gameplay alternative while premium is wiring up: paper CITY lease-to-own. */
export const CLUB_LEASE_CITY = 10_000;

export interface NightResult {
  attendees: number;
  grossCity: number;
  djFeeCity: number;
  netCity: number;
  popularityDelta: number;
  newPopularity: number;
  verdict: string;
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/**
 * Simulate one night. Deterministic per (nightId, dj, cover, popularity)
 * so re-runs / re-renders agree.
 */
export function simulateNight(
  state: NightclubState,
  booking: DjBooking,
  nightId: string
): NightResult {
  const seed = hashStr(`${nightId}:${booking.djId}:${state.coverCity}`);
  const rand = (i: number) => ((seed >> (i * 5)) % 1000) / 1000;
  const attendees = Math.round(
    40 + state.popularity * 3.2 + booking.hype * 22 + rand(1) * 60
  );
  const grossCity = attendees * state.coverCity;
  const djFeeCity = booking.feeCity;
  const netCity = Math.max(0, grossCity - djFeeCity);
  const packed = attendees / (40 + state.popularity * 3.2 + booking.hype * 22);
  const popularityDelta = Math.round(
    (booking.hype - 5) * 1.6 + (packed - 1) * 12 + (state.coverCity > 200 ? -4 : 2)
  );
  const newPopularity = Math.max(5, Math.min(100, state.popularity + popularityDelta));
  const verdict =
    packed >= 1.1
      ? "PACKED. The floor is a beautiful problem."
      : packed >= 0.85
        ? "Solid night. The regulars are happy."
        : "Thin crowd. Book bigger hype or drop the cover.";
  return { attendees, grossCity, djFeeCity, netCity, popularityDelta, newPopularity, verdict };
}

/** Hype-the-floor: spend paper CITY on promo, popularity bumps (diminishing). */
export function hypeCost(currentPopularity: number): number {
  return Math.round(120 + currentPopularity * 8);
}

export function defaultClubState(): NightclubState {
  return {
    owned: false,
    name: "Club Eclipse",
    popularity: 35,
    coverCity: 75,
    tonight: null,
    lifetimeEarningsCity: 0,
    lifetimeBurnedOrbitx: 0,
  };
}
