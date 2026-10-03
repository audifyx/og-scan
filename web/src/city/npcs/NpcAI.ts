import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { spendCityPoints } from "../cityState";
import { buildRig } from "../CityRig";
import type { StyleId } from "../cityState";

const WORKER_STYLE: Record<string, StyleId> = {
  shop: "degen",
  ramen: "fox",
  arcade: "bomber",
  deli: "suit",
};


/**
 * OrbitX City — NPC AI (cops, civilians, store workers).
 *
 * Standalone system: the world constructs it once and ticks it every frame.
 * It was built to hook into CityWorld WITHOUT editing CityWorld.ts mid-lane —
 * the integration is two lines (see HOOK below). No per-frame allocations in
 * the hot loop; every procedural figure stays under 400 tris (phone-safe).
 *
 *   ── HOOK (for the CityWorld lane — 2 lines) ──────────────────────
 *   import { NpcSystem } from "./npcs/NpcAI";
 *   // in buildBlock (after scene exists):
 *   this.npcSys = new NpcSystem({ scene: this.scene });
 *   this.npcSys.addDefaultStoreWorkers(); // optional: workers in the 4 walkable stores
 *   // in update(dt):
 *   this.npcSys.update(dt, {
 *     time: this.time,
 *     playerPos: this.pPos,
 *     sprinting: this.input.sprint && (Math.abs(this.input.moveX) + Math.abs(this.input.moveY)) > 0.1,
 *     scanPulseActive: this.time < this.scanUntil,
 *     onToast: (t) => { this.poiToast = t; this.poiToastUntil = this.time + 2.5; },
 *   });
 *   ─────────────────────────────────────────────────────────────────
 *
 * NPC models (built by the GLB lane) load from /city/npcs/*.glb when present;
 * every type has a cheap procedural fallback so the world is fully populated
 * before the assets land.
 *
 * NOTE: modules/police (PursuitDirector) handles heist pursuits. The cops here
 * are playful district patrol + speeding-ticket enforcement — complementary,
 * never blocking progress.
 */

// ── host surface ────────────────────────────────────────────────────

/** Minimal surface the world provides (CityWorld's public getters satisfy this). */
export interface NpcWorldHost {
  scene: THREE.Scene;
}

export interface NpcUpdateCtx {
  /** world time (seconds) */
  time: number;
  /** player position — read-only, never mutated */
  playerPos: THREE.Vector3;
  /** true while the player is actively sprinting */
  sprinting: boolean;
  /** true while a scan pulse is expanding (civilians wave) */
  scanPulseActive: boolean;
  /** show a transient HUD toast */
  onToast: (msg: string) => void;
}

/** Convenience: mount against a CityWorld instance via its public getters. */
export function mountNpcs(world: { sceneRef: THREE.Scene }): NpcSystem {
  return new NpcSystem({ scene: world.sceneRef });
}

// ── GLB manifest (sibling GLB lane drops these into web/public/city/npcs/) ──

const NPC_GLB: Record<string, string> = {
  cop: "/city/npcs/cop.glb",
  copcar: "/city/npcs/copcar.glb",
  civilian1: "/city/npcs/civilian1.glb",
  civilian2: "/city/npcs/civilian2.glb",
  civilian3: "/city/npcs/civilian3.glb",
  worker: "/city/npcs/worker.glb",
};

const glbLoader = new GLTFLoader();
const glbCache = new Map<string, Promise<THREE.Group | null>>();

function loadNpcGlb(key: string): Promise<THREE.Group | null> {
  const url = NPC_GLB[key];
  let p = glbCache.get(url);
  if (!p) {
    // race the fetch against a short timeout so a missing/slow asset never
    // stalls NPC population — the procedural fallback appears instead.
    const load = glbLoader.loadAsync(url).then((g) => {
      const root = g.scene;
      root.traverse((o) => { o.userData.oxcGlb = true; }); // world dispose() skips these
      return root as THREE.Group;
    }).catch(() => null);
    const timeout = new Promise<null>((res) => setTimeout(() => res(null), 1500));
    p = Promise.race([load, timeout]);
    glbCache.set(url, p);
  }
  return p;
}

// ── procedural fallbacks (<400 tris each) ───────────────────────────

interface Figure {
  group: THREE.Group;
  /** right-arm shoulder pivot (wave animation); null on GLB figures */
  armR: THREE.Object3D | null;
  disposables: { dispose(): void }[];
}

