/**
 * OrbitXCity — Police module: pursuit AI.
 *
 * Framework-agnostic pursuit simulation. The `PursuitDirector` owns cop
 * units and their tactics; the integrator supplies a `PursuitWorldPort`
 * (player snapshot, spawn/move/despawn hooks, event sink) wired to
 * `GTAWorld`. The director NEVER moves the player — it only moves cop
 * visuals and emits events (bust conditions, PIT hits, spike hits); the
 * integrator applies gameplay consequences (slow the car, trigger arrest).
 *
 * Escalation by wanted stars:
 *  1★ — foot cops converge on your last-known position; lose you easily.
 *  2★ — +1 cruiser; cruisers close fast on roads, foot cops box you in.
 *  3★ — +cruisers, PIT attempts: a cruiser alongside your car slams it
 *        (integrator slows the vehicle on `pit_hit`).
 *  4★ — roadblock: two cruisers form a wall ahead of your heading.
 *  5★ — spike strip ahead + maximum aggression; no mercy.
 *
 * Bust conditions (emitted via `onEvent({type:"bust_imminent"})` — the
 * integrator then calls `policeStore.bust()`):
 *  - on foot: a foot cop within 3 m while wanted ≥ 2★.
 *  - in vehicle: a cruiser within 5 m while your speed < 2 m/s and wanted ≥ 3★.
 */

import type {
  CopKind,
  CopUnit,
  PursuitEvent,
  PursuitSnapshot,
  PursuitTactic,
  PursuitWorldPort,
  Vec2,
  WantedStars,
} from "./types";

const FOOT_SPEED = 5.2; // m/s — cops jog; a sprinting player can outrun one
const CRUISER_SPEED = 26; // m/s
const SIGHT_RANGE = 90; // m — cops see the player within this
const LOSE_SIGHT_AFTER = 6; // s without seeing you before the unit "loses" you
const PIT_RANGE = 7; // m — cruiser alongside player
const BUST_FOOT_RANGE = 3;
const BUST_CAR_RANGE = 5;
const DESPAWN_RANGE = 320; // m — cop too far behind: despawn, respawn near player

function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function sub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, z: a.z - b.z };
}

function norm(v: Vec2): Vec2 {
  const d = Math.hypot(v.x, v.z) || 1;
  return { x: v.x / d, z: v.z / d };
}

/** Wanted units by stars: [foot cops, cruisers]. */
const UNIT_BUDGET: Record<Exclude<WantedStars, 0>, [number, number]> = {
  1: [2, 0],
  2: [2, 1],
  3: [1, 3],
  4: [1, 4],
  5: [2, 5],
};

/** Spawn ring around the player, meters. */
const SPAWN_MIN = 45;
const SPAWN_MAX = 110;

export class PursuitDirector {
  private world: PursuitWorldPort;
  private units: CopUnit[] = [];
  private running = false;
  private lostSightAnnounced = false;
  private spottedAnnounced = false;
  private roadblockPlaced = false;
  private spikePlaced = false;
  private spikePos: Vec2 | null = null;
  private pitFlash = 0;

  constructor(world: PursuitWorldPort) {
    this.world = world;
  }

  get snapshot(): PursuitSnapshot {
    if (!this.running || this.units.length === 0) {
      return { active: false, unitCount: 0, tactic: "search", closest: Infinity };
    }
    const p = this.world.player();
    const closest = Math.min(...this.units.map((u) => dist(u.pos, p.pos)));
    const tactic = this.dominantTactic();
    return { active: true, unitCount: this.units.length, tactic, closest };
  }

  private dominantTactic(): PursuitTactic {
    const rank: PursuitTactic[] = ["search", "chase", "pit", "roadblock", "spike"];
    let best: PursuitTactic = "search";
    for (const u of this.units) {
      if (rank.indexOf(u.tactic) > rank.indexOf(best)) best = u.tactic;
    }
    return best;
  }

  /** Start a pursuit at the given wanted level. Idempotent. */
  start(stars: WantedStars): void {
    if (stars === 0) {
      this.stop();
      return;
    }
    this.running = true;
    this.lostSightAnnounced = false;
    this.spottedAnnounced = true;
    this.ensureBudget(stars);
  }

  /** Reconcile unit counts when stars change mid-pursuit. */
  setStars(stars: WantedStars): void {
    if (stars === 0) {
      this.stop();
      return;
    }
    if (!this.running) {
      this.start(stars);
      return;
    }
    this.ensureBudget(stars);
    if (stars >= 4) this.roadblockPlaced = false; // allow a fresh roadblock
    if (stars >= 5) this.spikePlaced = false;
  }

