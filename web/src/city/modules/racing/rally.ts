/**
 * OrbitXCity — RACING MODULE desert rally raids.
 *
 * Rally is a time-trial discipline: staggered starts, one car on stage at a
 * time, standings by cumulative stage time. The player drives stages live
 * (checkpoint timing via RallyStageRun); rival times are simulated from
 * skill + noise so raids work fully offline in v1. A future netcode pass
 * can replace simulated times with real remote runs.
 */
import type { IRacer, RallyRoute } from "./types";
import { createBotRacer, randomBotProfile } from "./ai";

export interface RallyStageResult {
  racerId: string;
  name: string;
  kind: IRacer["kind"];
  stageTime: number | null; // null = DNF
  dnf: boolean;
}

export interface RallyOverallRow {
  racerId: string;
  name: string;
  totalTime: number | null;
  stagesWon: number;
  dnf: boolean;
}

/** Simulated rival stage time: base pace from route length, skill-scaled. */
function simulateStageTime(route: RallyRoute, skill: number, seed: number): number {
  // ~ rally cars average 90–130 km/h on these stages
  const avgKmh = 92 + skill * 38;
  const base = (route.lengthKm / avgKmh) * 3600;
  const rand = mulberry(seed);
  const noise = 1 + (rand() - 0.45) * 0.12; // slight optimistic bias
  const dnf = rand() < 0.04 * (1 - skill); // rookies bin it more often
  return dnf ? -1 : base * noise;
}

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Live stage run for the player: feed checkpoint hits + elapsed time.
 * The integrator calls checkpoint(i) as the player's car (core physics)
 * crosses each route checkpoint.
 */
export class RallyStageRun {
  readonly route: RallyRoute;
  private cp = 0;
  private startT: number | null = null;
  private splits: number[] = [];

  constructor(route: RallyRoute) {
    this.route = route;
  }

  start(nowSec: number): void {
    this.startT = nowSec;
    this.cp = 0;
    this.splits = [];
  }

  /** Returns the pace note for the upcoming section, if any. */
  checkpoint(nowSec: number): string | null {
    if (this.startT == null) return null;
    this.splits.push(nowSec - this.startT);
    this.cp += 1;
    return this.route.paceNotes[this.cp] ?? null;
  }

  checkpointsHit(): number {
    return this.cp;
  }

  elapsed(nowSec: number): number {
    return this.startT == null ? 0 : nowSec - this.startT;
  }

  finished(): boolean {
    return this.cp >= this.route.checkpoints.length;
  }

  finalTime(nowSec: number): number {
    return this.elapsed(nowSec);
  }
}

export interface RallyRaidConfig {
  routes: RallyRoute[];
  playerName: string;
  rivalCount?: number;
  /** paper CITY prize for the overall winner */
  prizeCity?: number;
}

export interface RallyRaidResult {
  routeName: string;
  results: RallyStageResult[];
}

let raidSeq = 0;

/**
 * A full rally raid: N stages across the desert routes. Rivals run
 * simulated times; the player submits live times via submitPlayerStage().
 */
export class RallyRaid {
  readonly raidId: string;
  readonly routes: RallyRoute[];
  readonly prizeCity: number;
  private rivals: { id: string; name: string; skill: number }[];
  private totals = new Map<string, { name: string; total: number; stagesWon: number; dnf: boolean }>();
  private stageResults: RallyRaidResult[] = [];
  private playerId: string;

  constructor(cfg: RallyRaidConfig) {
    this.raidId = `raid-${Date.now().toString(36)}-${++raidSeq}`;
    this.routes = cfg.routes;
    this.prizeCity = cfg.prizeCity ?? 0;
    this.playerId = "player";
    const count = cfg.rivalCount ?? 5;
    this.rivals = Array.from({ length: count }, (_, i) => {
      const p = randomBotProfile(i);
      return { id: `rival-${i}`, name: p.name, skill: p.skill };
    });
    const all = [{ id: this.playerId, name: cfg.playerName }, ...this.rivals];
    for (const r of all) {
      this.totals.set(r.id, { name: r.name, total: 0, stagesWon: 0, dnf: false });
    }
  }

  rivalRacers(vehicleFor: (i: number) => IRacer["vehicle"]): IRacer[] {
    return this.rivals.map((r, i) =>
      createBotRacer(r.id, { name: r.name, skill: r.skill, aggression: 0.4, color: 0x8e44ad }, vehicleFor(i)),
    );
  }

  /**
   * Submit the player's live stage time; rival times are simulated.
   * Returns the stage leaderboard (fastest first).
   */
  submitPlayerStage(stageIdx: number, playerTime: number | null): RallyStageResult[] {
    const route = this.routes[stageIdx];
    if (!route) throw new Error("unknown stage");
    const results: RallyStageResult[] = [];
    const seedBase = this.raidId.length * 7919 + stageIdx * 104729;

    results.push({
      racerId: this.playerId,
      name: this.totals.get(this.playerId)!.name,
      kind: "player",
      stageTime: playerTime,
      dnf: playerTime == null,
    });
    this.rivals.forEach((r, i) => {
      const sim = simulateStageTime(route, r.skill, seedBase + i * 131);
      results.push({
        racerId: r.id, name: r.name, kind: "bot",
        stageTime: sim < 0 ? null : sim, dnf: sim < 0,
      });
    });

    // accumulate
    for (const res of results) {
      const t = this.totals.get(res.racerId)!;
      if (res.dnf || res.stageTime == null) {
        t.dnf = true;
        t.total = Infinity;
      } else if (!t.dnf) {
        t.total += res.stageTime;
      }
    }
    const ordered = [...results].sort((a, b) => (a.stageTime ?? Infinity) - (b.stageTime ?? Infinity));
    const stageWinner = ordered[0];
    if (stageWinner?.stageTime != null) {
      this.totals.get(stageWinner.racerId)!.stagesWon += 1;
    }
    this.stageResults.push({ routeName: route.name, results: ordered });
    return ordered;
  }

  overall(): RallyOverallRow[] {
    return [...this.totals.entries()]
      .map(([racerId, t]) => ({
        racerId, name: t.name,
        totalTime: t.dnf ? null : t.total,
        stagesWon: t.stagesWon, dnf: t.dnf,
      }))
      .sort((a, b) => (a.totalTime ?? Infinity) - (b.totalTime ?? Infinity));
  }

  stagesDone(): number {
    return this.stageResults.length;
  }

  isComplete(): boolean {
    return this.stagesDone() >= this.routes.length;
  }

  winnerId(): string | null {
    if (!this.isComplete()) return null;
    return this.overall()[0]?.racerId ?? null;
  }

  /**
   * Settle a completed raid: overall winner takes the paper-CITY prize.
   * Returns per-racer CITY deltas (winner +prizeCity, everyone else 0) so
   * the integrator can credit the economy module's paperWallet the same
   * way it credits RaceSession pots. Returns null until isComplete().
   */
  settle(): Map<string, number> | null {
    const wid = this.winnerId();
    if (wid == null) return null;
    const deltas = new Map<string, number>();
    for (const [racerId] of this.totals) {
      deltas.set(racerId, racerId === wid ? this.prizeCity : 0);
    }
    return deltas;
  }
}

export function fmtRaceTime(sec: number | null): string {
  if (sec == null || !isFinite(sec)) return "DNF";
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, "0")}`;
}
