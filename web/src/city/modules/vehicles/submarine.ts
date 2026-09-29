/**
 * OrbitXCity — Vehicles module: submarine tours (underwater wrecks with loot).
 *
 * The Nautilus Mini-Sub (ORBITX premium in the dealership catalog) works the
 * offshore wreck field. Tours are guided paper-CITY runs: pick a route,
 * visit each wreck once per tour, crack its loot cache. Deeper than 100m
 * needs the Pro Ballast mod (chop shop) or the hull crushes your payday.
 *
 * Oxygen is tracked on the tour session (not the vehicle) and drains faster
 * the deeper you go — surface or dock before it hits zero.
 */
import { modDef } from "./data/catalog";
import type { MapPoint, PaperDelta, VehicleInstance } from "./types";

export const SUB_DOCK: MapPoint = {
  name: "Abyssal Sub Dock",
  x: 248,
  z: 176,
  blip: "🤿 Sub Dock",
};

export interface Wreck extends MapPoint {
  wreckId: string;
  depthM: number;
  /** Loot tier: 1 = picked-over, 2 = intact, 3 = legendary. */
  tier: 1 | 2 | 3;
  description: string;
}

export const WRECKS: Wreck[] = [
  { wreckId: "smugglers-cutter", name: "Smuggler's Cutter", x: 300, z: 240, blip: "⚓ Wreck", depthM: 35, tier: 1, description: "Prohibition-era runner, cargo long looted — scraps remain." },
  { wreckId: "corsair-bomber", name: "Corsair Bomber", x: 360, z: 180, blip: "⚓ Wreck", depthM: 48, tier: 2, description: "WWII dive bomber, largely intact on the sand." },
  { wreckId: "container-spill", name: "Container Spill", x: 420, z: 300, blip: "⚓ Wreck", depthM: 55, tier: 1, description: "Storm-lost containers scattered across the shelf." },
  { wreckId: "ss-meridian", name: "SS Meridian", x: 480, z: 220, blip: "⚓ Wreck", depthM: 72, tier: 2, description: "Ocean liner, grand staircase still diveable." },
  { wreckId: "ancient-galleon", name: "Ancient Galleon", x: 560, z: 340, blip: "⚓ Wreck", depthM: 95, tier: 3, description: "300-year-old galleon. The manifest mentions gold." },
  { wreckId: "trench-leviathan", name: "Trench Leviathan", x: 680, z: 420, blip: "⚓ Deep Wreck", depthM: 125, tier: 3, description: "Unidentified hull below the thermocline. Ballast required." },
];

export function wreckOf(wreckId: string): Wreck {
  const w = WRECKS.find((x) => x.wreckId === wreckId);
  if (!w) throw new Error(`Unknown wreck: ${wreckId}`);
  return w;
}

export interface DiveTour {
  tourId: string;
  name: string;
  wreckIds: string[];
  /** Guided run length. */
  durationMin: number;
  /** Paper-CITY tour fee. */
  priceCity: number;
  description: string;
}

export const DIVE_TOURS: DiveTour[] = [
  { tourId: "shallow-run", name: "Shallow Wreck Run", wreckIds: ["smugglers-cutter", "corsair-bomber"], durationMin: 20, priceCity: 250, description: "Two easy wrecks above 50m. Great first dive." },
  { tourId: "meridian-express", name: "Meridian Express", wreckIds: ["container-spill", "ss-meridian"], durationMin: 30, priceCity: 450, description: "The liner and the spill field. Bring a light." },
  { tourId: "galleon-expedition", name: "Galleon Expedition", wreckIds: ["ss-meridian", "ancient-galleon"], durationMin: 45, priceCity: 800, description: "Deep run to the galleon. Tier-3 loot." },
  { tourId: "leviathan-descent", name: "Leviathan Descent", wreckIds: ["ancient-galleon", "trench-leviathan"], durationMin: 60, priceCity: 1500, description: "The trench wreck. Pro Ballast mod REQUIRED." },
];