  /** End the pursuit — despawn all units. */
  stop(): void {
    for (const u of this.units) this.world.despawnCop(u.id);
    this.units = [];
    this.running = false;
    this.roadblockPlaced = false;
    this.spikePlaced = false;
    this.spikePos = null;
  }

  private spawnRingPos(p: Vec2, i: number, total: number): Vec2 {
    const ang = (i / Math.max(total, 1)) * Math.PI * 2 + Math.random() * 0.6;
    const r = SPAWN_MIN + Math.random() * (SPAWN_MAX - SPAWN_MIN);
    return { x: p.x + Math.cos(ang) * r, z: p.z + Math.sin(ang) * r };
  }

  private ensureBudget(stars: WantedStars): void {
    const [wantFoot, wantCruiser] = UNIT_BUDGET[stars];
    const p = this.world.player().pos;
    const count = (kind: CopKind) => this.units.filter((u) => u.kind === kind).length;

    const add = (kind: CopKind, n: number) => {
      for (let k = 0; k < n; k++) {
        const id = this.world.spawnCop(kind);
        const pos = this.spawnRingPos(p, this.units.length, wantFoot + wantCruiser);
        this.units.push({
          id,
          kind,
          pos,
          heading: 0,
          speed: 0,
          tactic: "chase",
          target: { ...p },
          lastSeenAgo: 0,
          pitCooldown: 0,
        });
      }
    };

    if (count("foot") < wantFoot) add("foot", wantFoot - count("foot"));
    if (count("cruiser") < wantCruiser) add("cruiser", wantCruiser - count("cruiser"));

    // Trim extras of each kind.
    for (const kind of ["foot", "cruiser"] as CopKind[]) {
      const want = kind === "foot" ? wantFoot : wantCruiser;
      const extras = this.units.filter((u) => u.kind === kind).slice(want);
      for (const u of extras) {
        this.world.despawnCop(u.id);
        this.units = this.units.filter((x) => x !== u);
      }
    }
  }

  private emit(ev: PursuitEvent) {
    try {
      this.world.onEvent(ev);
    } catch {
      /* ignore */
    }
  }

  /**
   * Advance the simulation. `stars` drives tactics; `evadedOut` returns
   * whether every unit has lost sight (heat decays fast then).
   */
  update(dt: number, stars: WantedStars): { evaded: boolean } {
    if (!this.running) return { evaded: true };
    if (stars === 0) {
      this.stop();
      return { evaded: true };
    }
    this.ensureBudget(stars);

    const p = this.world.player();
    const los = this.world.lineOfSightClear ?? (() => true);
    let allLost = true;

    for (const u of this.units) {
      const d = dist(u.pos, p.pos);
      const sees = d < SIGHT_RANGE && los(u.pos, p.pos);
      if (sees) {
        u.lastSeenAgo = 0;
        u.target = { ...p.pos };
        allLost = false;
      } else {
        u.lastSeenAgo += dt;
      }
      u.pitCooldown = Math.max(0, u.pitCooldown - dt);

      // Respawn stragglers near the action instead of simulating a marathon.
      if (d > DESPAWN_RANGE) {
        u.pos = this.spawnRingPos(p.pos, Math.floor(Math.random() * 8), 8);
        u.lastSeenAgo = 0;
      }

      this.updateUnit(u, p, d, stars, dt, sees);

      u.heading = Math.atan2(u.target.x - u.pos.x, u.target.z - u.pos.z);
      this.world.moveCop(u.id, u.pos, u.heading);
    }

    // Spike strip trigger.
    if (this.spikePos && !p.onFoot && p.speed > 6 && dist(p.pos, this.spikePos) < 6) {
      this.emit({ type: "spike_hit" });
      this.spikePos = null; // one use
      this.spikePlaced = false;
    }

    // Sight announcements drive heat decay in the store.
    if (allLost && !this.lostSightAnnounced) {
      this.emit({ type: "lost_sight" });
      this.lostSightAnnounced = true;
      this.spottedAnnounced = false;
    } else if (!allLost && !this.spottedAnnounced) {
      this.emit({ type: "spotted" });
      this.spottedAnnounced = true;
      this.lostSightAnnounced = false;
    }

    this.checkBust(p, stars);

    return { evaded: allLost };
  }

