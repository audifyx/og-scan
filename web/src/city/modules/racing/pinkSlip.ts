/**
 * OrbitXCity — RACING MODULE pink slips.
 *
 * Midnight pink-slip races: lose the race, lose the car. Two racers stake
 * cars; the winner takes both titles. Duels can only be *raced* during the
 * midnight window (22:00–04:00 game time); proposing/accepting is allowed
 * any time.
 *
 * Car ownership is a local title registry. The integrator seeds it from the
 * player's garage (garage module) and applies transfers on settle().
 *
 * Full duel flow (integrator):
 *   proposeDuel -> acceptDuel -> beginDuelRace (midnight gate) ->
 *   createDuelRaceSession -> session.payEntryFees/startCountdown/update
 *   -> session.settle() -> settleDuel(registry, duel, result.winnerId)
 */

import type { IRacer, StreetCircuit } from "./types";
import { RaceSession } from "./races";
import type { IBurnProvider } from "./economy";

export interface StakedCar {
  id: string;
  name: string;
  ownerId: string;
  specs: {
    topSpeedKmh: number;
    accel: number; // 0..10
    handling: number; // 0..10
  };
}

export type DuelState = "proposed" | "accepted" | "racing" | "settled" | "cancelled";

export interface PinkSlipDuel {
  id: string;
  challengerId: string;
  challengedId: string;
  challengerCarId: string;
  challengedCarId: string;
  state: DuelState;
  winnerId: string | null;
  createdAt: number;
}

/** Midnight window in game hours: 22:00 -> 04:00. Core exposes dayT/isNight via getPlayerState(). */
export function isMidnightWindow(gameHour: number): boolean {
  const h = ((gameHour % 24) + 24) % 24;
  return h >= 22 || h < 4;
}

/** Convert core dayT (0..1, 0 = midnight) to a game hour. */
export function dayTToHour(dayT: number): number {
  return ((dayT % 1) + 1) % 1 * 24;
}

let duelSeq = 0;

/** Registry of car titles: carId -> ownerId. */
export class CarTitleRegistry {
  private titles = new Map<string, string>();
  private cars = new Map<string, StakedCar>();

  register(car: StakedCar): void {
    this.cars.set(car.id, car);
    this.titles.set(car.id, car.ownerId);
  }

  ownerOf(carId: string): string | null {
    return this.titles.get(carId) ?? null;
  }

  get(carId: string): StakedCar | null {
    return this.cars.get(carId) ?? null;
  }

  carsOf(ownerId: string): StakedCar[] {
    return [...this.cars.values()].filter((c) => this.titles.get(c.id) === ownerId);
  }

  transfer(carId: string, toOwnerId: string): boolean {
    if (!this.cars.has(carId)) return false;
    this.titles.set(carId, toOwnerId);
    const car = this.cars.get(carId)!;
    this.cars.set(carId, { ...car, ownerId: toOwnerId });
    return true;
  }
}

export interface DuelProposal {
  challengerId: string;
  challengedId: string;
  challengerCarId: string;
  challengedCarId: string;
}

export function proposeDuel(reg: CarTitleRegistry, p: DuelProposal): PinkSlipDuel {
  if (reg.ownerOf(p.challengerCarId) !== p.challengerId) {
    throw new Error("challenger does not own the staked car");
  }
  if (reg.ownerOf(p.challengedCarId) !== p.challengedId) {
    throw new Error("challenged racer does not own the staked car");
  }
  if (p.challengerId === p.challengedId) throw new Error("cannot duel yourself");
  return {
    id: `duel-${Date.now().toString(36)}-${++duelSeq}`,
    challengerId: p.challengerId,
    challengedId: p.challengedId,
    challengerCarId: p.challengerCarId,
    challengedCarId: p.challengedCarId,
    state: "proposed",
    winnerId: null,
    createdAt: Date.now(),
  };
}

export function acceptDuel(duel: PinkSlipDuel, byId: string): PinkSlipDuel {
  if (duel.state !== "proposed") throw new Error("duel is not open");
  if (byId !== duel.challengedId) throw new Error("only the challenged racer can accept");
  return { ...duel, state: "accepted" };
}

export function declineDuel(duel: PinkSlipDuel): PinkSlipDuel {
  if (duel.state !== "proposed") throw new Error("duel is not open");
  return { ...duel, state: "cancelled" };
}

export function beginDuelRace(duel: PinkSlipDuel, gameHour: number): PinkSlipDuel {
  if (duel.state !== "accepted") throw new Error("duel must be accepted first");
  if (!isMidnightWindow(gameHour)) {
    throw new Error("pink-slip races run at midnight only (22:00–04:00)");
  }
  return { ...duel, state: "racing" };
}

export interface DuelSettlement {
  duel: PinkSlipDuel;
  /** carId -> new ownerId */
  transfers: { carId: string; from: string; to: string }[];
}

/**
 * Settle a finished duel: the loser forfeits their staked car to the winner.
 * Applies the title transfers to the registry and returns the record.
 */
export function settleDuel(
  reg: CarTitleRegistry,
  duel: PinkSlipDuel,
  winnerId: string,
): DuelSettlement {
  if (duel.state !== "racing") throw new Error("duel is not racing");
  if (winnerId !== duel.challengerId && winnerId !== duel.challengedId) {
    throw new Error("winner must be one of the duelists");
  }
  const loserId = winnerId === duel.challengerId ? duel.challengedId : duel.challengerId;
  const loserCarId = winnerId === duel.challengerId ? duel.challengedCarId : duel.challengerCarId;
  const ok = reg.transfer(loserCarId, winnerId);
  if (!ok) throw new Error("title transfer failed");
  return {
    duel: { ...duel, state: "settled", winnerId },
    transfers: [{ carId: loserCarId, from: loserId, to: winnerId }],
  };
}

export interface DuelRaceOpts {
  /** real ORBITX burn provider (null provider = paper-only until billing lands) */
  burnProvider: IBurnProvider;
  /** paper CITY each duelist puts up on top of their car (default 0) */
  entryFeeCity?: number;
  /** real ORBITX entry fee burned per duelist (default 0) */
  entryFeeOrbitx?: number;
  /** laps override (default: circuit.defaultLaps) */
  laps?: number;
}

/**
 * Build the actual RaceSession for an accepted/midnight-gated duel on the
 * night-market circuit. The race itself is a standard 2-racer session;
 * the car stakes are applied afterwards via settleDuel(registry, duel,
 * session.settle().winnerId).
 */
export function createDuelRaceSession(
  duel: PinkSlipDuel,
  circuit: StreetCircuit,
  challenger: IRacer,
  challenged: IRacer,
  opts: DuelRaceOpts,
): RaceSession {
  if (duel.state !== "accepted" && duel.state !== "racing") {
    throw new Error("duel must be accepted before racing");
  }
  if (challenger.id !== duel.challengerId || challenged.id !== duel.challengedId) {
    throw new Error("racer ids must match the duel's challenger/challenged");
  }
  return new RaceSession({
    circuit,
    laps: opts.laps ?? circuit.defaultLaps,
    entrants: [challenger, challenged],
    entryFeeCity: opts.entryFeeCity ?? 0,
    entryFeeOrbitx: opts.entryFeeOrbitx ?? 0,
    burnProvider: opts.burnProvider,
  });
}
