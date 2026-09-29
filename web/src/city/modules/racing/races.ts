/**
 * OrbitXCity — RACING MODULE race session.
 *
 * Lobby -> countdown -> racing -> finished state machine with checkpoint
 * tracking, lap timing, live positions, wrong-way detection and DNF
 * timeouts. Pure logic + structural vehicle access: the integrator owns the
 * render loop, cameras and car meshes; this class only reads IRacer.vehicle
 * and calls IRacer.drive().
 */
import type {
  DriveContext, IRacer, RaceEvents, RacePhase, RaceResult, RaceStanding,
  StreetCircuit,
} from "./types";
import { RacePool, collectEntryBurns, type IBurnProvider } from "./economy";

export interface RaceConfig {
  circuit: StreetCircuit;
  laps: number;
  entrants: IRacer[];
  entryFeeCity: number;
  entryFeeOrbitx: number;
  burnProvider: IBurnProvider;
  /** seconds after the winner finishes before unfinished racers DNF */
  dnfGraceSec?: number;
}

interface RacerState {
  racer: IRacer;
  nextCp: number;
  lap: number;
  score: number;
  finished: boolean;
  finishTime: number | null;
  dnf: boolean;
  wrongWay: boolean;
  wrongWayT: number;
  lastLapStart: number;
  lastLapTime: number | null;
  bestLapTime: number | null;
  cpHits: number;
}

let raceSeq = 0;

export class RaceSession {
  readonly raceId: string;
  readonly circuit: StreetCircuit;
  readonly laps: number;
  readonly pool: RacePool;
  readonly entryFeeOrbitx: number;
  private provider: IBurnProvider;
  private states: RacerState[];
  private dnfGrace: number;

  phase: RacePhase = "lobby";
  burnedOrbitx = 0;
  paperOnlyFees = false;

  private countdownT = 0;
  private lastCountdownTick = 4;
  raceTime = 0;
  private winnerTime: number | null = null;

  constructor(cfg: RaceConfig) {
    if (!cfg.entrants || cfg.entrants.length === 0) {
      throw new Error("RaceSession needs at least one entrant");
    }
    this.raceId = `race-${Date.now().toString(36)}-${++raceSeq}`;
    this.circuit = cfg.circuit;
    this.laps = Math.max(1, cfg.laps);
    this.pool = new RacePool(cfg.entryFeeCity);
    this.entryFeeOrbitx = Math.max(0, Math.floor(cfg.entryFeeOrbitx));
    this.provider = cfg.burnProvider;
    this.dnfGrace = cfg.dnfGraceSec ?? 90;
    this.states = cfg.entrants.map((r) => ({
      racer: r,
      nextCp: 1 % cfg.circuit.waypoints.length,
      lap: 0,
      score: 0,
      finished: false,
      finishTime: null,
      dnf: false,
      wrongWay: false,
      wrongWayT: 0,
      lastLapStart: 0,
      lastLapTime: null,
      bestLapTime: null,
      cpHits: 0,
    }));
    // entrants begin just before checkpoint 1, having "cleared" cp 0 (the line)
  }

  entrantIds(): string[] {
    return this.states.map((s) => s.racer.id);
  }

  /** Lobby step: collect paper pool + burn real ORBITX entry fees. */
  async payEntryFees(): Promise<{ burnedOrbitx: number; paperOnly: boolean }> {
    for (const s of this.states) this.pool.enter(s.racer.id);
    const r = await collectEntryBurns(
      this.provider, this.entrantIds(), this.entryFeeOrbitx, this.raceId,
    );
    this.burnedOrbitx = r.burnedOrbitx;
    this.paperOnlyFees = r.paperOnly;
    return r;
  }

  startCountdown(): void {
    if (this.phase !== "lobby") return;
    this.phase = "countdown";
    this.countdownT = 3.2;
    this.lastCountdownTick = 4;
  }

