/**
 * ORBITXCITY sports — 1. Skate park.
 * Ride the plaza, chain flip tricks + grinds. Style converts to paper CITY.
 */
import * as THREE from "three";
import { SportBase, type SportDeps, animateRun } from "../base";
import { box, ramp, rail, zoneDisc, labelSprite } from "../venues";
import type { SportInput } from "../types";
import { equippedSponsor, SPONSOR_STYLE_BONUS } from "./Sponsors";

interface Trick {
  name: string;
  base: number;      // style points
  airTime: number;   // seconds the trick needs to complete
  bailRisk: number;  // 0..1 added bail chance on sketchy landings
}

const TRICKS: Record<string, Trick> = {
  ollie:     { name: "Ollie",        base: 20, airTime: 0.25, bailRisk: 0.02 },
  kickflip:  { name: "Kickflip",      base: 45, airTime: 0.55, bailRisk: 0.10 },
  heelflip:  { name: "Heelflip",      base: 45, airTime: 0.55, bailRisk: 0.10 },
  shuvit:    { name: "Pop Shuvit",    base: 40, airTime: 0.50, bailRisk: 0.08 },
  treflip:   { name: "360 Flip",      base: 80, airTime: 0.80, bailRisk: 0.22 },
  boardslide:{ name: "Boardslide",    base: 60, airTime: 0.90, bailRisk: 0.15 },
  fifty:     { name: "50-50 Grind",   base: 55, airTime: 0.90, bailRisk: 0.12 },
  manual:    { name: "Nose Manual",   base: 30, airTime: 0.70, bailRisk: 0.06 },
};

const TRICK_KEYS = ["ollie", "kickflip", "heelflip", "shuvit"] as const;

interface RailZone { x: number; z: number; len: number; rotY: number }

export class SkatePark extends SportBase {
  meta = {
    id: "skate" as const,
    name: "Skate Park",
    tagline: "Chain tricks. Style pays.",
    icon: "🛹",
    venue: "Neon Plaza Skatepark",
  };

  private pos = new THREE.Vector3();
  private vel = new THREE.Vector3();
  private yaw = 0;
  private airborne = 0;
  private airTime = 0;
  private trick: Trick | null = null;
  private trickT = 0;
  private stylePts = 0;
  private combo = 0;
  private peakCombo = 0;
  private best = 0;
  private bestName = "";
  private rails: RailZone[] = [];
  private grinding = 0;
  private board: THREE.Group | null = null;
  private runT = 0;

  buildVenue(): THREE.Object3D[] {
    const c = this.venues.skatePlaza;
    const g: THREE.Object3D[] = [];
    const slab = box(46, 0.4, 40, 0x232b3a, c.x, -0.2, c.z);
    slab.receiveShadow = true;
    g.push(slab);

    // quarter pipes on two sides
    const qp1 = ramp(10, 3, 6, 0x2f3a4e); qp1.position.set(c.x - 17, 0, c.z - 10); qp1.rotation.y = Math.PI / 2; g.push(qp1);
    const qp2 = ramp(10, 3, 6, 0x2f3a4e); qp2.position.set(c.x + 17, 0, c.z + 10); qp2.rotation.y = -Math.PI / 2; g.push(qp2);
    const qp3 = ramp(8, 2.2, 5, 0x37455e); qp3.position.set(c.x, 0, c.z - 16); g.push(qp3);

    // funbox
    g.push(box(6, 1.2, 4, 0x3b4a63, c.x - 6, 0.6, c.z + 6));

    // rails
    const railDefs: RailZone[] = [
      { x: c.x + 4, z: c.z - 4, len: 8, rotY: 0 },
      { x: c.x - 8, z: c.z + 2, len: 6, rotY: Math.PI / 2 },
    ];
    this.rails = railDefs;
    for (const r of railDefs) {
      const rg = rail(r.len);
      rg.position.set(r.x, 0, r.z);
      rg.rotation.y = r.rotY;
      g.push(rg);
    }

    // bowl ring
    const bowl = new THREE.Mesh(new THREE.TorusGeometry(6, 1.1, 10, 32), new THREE.MeshStandardMaterial({ color: 0x2f3a4e, roughness: 0.8 }));
    bowl.rotation.x = Math.PI / 2;
    bowl.position.set(c.x + 12, 0.4, c.z + 8);
    g.push(bowl);

    const disc = zoneDisc(23, 0x22d3ee);
    disc.position.set(c.x, 0.02, c.z);
    g.push(disc);

    const label = labelSprite("NEON PLAZA SKATEPARK", { size: 12 });
    label.position.set(c.x, 9, c.z - 20);
    g.push(label);
    return g;
  }