function figMat(color: number, rough = 0.85): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: rough });
}

/**
 * Cheap low-poly figure: capsule body + sphere head + pivoted arms.
 * Tri estimate: body ~96 + head ~160 + 2 arms ~96 + extras ~32 ≈ 384.
 */
function makeFigure(shirt: number, skin = 0xc9a684, opts: { cap?: number; vest?: boolean } = {}): Figure {
  const disposables: { dispose(): void }[] = [];
  const track = <T extends THREE.BufferGeometry | THREE.Material>(d: T): T => { disposables.push(d); return d; };
  const g = new THREE.Group();
  const bodyG = track(new THREE.CapsuleGeometry(0.26, 0.7, 3, 8));
  const body = new THREE.Mesh(bodyG, track(figMat(shirt)));
  body.position.y = 0.95;
  g.add(body);
  if (opts.vest) {
    const vestG = track(new THREE.CapsuleGeometry(0.29, 0.34, 3, 8));
    const vest = new THREE.Mesh(vestG, track(figMat(0xd8b93a)));
    vest.position.y = 1.12;
    g.add(vest);
  }
  const headG = track(new THREE.SphereGeometry(0.2, 10, 8));
  const head = new THREE.Mesh(headG, track(figMat(skin)));
  head.position.y = 1.68;
  g.add(head);
  if (opts.cap !== undefined) {
    const capG = track(new THREE.CylinderGeometry(0.16, 0.19, 0.09, 8));
    const cap = new THREE.Mesh(capG, track(figMat(opts.cap)));
    cap.position.y = 1.86;
    g.add(cap);
  }
  const mkArm = (side: 1 | -1): THREE.Group => {
    const pivot = new THREE.Group();
    pivot.position.set(0.32 * side, 1.32, 0);
    const armG = track(new THREE.CapsuleGeometry(0.06, 0.42, 2, 6));
    const arm = new THREE.Mesh(armG, track(figMat(shirt)));
    arm.position.y = -0.24;
    pivot.add(arm);
    g.add(pivot);
    return pivot;
  };
  mkArm(-1);
  const armR = mkArm(1);
  return { group: g, armR, disposables };
}

/**
 * Parked cop car: box body + cabin + 4 wheels + red/blue light bar.
 * Tri estimate: ~180. Light bar meshes are named lightbar_r / lightbar_b so
 * GLB cars (same naming) share the flashing logic.
 */
function makeCopCar(): { group: THREE.Group; lightR: THREE.MeshStandardMaterial; lightB: THREE.MeshStandardMaterial } {
  const disposables: { dispose(): void }[] = [];
  const track = <T extends THREE.BufferGeometry | THREE.Material>(d: T): T => { disposables.push(d); return d; };
  const g = new THREE.Group();
  const paint = track(figMat(0x1c2f6b));
  const dark = track(figMat(0x101418));
  const glass = track(new THREE.MeshStandardMaterial({ color: 0x9fd8ff, roughness: 0.25, metalness: 0.4 }));
  const add = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, name = ""): THREE.Mesh => {
    const mesh = new THREE.Mesh(track(geo), m);
    mesh.position.set(x, y, z);
    if (name) mesh.name = name;
    g.add(mesh);
    return mesh;
  };
  add(new THREE.BoxGeometry(2.0, 0.55, 4.2), paint, 0, 0.62, 0);                 // body
  add(new THREE.BoxGeometry(1.7, 0.5, 2.1), glass, 0, 1.1, -0.2);               // cabin
  add(new THREE.BoxGeometry(2.02, 0.18, 1.1), track(figMat(0xe8e8e8)), 0, 0.62, 0.6); // white door band
  const wheelG = track(new THREE.CylinderGeometry(0.34, 0.34, 0.28, 8));
  for (const [wx, wz] of [[-0.95, 1.35], [0.95, 1.35], [-0.95, -1.35], [0.95, -1.35]] as const) {
    const w = add(wheelG, dark, wx, 0.34, wz);
    w.rotation.z = Math.PI / 2;
  }
  const mkLight = (color: number, x: number, name: string): THREE.MeshStandardMaterial => {
    const m = track(new THREE.MeshStandardMaterial({ color: 0x222222, emissive: color, emissiveIntensity: 0.2, roughness: 0.4 }));
    add(new THREE.BoxGeometry(0.34, 0.16, 0.3), m, x, 1.44, -0.2, name);
    return m;
  };
  const lightR = mkLight(0xff2a2a, -0.22, "lightbar_r");
  const lightB = mkLight(0x2a6aff, 0.22, "lightbar_b");
  return { group: g, lightR, lightB };
}