  private updateUnit(
    u: CopUnit,
    p: { pos: Vec2; onFoot: boolean; speed: number; heading: number },
    d: number,
    stars: WantedStars,
    dt: number,
    sees: boolean,
  ): void {
    const lost = u.lastSeenAgo > LOSE_SIGHT_AFTER;

    if (u.kind === "foot") {
      if (p.onFoot && !lost) {
        u.tactic = "chase";
        u.target = { ...p.pos };
        this.steer(u, u.target, FOOT_SPEED * (stars >= 4 ? 1.25 : 1), dt);
      } else {
        // Search the last-known position, then wander.
        u.tactic = "search";
        if (dist(u.pos, u.target) < 4) {
          const a = Math.random() * Math.PI * 2;
          u.target = { x: u.pos.x + Math.cos(a) * 25, z: u.pos.z + Math.sin(a) * 25 };
        }
        this.steer(u, u.target, FOOT_SPEED * 0.6, dt);
      }
      return;
    }

    // --- cruiser ---
    const wantRoadblock = stars >= 4 && !this.roadblockPlaced && p.speed > 8 && !p.onFoot;
    const wantSpike = stars >= 5 && !this.spikePlaced && !p.onFoot && p.speed > 10;

    if (wantSpike) {
      // Lay the strip ~60 m ahead of the player's heading.
      this.spikePos = {
        x: p.pos.x + Math.sin(p.heading) * 60,
        z: p.pos.z + Math.cos(p.heading) * 60,
      };
      this.spikePlaced = true;
      u.tactic = "spike";
    } else if (wantRoadblock) {
      this.roadblockPlaced = true;
      u.tactic = "roadblock";
    }

    if (u.tactic === "roadblock") {
      // Park across the road ~40 m ahead of the player.
      const ahead = {
        x: p.pos.x + Math.sin(p.heading) * 40,
        z: p.pos.z + Math.cos(p.heading) * 40,
      };
      const side = u.id.charCodeAt(u.id.length - 1) % 2 === 0 ? 6 : -6;
      const perp = p.heading + Math.PI / 2;
      u.target = { x: ahead.x + Math.sin(perp) * side, z: ahead.z + Math.cos(perp) * side };
      if (dist(u.pos, u.target) < 3) {
        u.speed = 0;
        return; // holding the line
      }
      this.steer(u, u.target, CRUISER_SPEED, dt);
      return;
    }

    if (u.tactic === "spike") {
      u.target = this.spikePos ?? { ...p.pos };
      if (dist(u.pos, u.target) < 8) {
        u.speed = 0;
        return;
      }
      this.steer(u, u.target, CRUISER_SPEED * 0.7, dt);
      return;
    }

    // PIT attempt: alongside the player's car, matching speed.
    const canPit = stars >= 3 && !p.onFoot && d < PIT_RANGE && p.speed > 8 && u.pitCooldown <= 0;
    if (canPit) {
      u.tactic = "pit";
      // Ram the rear quarter: aim slightly ahead of the player, offset to the side.
      const toPlayer = norm(sub(p.pos, u.pos));
      const side: Vec2 = { x: -toPlayer.z, z: toPlayer.x };
      const sign = (u.id.charCodeAt(u.id.length - 1) % 2 === 0 ? 1 : -1);
      u.target = {
        x: p.pos.x + toPlayer.x * 3 + side.x * 3 * sign,
        z: p.pos.z + toPlayer.z * 3 + side.z * 3 * sign,
      };
      this.steer(u, u.target, CRUISER_SPEED * 1.05, dt);
      if (d < 4.5) {
        this.emit({ type: "pit_hit", copId: u.id });
        u.pitCooldown = 6;
        this.pitFlash = 0.4;
      }
      return;
    }

    // Default: intercept — aim ahead of a moving player.
    u.tactic = lost ? "search" : "chase";
    const lead = p.onFoot ? 0 : Math.min(p.speed * 0.8, 18);
    u.target = {
      x: p.pos.x + Math.sin(p.heading) * lead,
      z: p.pos.z + Math.cos(p.heading) * lead,
    };
    const cruise = CRUISER_SPEED * (lost ? 0.7 : 1);
    this.steer(u, u.target, cruise, dt);
  }

  private steer(u: CopUnit, target: Vec2, speed: number, dt: number): void {
    const dir = norm(sub(target, u.pos));
    const d = dist(u.pos, target);
    u.speed = d < 2 ? 0 : speed;
    u.pos = {
      x: u.pos.x + dir.x * u.speed * dt,
      z: u.pos.z + dir.z * u.speed * dt,
    };
    void this.pitFlash;
  }

  private checkBust(p: { pos: Vec2; onFoot: boolean; speed: number }, stars: WantedStars): void {
    for (const u of this.units) {
      const d = dist(u.pos, p.pos);
      if (u.kind === "foot" && p.onFoot && stars >= 2 && d < BUST_FOOT_RANGE) {
        this.emit({ type: "bust_imminent", reason: "foot" });
        return;
      }
      if (u.kind === "cruiser" && stars >= 3 && d < BUST_CAR_RANGE && p.speed < 2) {
        this.emit({ type: "bust_imminent", reason: "vehicle" });
        return;
      }
    }
  }
}
