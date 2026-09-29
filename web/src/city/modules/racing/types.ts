/**
 * OrbitXCity — RACING MODULE types.
 *
 * Shared, UI-agnostic contracts for street racing, pink-slip duels and
 * desert rally raids. This module is deliberately self-contained:
 * it does NOT import core/ or any other module. Vehicle state is
 * described by structural interfaces (VehicleLike) that core's
 * CarPhysics satisfies without a hard dependency.
 */
import type { Vector3 } from "three";

/** 2D world position (x,z plane). */
export interface Vec2 {
  x: number;
  z: number;
}

/**
 * Minimum vehicle surface the racing module needs.
 * Satisfied structurally by core's `CarPhysics` (pos/heading/speed).
 * The integrator passes the live object — the module never constructs cars.
 */
export interface VehicleLike {
  pos: Vector3;
  heading: number;
  speed: number;
}

/** Command a racer's vehicle should execute this tick. */
export interface DriveCommand {
  /** -1 (full reverse/brake) .. 1 (full throttle) */
  throttle: number;
  /** -1 (full left) .. 1 (full right) */
  steer: number;
  handbrake: boolean;
}

/** Context handed to a racer's drive() each tick. */
export interface DriveContext {
  dt: number;
  /** next checkpoint to hit */
  nextWaypoint: Vec2;
  /** waypoint after that (for curvature lookahead) */
  afterWaypoint: Vec2;
  distanceToNext: number;
  /** 1-based live position */
  position: number;
  /** seconds since GO */
  raceTime: number;
  /** laps completed by the race leader */
  leaderLaps: number;
}

export type EntrantKind = "player" | "bot" | "remote";

/**
 * A race entrant. Multiplayer-ready: the human player, an AI bot, or a
 * future netcode-backed remote driver all implement this interface.
 * `drive` is called every tick while the race is live.
 */
export interface IRacer {
  id: string;
  name: string;
  kind: EntrantKind;
  vehicle: VehicleLike;
  drive: (ctx: DriveContext) => DriveCommand;
}

/** A street circuit: ordered checkpoints forming a closed loop or a route. */
export interface StreetCircuit {
  id: string;
  name: string;
  description: string;
  /** ordered checkpoints; for loops the last checkpoint leads back to [0] */
  waypoints: Vec2[];
  loop: boolean;
  defaultLaps: number;
  checkpointRadius: number;
  /** recommended entrant count */
  gridSize: number;
}

/** A desert rally route (point-to-point, outside the city). */
export interface RallyRoute {
  id: string;
  name: string;
  description: string;
  checkpoints: Vec2[];
  /** ~km, informational */
  lengthKm: number;
  checkpointRadius: number;
  paceNotes: string[];
}

/** Live standing row for one entrant. */
export interface RaceStanding {
  racerId: string;
  name: string;
  kind: EntrantKind;
  position: number;
  lap: number;
  checkpoint: number;
  finished: boolean;
  finishTime: number | null;
  dnf: boolean;
  wrongWay: boolean;
  lastLapTime: number | null;
  bestLapTime: number | null;
}

/** Final, immutable race result. */
export interface RaceResult {
  raceId: string;
  circuitName: string;
  winnerId: string;
  standings: RaceStanding[];
  /** paper CITY pot paid to the winner */
  potCity: number;
  /** real ORBITX burned in entry fees (0 if billing not ready) */
  burnedOrbitx: number;
  totalTime: number;
}

/** Events emitted by RaceSession.update — the integrator maps these to SFX/UI. */
export interface RaceEvents {
  countdownTick: number | null; // 3/2/1 while counting down
  go: boolean;
  checkpointHits: string[]; // racer ids that hit a checkpoint this tick
  lapCompletions: { racerId: string; lap: number; lapTime: number }[];
  finishes: string[];
  wrongWay: string[];
  raceOver: boolean;
}

export type RacePhase = "lobby" | "countdown" | "racing" | "finished";