/** Floating name tag sprite for workers (cheap canvas texture). */
function makeNameTag(text: string): THREE.Sprite {
  const c = document.createElement("canvas");
  c.width = 256; c.height = 48;
  const ctx = c.getContext("2d")!;
  ctx.font = "bold 26px system-ui, sans-serif";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.shadowColor = "#17e6d4"; ctx.shadowBlur = 10;
  ctx.fillStyle = "#eaffff";
  ctx.fillText(text.toUpperCase().slice(0, 18), 128, 24);
  const tex = new THREE.CanvasTexture(c);
  const sm = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  const sp = new THREE.Sprite(sm);
  sp.scale.set(2.4, 0.45, 1);
  (sp as unknown as { __disp: unknown[] }).__disp = [tex, sm];
  return sp;
}

// ── NPC records ─────────────────────────────────────────────────────

type CopMode = "patrol" | "chase";

interface Cop {
  fig: Figure;
  waypoints: [number, number][];
  wp: number;
  waitT: number;
  mode: CopMode;
  speed: number;
}

interface Civilian {
  fig: Figure;
  waypoints: [number, number][];
  wp: number;
  speed: number;
  phase: number;
  waveT: number;
}

interface Worker {
  fig: Figure;
  storeKey: string;
  name: string;
  x: number; z: number; rotY: number;
  phase: number;
  tag: THREE.Sprite;
}

interface CopCar {
  group: THREE.Group;
  lightR: THREE.MeshStandardMaterial | null;
  lightB: THREE.MeshStandardMaterial | null;
  disposables: { dispose(): void }[];
}

// tuning
const COP_PATROL_SPEED = 1.7;
const COP_CHASE_SPEED = 8.5;      // slightly less than player sprint (9.5)
const SPRINT_TICKET_AFTER = 10;   // seconds of continuous sprinting
const TICKET_FINE = 10;           // CITY points
const TICKET_COOLDOWN = 30;       // seconds between tickets
const CHASE_GIVE_UP = 20;         // seconds before the cop gives up
const CATCH_DIST = 1.4;
const WAVE_RADIUS = 25;           // same radius as POI scan reveal
const TALK_DIST = 2.4;

export class NpcSystem {
  private scene: THREE.Scene;
  private cops: Cop[] = [];
  private civilians: Civilian[] = [];
  private workers: Worker[] = [];
  private cars: CopCar[] = [];
  private ready = false;
  private disposed = false;

  // sprint-watch / chase state (reused temps — no per-frame allocation)
  private sprintTime = 0;
  private ticketCooldown = 0;
  private chaser: Cop | null = null;
  private chaseTime = 0;

  /** Called when the player talks to a worker → the UI lane opens that store's order menu. */
  onTalkToWorker: ((storeKey: string) => void) | null = null;

  constructor(host: NpcWorldHost) {
    this.scene = host.scene;
    void this.init();
  }

  // ── build ───────────────────────────────────────────────────────