  /** 1-based live position of a racer. */
  positionOf(id: string): number {
    const order = [...this.states].sort((a, b) => b.score - a.score || (a.finishTime ?? 1e9) - (b.finishTime ?? 1e9));
    return order.findIndex((s) => s.racer.id === id) + 1;
  }

  standings(): RaceStanding[] {
    const order = [...this.states].sort((a, b) => b.score - a.score);
    return order.map((s, i) => ({
      racerId: s.racer.id,
      name: s.racer.name,
      kind: s.racer.kind,
      position: i + 1,
      lap: Math.min(s.lap + 1, this.laps),
      checkpoint: s.nextCp,
      finished: s.finished,
      finishTime: s.finishTime,
      dnf: s.dnf,
      wrongWay: s.wrongWay,
      lastLapTime: s.lastLapTime,
      bestLapTime: s.bestLapTime,
    }));
  }

  potCity(): number {
    return this.pool.pot();
  }

  private ctxFor(s: RacerState): DriveContext {
    const wps = this.circuit.waypoints;
    return {
      dt: 0,
      nextWaypoint: wps[s.nextCp],
      afterWaypoint: wps[(s.nextCp + 1) % wps.length],
      distanceToNext: 0,
      position: this.positionOf(s.racer.id),
      raceTime: this.raceTime,
      leaderLaps: Math.max(...this.states.map((o) => o.lap)),
    };
  }

  /** Advance the simulation. Returns events for SFX/UI. */
  update(dt: number): RaceEvents {
    const ev: RaceEvents = {
      countdownTick: null, go: false, checkpointHits: [],
      lapCompletions: [], finishes: [], wrongWay: [], raceOver: false,
    };
    const wps = this.circuit.waypoints;
    const R = this.circuit.checkpointRadius;

    if (this.phase === "countdown") {
      this.countdownT -= dt;
      const tick = Math.ceil(this.countdownT);
      if (tick < this.lastCountdownTick && tick >= 1) {
        this.lastCountdownTick = tick;
        ev.countdownTick = tick;
      }
      if (this.countdownT <= 0) {
        this.phase = "racing";
        ev.go = true;
        for (const s of this.states) s.lastLapStart = 0;
      }
      return ev;
    }
    if (this.phase !== "racing") return ev;

    this.raceTime += dt;

    for (const s of this.states) {
      if (s.finished || s.dnf) continue;
      const v = s.racer.vehicle;
      const wp = wps[s.nextCp];
      const dx = wp.x - v.pos.x;
      const dz = wp.z - v.pos.z;
      const d = Math.hypot(dx, dz);

      // drive (player command is injected by the integrator via PlayerRacer)
      const ctx = this.ctxFor(s);
      ctx.dt = dt;
      ctx.distanceToNext = d;
      const cmd = s.racer.drive(ctx);

      // integrate a lightweight kinematic step so bots actually move.
      // The integrator ALSO moves the player's real car through core
      // physics; to avoid double-driving the player, skip integration for
      // kind === "player" (core owns it) and only advance bots/remotes here.
      if (s.racer.kind !== "player") {
        integrateKinematic(v, cmd, dt);
      }

      // checkpoint hit?
      if (d < R) {
        s.nextCp += 1;
        s.cpHits += 1;
        ev.checkpointHits.push(s.racer.id);
        if (s.nextCp >= wps.length) {
          if (this.circuit.loop) {
            s.nextCp = 0;
          } else {
            // point-to-point: crossing the final checkpoint finishes the race
            this.finishRacer(s, ev);
            continue;
          }
        }
        // crossed the start/finish line (cp 0) after a full loop
        if (this.circuit.loop && s.nextCp === 0) {
          s.lap += 1;
          const lapTime = this.raceTime - s.lastLapStart;
          s.lastLapTime = lapTime;
          s.lastLapStart = this.raceTime;
          if (s.bestLapTime == null || lapTime < s.bestLapTime) s.bestLapTime = lapTime;
          ev.lapCompletions.push({ racerId: s.racer.id, lap: s.lap, lapTime });
          if (s.lap >= this.laps) {
            this.finishRacer(s, ev);
            continue;
          }
        }
      }

      // score: laps * cps + cps done + fractional progress to next cp
      const frac = Math.max(0, Math.min(1, 1 - d / 120));
      s.score = s.lap * wps.length + (s.cpHits % Math.max(1, wps.length)) + frac * 0.99;

      // wrong-way: heading points away from the next checkpoint while moving
      const wantH = Math.atan2(dx, dz);
      let dh = wantH - v.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      if (Math.abs(dh) > 2.2 && Math.abs(v.speed) > 4) {
        s.wrongWayT += dt;
        if (s.wrongWayT > 2 && !s.wrongWay) {
          s.wrongWay = true;
          ev.wrongWay.push(s.racer.id);
        }
      } else {
        s.wrongWayT = 0;
        s.wrongWay = false;
      }

      // DNF: too far behind the winner after the grace period
      if (this.winnerTime != null && this.raceTime - this.winnerTime > this.dnfGrace) {
        s.dnf = true;
      }
    }

    if (this.states.every((s) => s.finished || s.dnf)) {
      this.phase = "finished";
      ev.raceOver = true;
    }
    return ev;
  }

