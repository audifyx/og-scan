/**
 * OrbitXCity — Vehicles module: lowrider hydraulics competitions.
 *
 * Bounce & hop contests at the fairgrounds. Entry burns ORBITX (premium
 * event), the pot pays paper CITY. Scoring: peak bounce height × rhythm
 * sync × variety, judged over 3 rounds. Hydraulics mods raise the ceiling.
 */
import type { BurnReceipt, PaperDelta } from "./types";
import type { IBurnProvider } from "./economy";
import { burnRef } from "./economy";

export const HYDRO_ARENA: { name: string; x: number; z: number; blip: string } = {
  name: "Fairgrounds Hydro Arena",
  x: 40,
  z: 208,
  blip: "🎛️ Hydro Arena",
};

export type HydroMove = "bounce" | "hop" | "three-wheel" | "pancake" | "side-to-side";

/** One judged move: raw bounce height 0..1 (from the car's bounce01 + timing). */
export interface JudgedMove {
  move: HydroMove;
  height01: number;
  /** How on-beat the pump hit was, 0..1. */
  rhythm01: number;
}

const MOVE_BASE: Record<HydroMove, number> = {
  bounce: 1.0,
  hop: 1.3,
  "three-wheel": 1.6,
  pancake: 1.8,
  "side-to-side": 1.2,
};

/** Score a single move out of 100. */
export function scoreMove(m: JudgedMove): number {
  const variety = MOVE_BASE[m.move];
  const raw = m.height01 * 60 * variety + m.rhythm01 * 40;
  return Math.max(0, Math.min(100, raw));
}

export interface ContestEntrant {
  name: string;
  vehicleUid: string;
  bounce01: number; // from effectiveStats
  isPlayer: boolean;
}

export interface ContestRound {
  round: number;
  scores: { entrant: string; moveScores: number[]; roundScore: number }[];
}

export class HydroContest {
  readonly id: string;
  entrants: ContestEntrant[] = [];
  rounds: ContestRound[] = [];
  readonly maxRounds = 3;
  entryBurn: number;

  constructor(entryBurnOrBix = 3) {
    this.id = `hydro-${Date.now().toString(36)}`;
    this.entryBurn = entryBurnOrBix;
  }

  addEntrant(e: ContestEntrant): void {
    if (this.entrants.length >= 8) throw new Error("Contest is full (8 riders max)");
    this.entrants.push(e);
  }

  /** Simulates one round for all entrants given the player's judged moves. */
  playRound(playerMoves: JudgedMove[]): ContestRound {
    if (this.rounds.length >= this.maxRounds) throw new Error("Contest is over");
    const round: ContestRound = { round: this.rounds.length + 1, scores: [] };
    for (const e of this.entrants) {
      const moveScores = e.isPlayer
        ? playerMoves.map(scoreMove)
        : Array.from({ length: 3 }, () => {
            const h = Math.min(1, e.bounce01 * (0.6 + Math.random() * 0.6));
            return scoreMove({ move: "bounce", height01: h, rhythm01: 0.4 + Math.random() * 0.5 });
          });
      const roundScore = moveScores.reduce((a, b) => a + b, 0) / Math.max(1, moveScores.length);
      round.scores.push({ entrant: e.name, moveScores, roundScore });
    }
    this.rounds.push(round);
    return round;
  }

  get finished(): boolean {
    return this.rounds.length >= this.maxRounds;
  }

  standings(): { name: string; total: number; isPlayer: boolean }[] {
    const totals = new Map<string, number>();
    for (const r of this.rounds) {
      for (const s of r.scores) totals.set(s.entrant, (totals.get(s.entrant) ?? 0) + s.roundScore);
    }
    return this.entrants
      .map((e) => ({ name: e.name, total: totals.get(e.name) ?? 0, isPlayer: e.isPlayer }))
      .sort((a, b) => b.total - a.total);
  }

  /** Winner-takes-most paper pot: entryBurn × entrants × 60 CITY per ORBITX. */
  settle(): { winner: string; pot: PaperDelta } {
    if (!this.finished) throw new Error("Contest not finished");
    const [first] = this.standings();
    const potCity = Math.floor(this.entryBurn * this.entrants.length * 60);
    return {
      winner: first.name,
      pot: {
        amount: potCity,
        label: `Hydro contest win — ${first.name}`,
        source: "vehicles:lowrider",
      },
    };
  }
}

/** Entry fee burn (ORBITX). Null provider → paper-only "pending billing". */
export async function payContestEntry(
  contest: HydroContest,
  playerName: string,
  burn: IBurnProvider,
): Promise<BurnReceipt> {
  return burn.burn({
    amount: contest.entryBurn,
    reason: "city:vehicles:hydro-entry",
    ref: burnRef(`hydro-entry-${contest.id}-${playerName}`),
  });
}

/** Bounce height from pump timing: 1.0 = perfect beat hit. */
export function bounceFromTiming(beatAccuracy01: number, carBounce01: number): number {
  return Math.min(1, carBounce01 * (0.35 + 0.65 * beatAccuracy01));
}