  private async init(): Promise<void> {
    if (this.disposed) return;
    // cops (3) — patrol loops on clear street segments
    const copGlbs = await Promise.all([loadNpcGlb("cop"), loadNpcGlb("cop"), loadNpcGlb("cop")]);
    const copLoops: [number, number][][] = [
      [[-6, 16], [4, 16], [4, 20], [-6, 20]],       // OrbitX Tower plaza
      [[-18, -10], [-6, -10], [-6, -4], [-18, -4]], // shop street
      [[8, -10], [16, -10], [16, -2], [8, -2]],     // east street
    ];
    copLoops.forEach((loop, i) => {
      const glb = copGlbs[i];
      const fig = glb ? { group: glb, armR: null, disposables: [] as { dispose(): void }[] } : makeFigure(0x1c2f6b, 0xc9a684, { cap: 0x101418 });
      const [sx, sz] = loop[0];
      fig.group.position.set(sx, 0, sz);
      this.scene.add(fig.group);
      this.cops.push({ fig, waypoints: loop, wp: 1, waitT: 0, mode: "patrol", speed: COP_PATROL_SPEED });
    });

    // parked cop cars (2) with flashing light bars
    const carSpots: { x: number; z: number; rotY: number }[] = [
      { x: 8, z: 12, rotY: 0.4 },
      { x: -19, z: -6, rotY: -0.5 },
    ];
    const carGlb = await loadNpcGlb("copcar");
    for (const s of carSpots) {
      if (carGlb) {
        const g = carGlb.clone();
        g.position.set(s.x, 0, s.z);
        g.rotation.y = s.rotY;
        this.scene.add(g);
        const mats: Record<string, THREE.MeshStandardMaterial> = {};
        g.traverse((o) => {
          const m = o as THREE.Mesh;
          if ((m.name === "lightbar_r" || m.name === "lightbar_b") && m.isMesh) {
            const mm = (m.material as THREE.MeshStandardMaterial).clone();
            mm.emissive = new THREE.Color(m.name === "lightbar_r" ? 0xff2a2a : 0x2a6aff);
            m.material = mm;
            mats[m.name] = mm;
          }
        });
        this.cars.push({ group: g, lightR: mats["lightbar_r"] ?? null, lightB: mats["lightbar_b"] ?? null, disposables: [] });
      } else {
        const car = makeCopCar();
        car.group.position.set(s.x, 0, s.z);
        car.group.rotation.y = s.rotY;
        this.scene.add(car.group);
        this.cars.push({ group: car.group, lightR: car.lightR, lightB: car.lightB, disposables: [] });
      }
    }

    // civilians (9) — waypoint loops + idle spots
    const civDefs: { spots: [number, number][]; shirt: number }[] = [
      { spots: [[-10, -11]], shirt: 0x2a4a6b },
      { spots: [[-13, 11]], shirt: 0x6b2a4a },
      { spots: [[4, -8], [14, -8]], shirt: 0x3a6b2a },
      { spots: [[-8, 19], [2, 19]], shirt: 0x6b5a2a },
      { spots: [[17, -10]], shirt: 0x4a2a6b },
      { spots: [[-4, 24]], shirt: 0x2a6b5a },
      { spots: [[-4, -20], [8, -20]], shirt: 0x7a3a2a },
      { spots: [[22, 10]], shirt: 0x3a3a6b },
      { spots: [[-20, 22], [-11, 22]], shirt: 0x5a6b2a },
    ];
    const civGlbs = await Promise.all([
      loadNpcGlb("civilian1"), loadNpcGlb("civilian2"), loadNpcGlb("civilian3"),
      loadNpcGlb("civilian1"), loadNpcGlb("civilian2"), loadNpcGlb("civilian3"),
      loadNpcGlb("civilian1"), loadNpcGlb("civilian2"), loadNpcGlb("civilian3"),
    ]);
    civDefs.forEach((d, i) => {
      const glb = civGlbs[i];
      const fig = glb ? { group: glb, armR: null, disposables: [] as { dispose(): void }[] } : makeFigure(d.shirt);
      const [sx, sz] = d.spots[0];
      fig.group.position.set(sx, 0, sz);
      this.scene.add(fig.group);
      this.civilians.push({
        fig, waypoints: d.spots, wp: d.spots.length > 1 ? 1 : 0,
        speed: 1.1 + (i % 3) * 0.25, phase: i * 1.7, waveT: 0,
      });
    });

    this.ready = true;
  }

  /**
   * Register 1–2 workers per store interior. Called by the district code with
   * exact counter positions; also see addDefaultStoreWorkers() for the four
   * walkable stores in the base block.
   */
  addWorkers(storeKey: string, spots: { x: number; z: number; rotY?: number; name?: string }[]): void {
    void (async () => {
      const glb = await loadNpcGlb("worker");
      for (const s of spots) {
        const style = WORKER_STYLE[storeKey] ?? "degen";
        const fig: Figure = glb
          ? { group: glb.clone(), armR: null, disposables: [] }
          : (() => {
              const rig = buildRig(style);
              rig.group.scale.setScalar(0.96);
              return { group: rig.group, armR: null, disposables: [{ dispose: () => rig.dispose() }] };
            })();
        fig.group.position.set(s.x, 0, s.z);
        fig.group.rotation.y = s.rotY ?? 0;
        this.scene.add(fig.group);
        const tag = makeNameTag(s.name ?? "clerk");
        tag.position.set(s.x, 2.35, s.z);
        this.scene.add(tag);
        this.workers.push({ fig, storeKey, name: s.name ?? "clerk", x: s.x, z: s.z, rotY: s.rotY ?? 0, phase: Math.random() * 6, tag });
      }
    })();
  }