export function tourOf(tourId: string): DiveTour {
  const t = DIVE_TOURS.find((x) => x.tourId === tourId);
  if (!t) throw new Error(`Unknown tour: ${tourId}`);
  return t;
}

export interface SubTourQuote {
  tour: DiveTour;
  paperDelta: PaperDelta;
  /** Wreck ids on this route deeper than the sub's crush depth (blockers). */
  blockers: string[];
}

/** Base crush depth 100m; Pro Ballast mod raises it to 140m. */
export function crushDepthM(instance: VehicleInstance): number {
  const hasBallast = instance.mods.some((id) => {
    try { return modDef(id).slot === "ballast"; } catch { return false; }
  });
  return hasBallast ? 140 : 100;
}

export function quoteSubTour(tourId: string, instance: VehicleInstance): SubTourQuote {
  const tour = tourOf(tourId);
  const crush = crushDepthM(instance);
  const blockers = tour.wreckIds.filter((id) => wreckOf(id).depthM > crush);
  return {
    tour,
    paperDelta: {
      amount: -tour.priceCity,
      label: `Sub tour — ${tour.name}`,
      source: "vehicles:submarine",
    },
    blockers,
  };
}

export interface SubTourSession {
  id: string;
  tourId: string;
  vehicleUid: string;
  startedAt: number;
  endsAt: number;
  /** Wreck ids already looted this tour. */
  visited: string[];
  /** Oxygen 0..1 — drains faster at depth; refill at the dock. */
  oxygen01: number;
}

export function startSubTour(tourId: string, instance: VehicleInstance, now = Date.now()): SubTourSession {
  const quote = quoteSubTour(tourId, instance);
  if (quote.blockers.length > 0) {
    throw new Error(`Route blocked: ${quote.blockers.join(", ")} deeper than crush depth — fit Pro Ballast first`);
  }
  return {
    id: `subtour-${now.toString(36)}-${Math.floor(Math.random() * 1e4)}`,
    tourId,
    vehicleUid: instance.uid,
    startedAt: now,
    endsAt: now + quote.tour.durationMin * 60_000,
    visited: [],
    oxygen01: 1,
  };
}

export function tourTimeLeftSec(session: SubTourSession, now = Date.now()): number {
  return Math.max(0, (session.endsAt - now) / 1000);
}

/** Oxygen tick: base drain plus depth penalty. Returns true if O2 just ran dry. */
export function tickSubOxygen(session: SubTourSession, dtSec: number, depthM: number): SubTourSession {
  if (session.oxygen01 <= 0) return session;
  const drain = (0.004 + (depthM / 125) * 0.012) * dtSec; // ~2-4 min at depth
  return { ...session, oxygen01: Math.max(0, session.oxygen01 - drain) };
}

export const LOW_O2_AT = 0.2;

const TIER_LOOT: Record<Wreck["tier"], [number, number]> = {
  1: [80, 200],
  2: [200, 500],
  3: [600, 1500],
};

export interface WreckVisit {
  session: SubTourSession;
  /** Null when already looted this tour. */
  loot: PaperDelta | null;
}

/** Crack a wreck's loot cache (once per wreck per tour). All loot is paper CITY. */
export function visitWreck(session: SubTourSession, wreckId: string): WreckVisit {
  const tour = tourOf(session.tourId);
  if (!tour.wreckIds.includes(wreckId)) throw new Error(`${wreckId} is not on this tour's route`);
  if (session.visited.includes(wreckId)) return { session, loot: null };
  const wreck = wreckOf(wreckId);
  const [lo, hi] = TIER_LOOT[wreck.tier];
  const amount = Math.floor(lo + Math.random() * (hi - lo));
  const next: SubTourSession = { ...session, visited: [...session.visited, wreckId] };
  return {
    session: next,
    loot: {
      amount,
      label: `Wreck loot — ${wreck.name}`,
      source: "vehicles:submarine",
    },
  };
}

/** Tour payout summary: visited count for the debrief HUD. */
export function tourProgress(session: SubTourSession): { visited: number; total: number } {
  const tour = tourOf(session.tourId);
  return { visited: session.visited.length, total: tour.wreckIds.length };
}
