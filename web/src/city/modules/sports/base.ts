/**
 * ORBITXCITY sports — shared base for sport sims.
 *
 * Every sim runs "instanced": while active it owns the camera and drives
 * its own lightweight avatar at the venue, so the sports module never
 * touches the core third-person controller. On stop() the camera is
 * handed back to the integrator (core resumes its own follow logic).
 */
import * as THREE from "three";
import type { SportId, SportInput, SportMeta, SportSim, SportsContext } from "./types";
import { SportsBus } from "./types";
import type { PaperLedger } from "./economy";
import type { VenuePositions } from "./venues";

export interface SportDeps {
  bus: SportsBus;
  ledger: PaperLedger;
  venues: VenuePositions;
  getCtx: () => SportsContext | null;
}

/** Minimal stylized athlete (realistic-ish proportions, not blocky). */
export function createAthlete(shirtColor = 0x22d3ee, skinColor = 0xc98d64): THREE.Group {
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.7 });
  const shirt = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.85 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.9 });

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.55, 6, 12), shirt);
  torso.position.y = 1.05; torso.castShadow = true; g.add(torso);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 16, 12), skin);
  head.position.y = 1.78; head.castShadow = true; g.add(head);

  const mkLimb = (len: number, r: number, m: THREE.Material, x: number, y: number) => {
    const limb = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 8), m);
    limb.position.set(x, y, 0); limb.castShadow = true;
    return limb;
  };
  const armL = mkLimb(0.45, 0.08, skin, -0.36, 1.15);
  const armR = mkLimb(0.45, 0.08, skin, 0.36, 1.15);
  const legL = mkLimb(0.55, 0.1, pants, -0.14, 0.42);
  const legR = mkLimb(0.55, 0.1, pants, 0.14, 0.42);
  g.add(armL, armR, legL, legR);
  g.userData.limbs = { armL, armR, legL, legR };
  return g;
}

/** Cheap run-cycle: swing limbs with a phase. */
export function animateRun(athlete: THREE.Group, t: number, intensity = 1): void {
  const { armL, armR, legL, legR } = athlete.userData.limbs as Record<string, THREE.Mesh>;
  const s = Math.sin(t * 11) * 0.55 * intensity;
  legL.rotation.x = s; legR.rotation.x = -s;
  armL.rotation.x = -s * 0.8; armR.rotation.x = s * 0.8;
}

export function resetPose(athlete: THREE.Group): void {
  const { armL, armR, legL, legR } = athlete.userData.limbs as Record<string, THREE.Mesh>;
  for (const l of [armL, armR, legL, legR]) l.rotation.set(0, 0, 0);
}

export abstract class SportBase implements SportSim {
  abstract meta: SportMeta;
  protected deps: SportDeps;
  protected _active = false;
  protected athlete: THREE.Group | null = null;
  protected camPos = new THREE.Vector3();
  protected camLook = new THREE.Vector3();
  protected elapsed = 0;

  constructor(deps: SportDeps) {
    this.deps = deps;
  }

  get active(): boolean { return this._active; }
  protected get ctx(): SportsContext | null { return this.deps.getCtx(); }
  protected get bus(): SportsBus { return this.deps.bus; }
  protected get ledger(): PaperLedger { return this.deps.ledger; }
  protected get venues(): VenuePositions { return this.deps.venues; }

  abstract buildVenue(): THREE.Object3D[];
  abstract start(): void;
  abstract stop(): void;
  abstract update(dt: number, input: SportInput): void;

  /** Spawn the athlete avatar at a position. */
  protected spawnAthlete(pos: THREE.Vector3, shirt = 0x22d3ee): THREE.Group {
    this.despawnAthlete();
    this.athlete = createAthlete(shirt);
    this.athlete.position.copy(pos);
    this.ctx?.scene.add(this.athlete);
    return this.athlete;
  }

  protected despawnAthlete(): void {
    if (this.athlete) {
      this.ctx?.scene.remove(this.athlete);
      this.athlete = null;
    }
  }

  /** Smooth chase camera. */
  protected chase(target: THREE.Vector3, back: number, height: number, lookAhead = 2.5, lerp = 6): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const dir = new THREE.Vector3();
    ctx.camera.getWorldDirection(dir);
    dir.y = 0; dir.normalize();
    if (dir.lengthSq() < 0.01) dir.set(0, 0, 1);
    this.camPos.lerp(new THREE.Vector3(target.x - dir.x * back, target.y + height, target.z - dir.z * back), Math.min(1, lerp * 0.016));
    this.camLook.lerp(new THREE.Vector3(target.x + dir.x * lookAhead, target.y + 1.2, target.z + dir.z * lookAhead), Math.min(1, lerp * 0.016));
    ctx.camera.position.copy(this.camPos);
    ctx.camera.lookAt(this.camLook);
  }

  /** Snap camera instantly (on start). */
  protected snapCam(eye: THREE.Vector3, look: THREE.Vector3): void {
    const ctx = this.ctx;
    if (!ctx) return;
    this.camPos.copy(eye); this.camLook.copy(look);
    ctx.camera.position.copy(eye);
    ctx.camera.lookAt(look);
  }

  protected toast(msg: string): void {
    this.bus.emit({ type: "toast", message: msg });
  }

  protected style(points: number, label: string): void {
    this.bus.emit({ type: "style", sport: this.meta.id, points, total: points, label });
  }
}