  start(): void {
    const c = this.venues.skatePlaza;
    this._active = true;
    this.pos.set(c.x, 0, c.z + 14);
    this.vel.set(0, 0, 0);
    this.yaw = Math.PI;
    this.stylePts = 0; this.combo = 0; this.peakCombo = 0; this.best = 0; this.bestName = "";
    this.trick = null; this.airborne = 0; this.grinding = 0;
    this.spawnAthlete(this.pos, 0x22d3ee);
    // skateboard under feet
    this.board = new THREE.Group();
    const deck = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.06, 0.24), new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.6 }));
    deck.castShadow = true;
    this.board.add(deck);
    this.ctx?.scene.add(this.board);
    this.snapCam(
      new THREE.Vector3(this.pos.x, 4, this.pos.z + 8),
      new THREE.Vector3(this.pos.x, 1, this.pos.z)
    );
    this.toast("Space = ollie · 1-4 = flip tricks · ride a rail to grind");
  }

  stop(): void {
    if (!this._active) return;
    this._active = false;
    if (this.board) { this.ctx?.scene.remove(this.board); this.board = null; }
    this.despawnAthlete();
    // sponsor handshake: session totals + combo milestones ride the style bus
    this.bus.emit({ type: "style", sport: "skate", points: this.stylePts, total: this.stylePts, label: "__session__" });
    if (this.peakCombo >= 5) this.bus.emit({ type: "style", sport: "skate", points: 5, total: 5, label: "__combo5__" });
    if (this.peakCombo >= 8) this.bus.emit({ type: "style", sport: "skate", points: 8, total: 8, label: "__combo8__" });
    const { paper } = this.ledger.cashStyle(this.stylePts, "skate session");
    this.ctx?.notify?.(`Skate session: ${this.stylePts} style → +${paper} paper CITY`);
  }

  update(dt: number, input: SportInput): void {
    this.elapsed += dt;
    this.runT += dt;

    // --- steering ---
    const accel = this.airborne > 0 ? 2 : 14;
    const maxSpeed = 11;
    if (input.up) this.vel.add(new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)).multiplyScalar(accel * dt));
    if (input.down) this.vel.multiplyScalar(1 - 2.2 * dt);
    if (input.left) this.yaw += 2.4 * dt;
    if (input.right) this.yaw -= 2.4 * dt;
    const speed = this.vel.length();
    if (speed > maxSpeed) this.vel.multiplyScalar(maxSpeed / speed);
    if (!input.up && this.airborne <= 0) this.vel.multiplyScalar(1 - 0.7 * dt);

    // --- ollie ---
    if (input.pressed1 && this.airborne <= 0 && this.grinding <= 0) {
      this.airborne = 0.55 + Math.min(0.35, speed * 0.02);
      this.airTime = 0;
      this.doTrick(TRICKS.ollie);
    }

    // --- flip tricks in air ---
    if (this.airborne > 0) {
      this.airTime += dt;
      this.airborne -= dt;
      if (input.pressed2 && !this.trick) this.doTrick(TRICKS.kickflip);
      if (input.pressed3 && !this.trick) this.doTrick(TRICKS.heelflip);
      if (input.pressed4 && !this.trick) this.doTrick(Math.random() < 0.5 ? TRICKS.shuvit : TRICKS.treflip);
      if (this.trick) {
        this.trickT += dt;
        if (this.athlete) this.athlete.rotation.y += dt * 9; // board spin visual
      }
      if (this.airborne <= 0) this.land();
    }

    // --- grinding ---
    if (this.grinding <= 0 && this.airborne <= 0 && speed > 4) {
      for (const r of this.rails) {
        const dx = this.pos.x - r.x, dz = this.pos.z - r.z;
        if (Math.hypot(dx, dz) < r.len / 2 + 0.6) {
          this.grinding = 1.4;
          this.doTrick(Math.random() < 0.5 ? TRICKS.boardslide : TRICKS.fifty);
          break;
        }
      }
    }
    if (this.grinding > 0) {
      this.grinding -= dt;
      if (this.athlete) this.athlete.position.y = 1.35;
      if (this.grinding <= 0) this.land();
    }

    // --- integrate ---
    this.pos.addScaledVector(this.vel, dt);
    // keep inside plaza
    const c = this.venues.skatePlaza;
    const dx = this.pos.x - c.x, dz = this.pos.z - c.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 21) {
      this.pos.x = c.x + (dx / dist) * 21;
      this.pos.z = c.z + (dz / dist) * 21;
      this.vel.multiplyScalar(0.4);
    }

    // --- avatar ---
    if (this.athlete) {
      const hopY = this.airborne > 0 ? Math.sin(Math.min(1, this.airTime / 0.9) * Math.PI) * 1.6 : 0;
      this.athlete.position.set(this.pos.x, hopY, this.pos.z);
      this.athlete.rotation.y = this.yaw;
      if (this.grinding <= 0 && this.airborne <= 0) this.athlete.rotation.y = this.yaw;
      animateRun(this.athlete, this.runT, Math.min(1, speed / 6));
    }
    if (this.board) {
      const hopY = this.airborne > 0 ? Math.sin(Math.min(1, this.airTime / 0.9) * Math.PI) * 1.6 : 0;
      this.board.position.set(this.pos.x, 0.12 + hopY, this.pos.z);
      this.board.rotation.y = this.yaw + (this.trick ? this.trickT * 9 : 0);
    }

    this.chase(this.pos, 7, 3.4);

    this.bus.emit({
      type: "tick", sport: "skate",
      state: {
        style: this.stylePts, combo: this.combo, best: this.best, bestName: this.bestName,
        speed: Math.round(speed * 3.6), airborne: this.airborne > 0, grinding: this.grinding > 0,
        trick: this.trick?.name ?? null,
      },
    });
  }

  private doTrick(t: Trick): void {
    this.trick = t;
    this.trickT = 0;
    // sponsor deck bonus: +10% style while repping a brand
    const pts = equippedSponsor() ? Math.round(t.base * SPONSOR_STYLE_BONUS) : t.base;
    this.stylePts += pts;
    this.style(pts, t.name);
  }

  private land(): void {
    const sketchy = this.trick !== null && this.trickT < this.trick.airTime;
    const risk = (this.trick?.bailRisk ?? 0) + (sketchy ? 0.35 : 0);
    if (this.athlete) this.athlete.rotation.y = this.yaw;
    if (Math.random() < risk) {
      // bail!
      this.combo = 0;
      this.toast(`💥 Bailed the ${this.trick?.name ?? "landing"}! Combo lost.`);
      this.vel.multiplyScalar(0.15);
      this.trick = null;
      return;
    }
    if (this.trick) {
      this.combo += 1;
      this.peakCombo = Math.max(this.peakCombo, this.combo);
      const mult = 1 + (this.combo - 1) * 0.5;
      const pts = Math.round(this.trick.base * mult);
      const gained = pts - this.trick.base; // base already counted in style()
      if (gained > 0) {
        this.stylePts += gained;
        this.style(gained, `${this.trick.name} x${this.combo} combo`);
      }
      if (pts > this.best) { this.best = pts; this.bestName = this.trick.name; }
      this.toast(`${this.trick.name} landed +${pts}${this.combo > 1 ? ` (x${this.combo} combo!)` : ""}`);
    }
    this.trick = null;
    if (this.athlete) this.athlete.position.y = 0;
  }
}

export { TRICK_KEYS };
