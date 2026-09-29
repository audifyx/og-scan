/**
 * ORBITXCITY — sports module shared types.
 *
 * Self-contained: this module imports ONLY `three` and `react`.
 * It never imports core (`../core`) or tokenomics (`@/tokenomics`).
 * The integrator wires a {@link SportsContext} into the manager.
 */
import type * as THREE from "three";

/** Unique ids for the 10 shipped sports activities. */
export type SportId =
  | "skate"
  | "sponsors"
  | "parkour"
  | "basejump"
  | "wingsuit"
  | "tournament"
  | "dojo"
  | "surf"
  | "golf"
  | "fishing";

/** Events broadcast on the sports bus (activity sims -> HUD). */
export type SportsEvent =
  | { type: "paper"; delta: number; balance: number; reason: string }
  | { type: "style"; sport: SportId; points: number; total: number; label: string }
  | { type: "activity"; phase: "started" | "ended"; sport: SportId; summary?: string }
  | { type: "toast"; message: string }
  | { type: "tick"; sport: SportId; state: unknown };

export type SportsListener = (e: SportsEvent) => void;

/** Tiny emitter so sims can push HUD updates without React imports. */
export class SportsBus {
  private listeners = new Set<SportsListener>();
  on(l: SportsListener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }
  emit(e: SportsEvent): void {
    for (const l of this.listeners) {
      try { l(e); } catch { /* HUD listeners must never break a sim */ }
    }
  }
}

/** Minimal input contract a sport sim needs (keyboard + touch). */
export interface SportInput {
  left: boolean; right: boolean; up: boolean; down: boolean;
  /** primary action (jump / cast / swing / attack-light) */
  action1: boolean; action2: boolean; action3: boolean; action4: boolean;
  /** edge-triggered: true only on the frame the key/button went down */
  pressed1: boolean; pressed2: boolean; pressed3: boolean; pressed4: boolean;
}

/**
 * Integration contract. The integrator (core team) provides this when
 * mounting the sports module. It maps 1:1 onto the real core API in
 * `web/src/city/core/`:
 *   - `scene`       <- `world.sceneRef`
 *   - `getPlayerState` <- `world.getPlayerState()` (onFoot/pos/heading/speed/speedKmh/dayT/isNight)
 *   - `teleport`    <- `world.teleport(x, z, heading)`
 *   - `camera`      <- integrator-supplied (GTAWorld keeps its camera
 *                      private; the merge adds a passthrough or the
 *                      integrator grabs it from the render loop)
 * Everything the sports sims need goes through here — no core imports.
 */
export interface PlayerSnapshot {
  onFoot: boolean;
  pos: THREE.Vector3;
  heading: number;
  speed: number;
  speedKmh: number;
  dayT: number;
  isNight: boolean;
}

export interface SportsContext {
  /** The live three.js scene to add venue props to (`world.sceneRef`). */
  scene: THREE.Scene;
  /** The live world camera (sims take it over while active). */
  camera: THREE.PerspectiveCamera;
  /** Read-only player snapshot (`world.getPlayerState()`). */
  getPlayerState: () => PlayerSnapshot;
  /** Move the player (`world.teleport(x, z, heading)`). */
  teleport: (x: number, z: number, heading?: number) => void;
  /** World units per second helper the integrator owns (default 1). */
  timeScale?: number;
  /** Ask core to hide/show the player avatar while a sport sim takes over. */
  setPlayerVisible?: (visible: boolean) => void;
  /** Suspend core's third-person controller while a sport is active. */
  requestExclusiveControl?: (sport: SportId | null) => boolean;
  /** Surface HUD messages through the core HUD pipeline. */
  notify?: (message: string) => void;
  /** Fill per-frame: sports sims read raw keys when the HUD has focus. */
  readInput?: () => SportInput;
  /** Integrator hook: restore the core camera rig after a sport ends. */
  releaseCamera?: () => void;
}

/** Anchor points the integrator may override to snap venues to real geometry. */
export interface VenueAnchors {
  /** Base-jump / wingsuit launch tower top. */
  towerTop?: THREE.Vector3;
  /** Ocean waterline (x of shoreline) for surf + pier. */
  shorelineX?: number;
  /** Flat plaza center for the skate park. */
  skatePlaza?: THREE.Vector3;
  /** Rooftop course start positions (parkour). */
  rooftops?: THREE.Vector3[];
}

export interface SportMeta {
  id: SportId;
  name: string;
  tagline: string;
  icon: string; // emoji used by the HUD (no asset pipeline needed)
  venue: string;
  premium?: { cost: number; label: string }; // real-ORBITX upsell, billing-gated
}

/** Common lifecycle every sport sim implements. */
export interface SportSim {
  meta: SportMeta;
  /** True while the sim owns input/camera. */
  readonly active: boolean;
  /** Build venue props (called once on mount). Returns meshes for the integrator. */
  buildVenue(): THREE.Object3D[];
  start(): void;
  stop(): void;
  update(dt: number, input: SportInput): void;
}

export interface PremiumResult {
  ok: boolean;
  reason: string;
  signature?: string;
}
