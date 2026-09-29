/**
 * OrbitXCity — RACING MODULE AI.
 *
 * Bot racers implement IRacer so the session treats them exactly like the
 * player (multiplayer-ready: a future netcode `RemoteRacer` just swaps in
 * another IRacer). PlayerRacer exposes setCommand() — the integrator feeds
 * core driving input into it every tick.
 */
import type {
  DriveCommand, DriveContext, IRacer, VehicleLike,
} from "./types";

export interface BotProfile {
  name: string;
  /** 0..1 — cornering speed, throttle commitment */
  skill: number;
  /** 0..1 — willingness to run wide / block */
  aggression: number;
  /** car paint */
  color: number;
}

const BOT_NAMES = [
  "Vex", "Nitro", "Ghost", "Blaze", "Onyx", "Turbo", "Rogue", "Dash",
  "Viper", "Echo", "Jinx", "Fury", "Ace", "Nova", "Raptor", "Zed",
];

export function randomBotProfile(i: number): BotProfile {
  return {
    name: BOT_NAMES[i % BOT_NAMES.length],
    skill: 0.55 + Math.random() * 0.4,
    aggression: 0.25 + Math.random() * 0.6,
    color: [0xc0392b, 0x2980b9, 0xf1c40f, 0x8e44ad, 0x16a085, 0xe67e22][i % 6],
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function angDiff(a: number, b: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/**
 * Pure-pursuit driver with curvature lookahead, per-bot lateral offset
 * (so bots don't stack on the racing line) and rubber-banding toward the
 * pack so races stay dramatic without feeling rigged.
 */
export function createBotRacer(
  id: string,
  profile: BotProfile,
  vehicle: VehicleLike,
): IRacer {
  const laneOffset = (Math.random() - 0.5) * 4 * (0.5 + profile.aggression);
  let wrongWayT = 0;

  return {
    id,
    name: profile.name,
    kind: "bot",
    vehicle,
    drive: (ctx: DriveContext): DriveCommand => {
      const v = vehicle;
      const px = v.pos.x;
      const pz = v.pos.z;

      // aim point: next waypoint shifted laterally by this bot's lane offset
      const dx = ctx.nextWaypoint.x - px;
      const dz = ctx.nextWaypoint.z - pz;
      const d = Math.hypot(dx, dz) || 1;
      const fx = dx / d;
      const fz = dz / d;
      const ax = ctx.nextWaypoint.x + fz * laneOffset;
      const az = ctx.nextWaypoint.z - fx * laneOffset;

      const wantHeading = Math.atan2(ax - px, az - pz);
      const dh = angDiff(v.heading, wantHeading);
      const steer = clamp(dh * 2.4, -1, 1);

      // curvature: angle between (pos -> next) and (next -> after)
      const h1 = Math.atan2(ctx.nextWaypoint.x - px, ctx.nextWaypoint.z - pz);
      const h2 = Math.atan2(
        ctx.afterWaypoint.x - ctx.nextWaypoint.x,
        ctx.afterWaypoint.z - ctx.nextWaypoint.z,
      );
      const curve = Math.abs(angDiff(h1, h2));

      // target speed: core cars top out ~36 m/s; bots brake for corners
      const baseTop = 26 + profile.skill * 9;
      const cornerFactor = clamp(1 - curve * 0.9, 0.35, 1);
      let target = baseTop * cornerFactor;

      // rubber-band: chase the pack, ease off when dominating
      if (ctx.position > 2) target *= 1 + Math.min(0.14, (ctx.position - 1) * 0.035);
      else if (ctx.position === 1) target *= 0.94;

      // close to the checkpoint: don't overshoot hairpins
      if (d < 18 && curve > 0.5) target = Math.min(target, 12);

      const speed = Math.abs(v.speed);
      let throttle: number;
      if (speed < target - 1.5) throttle = 1;
      else if (speed > target + 3) throttle = -0.7; // brake
      else throttle = 0.25;

      // wrong-way recovery: if we're facing away and barely moving, reverse out
      if (Math.abs(dh) > 2.4 && speed < 3) {
        wrongWayT += ctx.dt;
        if (wrongWayT > 0.6) return { throttle: -0.8, steer: -steer, handbrake: false };
      } else {
        wrongWayT = 0;
      }

      return { throttle, steer, handbrake: Math.abs(dh) > 1.9 && speed > 18 };
    },
  };
}

/**
 * The human player. The integrator calls setCommand() every frame with the
 * core driving input (WASD / touch joystick mapped to throttle/steer).
 */
export function createPlayerRacer(
  id: string,
  name: string,
  vehicle: VehicleLike,
): IRacer & { setCommand: (cmd: DriveCommand) => void } {
  let cmd: DriveCommand = { throttle: 0, steer: 0, handbrake: false };
  return {
    id,
    name,
    kind: "player",
    vehicle,
    drive: () => cmd,
    setCommand: (c: DriveCommand) => { cmd = c; },
  };
}

/**
 * Placeholder for future netcode. Behaves like a mid-skill bot locally so
 * the lobby/session code paths are exercised; swap drive() for packet
 * interpolation when multiplayer lands.
 */
export function createRemoteRacer(
  id: string,
  name: string,
  vehicle: VehicleLike,
): IRacer {
  const bot = createBotRacer(id, { name, skill: 0.7, aggression: 0.4, color: 0xecf0f1 }, vehicle);
  return { ...bot, kind: "remote" as const };
}
