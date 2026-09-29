/**
 * ORBITXCITY sports — manager: registry, lifecycle, per-frame update.
 *
 * The integrator creates ONE manager, calls `mount(ctx)` once with the
 * live scene/camera, then `update(dt)` from the game loop and
 * `start(sportId)` / `stop()` from UI or proximity triggers.
 */
import * as THREE from "three";
import { SportsBus, type SportId, type SportInput, type SportSim, type SportsContext, type VenueAnchors } from "./types";
import { PaperLedger } from "./economy";
import { resolveVenues, type VenuePositions } from "./venues";

export class SportsManager {
  readonly bus = new SportsBus();
  readonly ledger: PaperLedger;
  readonly venues: VenuePositions;
  private ctx: SportsContext | null = null;
  private sims = new Map<SportId, SportSim>();
  private activeId: SportId | null = null;
  private venueGroup: THREE.Group | null = null;

  constructor(anchors?: VenueAnchors) {
    this.ledger = new PaperLedger(this.bus);
    this.venues = resolveVenues(anchors);
  }

  register(sim: SportSim): void {
    this.sims.set(sim.meta.id, sim);
  }

  list(): SportSim[] {
    return [...this.sims.values()];
  }

  get active(): SportId | null {
    return this.activeId;
  }

  get context(): SportsContext | null {
    return this.ctx;
  }

  /** One-time mount: adds every sport's venue props to the world scene. */
  mount(ctx: SportsContext): void {
    this.ctx = ctx;
    this.venueGroup = new THREE.Group();
    this.venueGroup.name = "orbitxcity-sports-venues";
    for (const sim of this.sims.values()) {
      for (const prop of sim.buildVenue()) this.venueGroup.add(prop);
    }
    ctx.scene.add(this.venueGroup);
  }

  unmount(): void {
    this.stop();
    if (this.ctx && this.venueGroup) {
      this.ctx.scene.remove(this.venueGroup);
      this.venueGroup = null;
    }
    this.ctx = null;
  }

  start(id: SportId): boolean {
    const sim = this.sims.get(id);
    if (!sim || !this.ctx) return false;
    if (this.activeId === id) return true;
    this.stop();
    const granted = this.ctx.requestExclusiveControl?.(id) ?? true;
    if (!granted) return false;
    this.ctx.setPlayerVisible?.(false);
    this.activeId = id;
    sim.start();
    this.bus.emit({ type: "activity", phase: "started", sport: id });
    this.ctx.notify?.(`${sim.meta.icon} ${sim.meta.name} — ${sim.meta.tagline}`);
    return true;
  }

  stop(summary?: string): void {
    if (!this.activeId || !this.ctx) return;
    const sim = this.sims.get(this.activeId);
    const id = this.activeId;
    this.activeId = null;
    sim?.stop();
    this.ctx.requestExclusiveControl?.(null);
    this.ctx.setPlayerVisible?.(true);
    this.bus.emit({ type: "activity", phase: "ended", sport: id, summary });
  }

  /** Called every frame from the game loop. */
  update(dt: number): void {
    if (!this.activeId || !this.ctx) return;
    const sim = this.sims.get(this.activeId);
    if (!sim) return;
    const input = this.ctx.readInput?.() ?? EMPTY_INPUT;
    sim.update(Math.min(dt, 0.05) * (this.ctx.timeScale ?? 1), input);
  }

  /** Distance check helper for "press E near venue" prompts. */
  distanceTo(id: SportId): number | null {
    if (!this.ctx) return null;
    const anchor = VENUE_ANCHOR_OF[id];
    if (!anchor) return null;
    return this.ctx.getPlayerState().pos.distanceTo(anchor(this.venues));
  }
}

const VENUE_ANCHOR_OF: Record<SportId, (v: VenuePositions) => THREE.Vector3> = {
  skate: (v) => v.skatePlaza,
  sponsors: (v) => v.skatePlaza,
  parkour: (v) => v.parkourStart[0],
  basejump: (v) => v.towerBase,
  wingsuit: (v) => v.towerBase,
  tournament: (v) => v.gymArena,
  dojo: (v) => v.dojoHall,
  surf: (v) => v.surfBeach,
  golf: (v) => v.golfCourse,
  fishing: (v) => v.pier,
};

const EMPTY_INPUT: SportInput = {
  left: false, right: false, up: false, down: false,
  action1: false, action2: false, action3: false, action4: false,
  pressed1: false, pressed2: false, pressed3: false, pressed4: false,
};

/** Convenience factory the integrator can call after registering all sims. */
export function createSportsManager(anchors?: VenueAnchors): SportsManager {
  return new SportsManager(anchors);
}