  private finishRacer(s: RacerState, ev: RaceEvents): void {
    s.finished = true;
    s.finishTime = this.raceTime;
    s.score += 1e6; // finished racers always outrank unfinished
    if (this.winnerTime == null) this.winnerTime = this.raceTime;
    ev.finishes.push(s.racer.id);
  }

  /** Settle the race: winner takes the paper pool. Returns immutable result. */
  settle(): RaceResult {
    if (this.phase !== "finished") {
      for (const s of this.states) {
        if (!s.finished && !s.dnf) s.dnf = true;
      }
      this.phase = "finished";
    }
    const order = this.standings();
    const winner = order.find((s) => s.finished) ?? order[0];
    const pot = this.pool.pot();
    this.pool.payout(winner.racerId);
    return {
      raceId: this.raceId,
      circuitName: this.circuit.name,
      winnerId: winner.racerId,
      standings: order,
      potCity: pot,
      burnedOrbitx: this.burnedOrbitx,
      totalTime: this.raceTime,
    };
  }
}

/**
 * Lightweight arcade kinematics for bot/remote cars. Mirrors the *feel* of
 * core's CarPhysics (velocity along heading, speed-sensitive steering)
 * without duplicating its collision code — bots race on closed circuits
 * where the checkpoint line keeps them honest, and the integrator may
 * optionally add collider resolution around this step.
 */
function integrateKinematic(
  v: { pos: { x: number; z: number }; heading: number; speed: number },
  cmd: { throttle: number; steer: number; handbrake: boolean },
  dt: number,
): void {
  const maxSpeed = 36;
  const maxReverse = 12;
  if (cmd.throttle > 0) {
    v.speed += 16 * cmd.throttle * dt * (1 - v.speed / (maxSpeed * 1.35));
  } else if (cmd.throttle < 0) {
    if (v.speed > 0.5) v.speed -= 30 * dt;
    else v.speed = Math.max(-maxReverse, v.speed + 16 * 0.7 * dt);
  } else {
    v.speed -= v.speed * (cmd.handbrake ? 4 : 0.6) * dt;
    if (Math.abs(v.speed) < 0.05) v.speed = 0;
  }
  v.speed = Math.max(-maxReverse, Math.min(maxSpeed, v.speed));
  const steerAuthority = 1.9 / (1 + Math.abs(v.speed) * 0.055);
  v.heading -= cmd.steer * steerAuthority * dt * Math.sign(v.speed || 1)
    * Math.min(1, Math.abs(v.speed) / 4 + 0.25);
  v.pos.x += Math.sin(v.heading) * v.speed * dt;
  v.pos.z += Math.cos(v.heading) * v.speed * dt;
}