  /** Best-effort workers for the four walkable interiors in the base block. */
  addDefaultStoreWorkers(): void {
    this.addWorkers("shop", [{ x: -14.5, z: -14.5, rotY: Math.PI, name: "Shopkeeper" }]);
    this.addWorkers("ramen", [{ x: 25, z: -19.5, rotY: Math.PI, name: "Ramen Chef" }]);
    this.addWorkers("arcade", [{ x: -26, z: 2.5, rotY: Math.PI, name: "Arcade Attendant" }]);
    this.addWorkers("deli", [{ x: -25, z: -14, rotY: Math.PI, name: "Deli Clerk" }]);
  }

  /** Nearest worker within TALK range of the player, if any. */
  getNearbyTalkTarget(px: number, pz: number): { storeKey: string; name: string } | null {
    for (const w of this.workers) {
      const dx = w.x - px, dz = w.z - pz;
      if (dx * dx + dz * dz < TALK_DIST * TALK_DIST) return { storeKey: w.storeKey, name: w.name };
    }
    return null;
  }

  // ── update ──────────────────────────────────────────────────────

  update(dt: number, ctx: NpcUpdateCtx): void {
    if (!this.ready || this.disposed || dt <= 0) return;
    const t = ctx.time;
    this.updateLightbars(t);
    this.updateCops(dt, t);
    this.updateCivilians(dt, ctx, t);
    this.updateWorkers(dt, t);
    this.updateSprintWatch(dt, ctx);
  }

  private updateLightbars(t: number): void {
    // alternate red/blue — cheap emissive swap, no allocation
    const phase = Math.sin(t * 9) > 0;
    for (const c of this.cars) {
      if (c.lightR) c.lightR.emissiveIntensity = phase ? 3.2 : 0.15;
      if (c.lightB) c.lightB.emissiveIntensity = phase ? 0.15 : 3.2;
    }
  }

  private updateCops(dt: number, t: number): void {
    for (const cop of this.cops) {
      const g = cop.fig.group;
      if (cop.mode === "chase") {
        g.position.y = Math.abs(Math.sin(t * 14)) * 0.07; // run bob (steering in updateSprintWatch)
        continue;
      }
      if (cop.waitT > 0) {
        cop.waitT -= dt;
        g.position.y = Math.abs(Math.sin(t * 2)) * 0.03;
        g.rotation.y += Math.sin(t * 0.8) * dt * 0.6; // look around
        continue;
      }
      const [tx, tz] = cop.waypoints[cop.wp];
      const dx = tx - g.position.x, dz = tz - g.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.4) {
        cop.wp = (cop.wp + 1) % cop.waypoints.length;
        cop.waitT = 1.5;
        continue;
      }
      const step = Math.min(dist, cop.speed * dt);
      g.position.x += (dx / dist) * step;
      g.position.z += (dz / dist) * step;
      g.position.y = Math.abs(Math.sin(t * 8)) * 0.05;
      g.rotation.y = Math.atan2(dx, dz);
    }
  }

  private updateCivilians(dt: number, ctx: NpcUpdateCtx, t: number): void {
    const px = ctx.playerPos.x, pz = ctx.playerPos.z;
    const scanning = ctx.scanPulseActive;
    for (const c of this.civilians) {
      const g = c.fig.group;
      c.phase += dt * 2;
      if (c.waypoints.length > 1) {
        const [tx, tz] = c.waypoints[c.wp];
        const dx = tx - g.position.x, dz = tz - g.position.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 0.35) {
          c.wp = (c.wp + 1) % c.waypoints.length;
        } else {
          const step = Math.min(dist, c.speed * dt);
          g.position.x += (dx / dist) * step;
          g.position.z += (dz / dist) * step;
          g.position.y = Math.abs(Math.sin(c.phase * 2)) * 0.05;
          g.rotation.y = Math.atan2(dx, dz);
        }
      } else {
        g.position.y = Math.abs(Math.sin(c.phase)) * 0.04; // idle bob
      }
      // wave when the scan pulse hits them (same 25m radius as POI reveal)
      if (scanning) {
        const dx = g.position.x - px, dz = g.position.z - pz;
        if (dx * dx + dz * dz < WAVE_RADIUS * WAVE_RADIUS) c.waveT = 6;
      }
      if (c.waveT > 0) {
        c.waveT -= dt;
        if (c.fig.armR) {
          c.fig.armR.rotation.z = -2.4 + Math.sin(t * 10) * 0.35; // raised wave
        } else {
          g.rotation.y += Math.sin(t * 12) * dt * 3; // GLB figures: happy wiggle
        }
      } else if (c.fig.armR) {
        c.fig.armR.rotation.z *= 0.9; // ease arm back down (no snap)
      }
    }
  }

  private updateWorkers(dt: number, t: number): void {
    for (const w of this.workers) {
      w.phase += dt * 1.6;
      w.fig.group.position.y = Math.abs(Math.sin(w.phase)) * 0.03;
      w.fig.group.rotation.y = w.rotY + Math.sin(w.phase * 0.5) * 0.25;
      w.tag.position.y = 2.35 + Math.sin(w.phase * 0.8) * 0.05;
    }
    void t;
  }

  /** Playful enforcement: sprint >10s straight and the nearest cop chases. */
  private updateSprintWatch(dt: number, ctx: NpcUpdateCtx): void {
    this.ticketCooldown = Math.max(0, this.ticketCooldown - dt);
    if (ctx.sprinting && !this.chaser) {
      this.sprintTime += dt;
    } else if (!this.chaser) {
      this.sprintTime = Math.max(0, this.sprintTime - dt * 2);
    }
    if (!this.chaser && this.sprintTime > SPRINT_TICKET_AFTER && this.ticketCooldown <= 0 && this.cops.length > 0) {
      let best: Cop | null = null, bestD = Infinity;
      for (const cop of this.cops) {
        const dx = cop.fig.group.position.x - ctx.playerPos.x;
        const dz = cop.fig.group.position.z - ctx.playerPos.z;
        const d = dx * dx + dz * dz;
        if (d < bestD) { bestD = d; best = cop; }
      }
      if (best) {
        best.mode = "chase";
        this.chaser = best;
        this.chaseTime = 0;
        ctx.onToast("🚨 COP: slow down, speeder!");
      }
    }
    const chaser = this.chaser;
    if (chaser) {
      const g = chaser.fig.group;
      const dx = ctx.playerPos.x - g.position.x;
      const dz = ctx.playerPos.z - g.position.z;
      const dist = Math.hypot(dx, dz);
      this.chaseTime += dt;
      if (dist < CATCH_DIST) {
        // caught — ticket, never a progress block
        const total = spendCityPoints(TICKET_FINE);
        ctx.onToast(`🎫 Speeding ticket — −${TICKET_FINE} CITY (${total} left)`);
        this.endChase();
      } else if (this.chaseTime > CHASE_GIVE_UP || dist > 40) {
        ctx.onToast("💨 You outran the cop… this time.");
        this.endChase();
      } else if (dist > 0.001) {
        // slightly slower than sprint — catchable only if the player slows down
        const step = Math.min(dist, COP_CHASE_SPEED * dt);
        g.position.x += (dx / dist) * step;
        g.position.z += (dz / dist) * step;
        g.rotation.y = Math.atan2(dx, dz);
      }
    }
  }

  private endChase(): void {
    if (this.chaser) this.chaser.mode = "patrol";
    this.chaser = null;
    this.sprintTime = 0;
    this.ticketCooldown = TICKET_COOLDOWN;
  }

  dispose(): void {
    this.disposed = true;
    const drop = (o: THREE.Object3D, disposables: { dispose(): void }[]) => {
      o.parent?.remove(o);
      for (const d of disposables) { try { d.dispose(); } catch { /* noop */ } }
    };
    for (const c of this.cops) drop(c.fig.group, c.fig.disposables);
    for (const c of this.civilians) drop(c.fig.group, c.fig.disposables);
    for (const w of this.workers) {
      drop(w.fig.group, w.fig.disposables);
      const disp = (w.tag as unknown as { __disp?: { dispose(): void }[] }).__disp;
      w.tag.parent?.remove(w.tag);
      disp?.forEach((d) => { try { d.dispose(); } catch { /* noop */ } });
    }
    for (const c of this.cars) {
      c.group.parent?.remove(c.group);
      for (const d of c.disposables) { try { d.dispose(); } catch { /* noop */ } }
    }
    this.cops = []; this.civilians = []; this.workers = []; this.cars = [];
  }
}
