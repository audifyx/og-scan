/**
 * ORBITXCITY sports — 10. Fishing at the pier.
 * Cast from the pier, wait for the bite, fight the fish —
 * keep line tension in the green. Rare catches sell for paper CITY,
 * deeper casts roll better odds. The Golden Koi is out there.
 */
import * as THREE from "three";
import { SportBase } from "../base";
import { box, zoneDisc, labelSprite } from "../venues";
import type { SportInput } from "../types";

type FPhase = "idle" | "cast" | "wait" | "bite" | "fight" | "catch";

type Rarity = "junk" | "common" | "uncommon" | "rare" | "epic" | "legendary";

interface FishDef {
  name: string;
  rarity: Rarity;
  paper: number;
  icon: string;
}

const FISH: Record<Rarity, { names: string[]; paper: number; icon: string }> = {
  junk:      { names: ["Old Boot", "Tin Can", "Seaweed Clump"], paper: 0,   icon: "🥾" },
  common:    { names: ["Pier Perch", "Harbor Guppy", "Dock Sardine"], paper: 5,   icon: "🐟" },
  uncommon:  { names: ["Neonfin", "Cobalt Snapper"], paper: 15,  icon: "🐠" },
  rare:      { names: ["Chrome Mackerel", "Lantern Eel"], paper: 45,  icon: "✨" },
  epic:      { names: ["Storm Marlin"], paper: 120, icon: "🌪️" },
  legendary: { names: ["Golden Koi"], paper: 400, icon: "🌟" },
};

const RARITY_COLOR: Record<Rarity, string> = {
  junk: "#9aa3b2", common: "#e2e8f0", uncommon: "#4ade80",
  rare: "#60a5fa", epic: "#c084fc", legendary: "#fbbf24",
};

const TROPHY_KEY = "orbitxcity:sports:fishing:trophies:v1";

interface Shadow { mesh: THREE.Mesh; x: number; z: number; vx: number; vz: number }

export class Fishing extends SportBase {
  meta = {
    id: "fishing" as const,
    name: "Pier Fishing",
    tagline: "Cast deep. Fight hard. Sell the rare ones.",
    icon: "🎣",
    venue: "Neon Break Pier",
  };

  private phase: FPhase = "idle";
  private charge = 0;
  private chargeDir = 1;
  private bobber = new THREE.Vector3();
  private bobberMesh: THREE.Mesh | null = null;
  private line: THREE.Line | null = null;
  private ripple: THREE.Mesh | null = null;
  private waitT = 0;
  private biteWindow = 0;
  private biteCooldown = 0;
  private fight = { dist: 0, startDist: 0, tension: 0, running: false, runT: 0, nextRun: 0 };
  private catchFish: FishDef | null = null;
  private castDist = 0;
  private shadows: Shadow[] = [];
  private water: THREE.Mesh | null = null;
  private fishT = 0;
  private trophies: Record<Rarity, string> = this.loadTrophies();
  private catches = 0;
  private earned = 0;

  // ---------------------------------------------------------------- venue

  buildVenue(): THREE.Object3D[] {
    const c = this.venues.pier;
    const g: THREE.Object3D[] = [];

    // pier deck: planks running -x into the water (water toward -x)
    const deckLen = 46;
    const deckCx = c.x - deckLen / 2 + 4;
    for (let i = 0; i < 16; i++) {
      const px = c.x + 4 - i * 2.8;
      g.push(box(2.6, 0.35, 7, i % 2 === 0 ? 0x8a6a45 : 0x7d5f3d, px, -0.18, c.z));
    }
    // pilings
    for (let i = 0; i < 6; i++) {
      const px = c.x + 2 - i * 8;
      for (const pz of [c.z - 3.2, c.z + 3.2]) {
        const pile = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 5, 10), new THREE.MeshStandardMaterial({ color: 0x5b4630, roughness: 1 }));
        pile.position.set(px, -2.2, pz);
        g.push(pile);
      }
    }
    // railing along both edges
    for (const side of [-3.4, 3.4]) {
      const railBar = box(deckLen, 0.12, 0.12, 0x6b5138, deckCx, 1.05, c.z + side);
      g.push(railBar);
      for (let i = 0; i < 10; i++) {
        g.push(box(0.12, 1.05, 0.12, 0x6b5138, c.x + 4 - i * 4.6, 0.52, c.z + side));
      }
    }
    // lantern at the pier end
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 3.4, 8), new THREE.MeshStandardMaterial({ color: 0x2b3442 }));
    post.position.set(c.x - deckLen + 6, 1.7, c.z - 2.8);
    g.push(post);
    const lampMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.35, 12, 10),
      new THREE.MeshBasicMaterial({ color: 0xfde68a })
    );
    lampMesh.position.set(c.x - deckLen + 6, 3.6, c.z - 2.8);
    g.push(lampMesh);
    const lamp = new THREE.PointLight(0xfde68a, 30, 18);
    lamp.position.copy(lampMesh.position);
    g.push(lamp);

    // water
    this.water = new THREE.Mesh(
      new THREE.PlaneGeometry(170, 110, 30, 12),
      new THREE.MeshStandardMaterial({ color: 0x0b4a6e, roughness: 0.35, metalness: 0.2 })
    );
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.set(c.x - 80, -0.35, c.z);
    g.push(this.water);

    // fish shadows (dark ellipses under the surface)
    this.shadows = [];
    for (let i = 0; i < 5; i++) {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(0.7, 10, 8),
        new THREE.MeshBasicMaterial({ color: 0x04121f, transparent: true, opacity: 0.55 })
      );
      m.scale.set(1.8, 0.25, 0.7);
      const sx = c.x - 20 - Math.random() * 60;
      const sz = c.z - 20 + Math.random() * 40;
      m.position.set(sx, -0.2, sz);
      this.shadows.push({ mesh: m, x: sx, z: sz, vx: (Math.random() - 0.5) * 2, vz: (Math.random() - 0.5) * 2 });
      g.push(m);
    }

    // bait shop hut at pier root
    g.push(box(6, 3.2, 5, 0x3b4a63, c.x + 8, 1.6, c.z + 8));
    const shopLbl = labelSprite("BAIT & TACKLE", { size: 6 });
    shopLbl.position.set(c.x + 8, 5, c.z + 8);
    g.push(shopLbl);

    const castDisc = zoneDisc(2, 0x22d3ee);
    castDisc.position.set(c.x - 8, 0.03, c.z);
    g.push(castDisc);

    const label = labelSprite("NEON BREAK PIER — FISHING", { size: 12 });
    label.position.set(c.x - 20, 9, c.z);
    g.push(label);
    return g;
  }

  // ---------------------------------------------------------------- trophies

  private loadTrophies(): Record<Rarity, string> {
    try {
      const raw = localStorage.getItem(TROPHY_KEY);
      if (raw) return JSON.parse(raw) as Record<Rarity, string>;
    } catch { /* ignore */ }
    return { junk: "", common: "", uncommon: "", rare: "", epic: "", legendary: "" };
  }

  private saveTrophy(f: FishDef): void {
    if (!this.trophies[f.rarity]) {
      this.trophies[f.rarity] = f.name;
      try { localStorage.setItem(TROPHY_KEY, JSON.stringify(this.trophies)); } catch { /* ignore */ }
    }
  }

  // ---------------------------------------------------------------- lifecycle

  start(): void {
    const c = this.venues.pier;
    this._active = true;
    this.phase = "idle";
    this.catches = 0;
    this.earned = 0;
    this.catchFish = null;
    this.spawnAthlete(new THREE.Vector3(c.x - 8, 0, c.z), 0xf59e0b);
    this.snapCam(
      new THREE.Vector3(c.x + 2, 5, c.z + 10),
      new THREE.Vector3(c.x - 20, 0, c.z)
    );
    this.toast("Hold Space to charge your cast, release to throw. Deeper water = rarer fish!");
    this.bus.emit({ type: "tick", sport: "fishing", state: this.hudState() });
  }

  stop(): void {
    if (!this._active) return;
    this._active = false;
    this.clearTackle();
    this.despawnAthlete();
    if (this.catches > 0) {
      this.ctx?.notify?.(`Fishing trip: ${this.catches} catch${this.catches === 1 ? "" : "es"} → +${this.earned} paper CITY`);
    }
  }

  private clearTackle(): void {
    if (this.bobberMesh) { this.ctx?.scene.remove(this.bobberMesh); this.bobberMesh = null; }
    if (this.line) { this.ctx?.scene.remove(this.line); this.line = null; }
    if (this.ripple) { this.ctx?.scene.remove(this.ripple); this.ripple = null; }
  }

  // ---------------------------------------------------------------- fishing logic

  private beginCast(): void {
    this.phase = "cast";
    this.charge = 0;
    this.chargeDir = 1;
  }

  private releaseCast(): void {
    const c = this.venues.pier;
    this.castDist = 12 + (this.charge / 100) * 30; // 12..42
    const angler = new THREE.Vector3(c.x - 8, 0, c.z);
    this.bobber.set(angler.x - this.castDist, 0, angler.z + (Math.random() - 0.5) * 10);
    // bobber
    this.clearTackle();
    this.bobberMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.5 })
    );
    this.ctx?.scene.add(this.bobberMesh);
    // line (2-point, updated per frame)
    const lineGeo = new THREE.BufferGeometry().setFromPoints([angler.clone().setY(1.4), this.bobber.clone()]);
    this.line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0xd1d5db, transparent: true, opacity: 0.7 }));
    this.ctx?.scene.add(this.line);
    // ripple
    this.ripple = new THREE.Mesh(
      new THREE.TorusGeometry(0.9, 0.07, 8, 28),
      new THREE.MeshBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.8 })
    );
    this.ripple.rotation.x = Math.PI / 2;
    this.ripple.position.set(this.bobber.x, 0.1, this.bobber.z);
    this.ctx?.scene.add(this.ripple);
    this.phase = "wait";
    this.waitT = 0;
    this.biteCooldown = 1.2;
    this.toast(`Cast ${Math.round(this.castDist)}m out… wait for the bite.`);
  }

  private rollBite(dt: number): void {
    this.waitT += dt;
    this.biteCooldown -= dt;
    if (this.biteCooldown > 0) return;
    const depthF = THREE.MathUtils.clamp((this.castDist - 12) / 30, 0, 1);
    const chance = (0.10 + depthF * 0.22) * dt;
    if (Math.random() < chance) {
      this.phase = "bite";
      this.biteWindow = 1.4;
      this.toast("❗ BITE! Press Space NOW to hook it!");
      if (this.ripple) this.ripple.scale.setScalar(1.8);
    }
  }

  private hook(): void {
    this.phase = "fight";
    this.fight = {
      dist: this.castDist,
      startDist: this.castDist,
      tension: 25,
      running: false,
      runT: 0,
      nextRun: 1.5 + Math.random() * 2.5,
    };
    this.toast("🎣 HOOKED! Hold ↑ to reel — keep tension in the GREEN (30–80)!");
  }

  private fightFish(dt: number, input: SportInput): void {
    const f = this.fight;
    const reeling = input.up;
    // fish run scheduling
    f.nextRun -= dt;
    if (f.nextRun <= 0 && !f.running) {
      f.running = true;
      f.runT = 1.2 + Math.random() * 1.6;
      this.toast("⚠️ It's running!");
    }
    if (f.running) {
      f.runT -= dt;
      f.dist += 6.5 * dt;
      f.tension += (reeling ? 48 : 10) * dt;
      if (f.runT <= 0) {
        f.running = false;
        f.nextRun = 2 + Math.random() * 3.5 * (f.dist / Math.max(1, f.startDist));
      }
    }
    if (reeling) {
      f.dist -= (f.running ? 1.6 : 4.6) * dt;
      f.tension += (f.running ? 0 : 26) * dt;
    } else {
      f.tension -= 30 * dt;
    }
    f.tension = THREE.MathUtils.clamp(f.tension, 0, 105);

    if (f.tension >= 100) {
      this.clearTackle();
      this.phase = "idle";
      this.toast("💥 Line SNAPPED! Ease off when tension spikes.");
      return;
    }
    if (f.dist > f.startDist + 28) {
      this.clearTackle();
      this.phase = "idle";
      this.toast("🌊 It got away… keep the pressure on next time.");
      return;
    }
    if (f.dist <= 2.5) {
      this.landCatch();
    }
  }

  private rollRarity(): Rarity {
    const depthF = THREE.MathUtils.clamp((this.castDist - 12) / 30, 0, 1);
    const weights: [Rarity, number][] = [
      ["junk", 7],
      ["common", 44 - 12 * depthF],
      ["uncommon", 27],
      ["rare", 13 + 7 * depthF],
      ["epic", 4 + 4 * depthF],
      ["legendary", 1 + 2.4 * depthF],
    ];
    const total = weights.reduce((s, [, w]) => s + w, 0);
    let r = Math.random() * total;
    for (const [rarity, w] of weights) {
      r -= w;
      if (r <= 0) return rarity;
    }
    return "common";
  }

  private landCatch(): void {
    const rarity = this.rollRarity();
    const def = FISH[rarity];
    const name = def.names[Math.floor(Math.random() * def.names.length)];
    const size = (0.4 + Math.random() * 1.8).toFixed(1);
    const fish: FishDef = { name: `${name} (${size}kg)`, rarity, paper: def.paper, icon: def.icon };
    this.catchFish = fish;
    this.catches++;
    this.earned += fish.paper;
    this.saveTrophy(fish);
    if (fish.paper > 0) this.ledger.earn(fish.paper, `sold: ${name} [${rarity}]`);
    this.clearTackle();
    this.phase = "catch";
    const worth = fish.paper > 0 ? ` — sold for +${fish.paper} paper` : " — worthless, but a story.";
    this.toast(`${fish.icon} CAUGHT: ${fish.name}! [${rarity.toUpperCase()}]${worth} (Space = cast again)`);
    this.bus.emit({ type: "tick", sport: "fishing", state: this.hudState() });
  }

  private hudState() {
    const f = this.fight;
    return {
      phase: this.phase,
      charge: Math.round(this.charge),
      castDist: Math.round(this.castDist),
      waitTime: Math.round(this.waitT * 10) / 10,
      biteWindow: Math.max(0, Math.round(this.biteWindow * 100) / 100),
      tension: Math.round(f.tension),
      tensionZone: f.tension >= 30 && f.tension <= 80 ? "green" : f.tension > 80 ? "red" : "low",
      fishDist: Math.max(0, Math.round(f.dist * 10) / 10),
      running: f.running,
      lastCatch: this.catchFish ? {
        name: this.catchFish.name,
        rarity: this.catchFish.rarity,
        paper: this.catchFish.paper,
        icon: this.catchFish.icon,
        color: RARITY_COLOR[this.catchFish.rarity],
      } : null,
      catches: this.catches,
      earned: this.earned,
      trophies: { ...this.trophies },
    };
  }

  // ---------------------------------------------------------------- frame

  update(dt: number, input: SportInput): void {
    this.elapsed += dt;
    this.fishT += dt;
    const c = this.venues.pier;

    // water shimmer
    if (this.water) {
      const p = this.water.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i);
        p.setZ(i, Math.sin(x * 0.1 + this.fishT * 1.3) * 0.25 + Math.cos(y * 0.14 + this.fishT * 0.9) * 0.2);
      }
      p.needsUpdate = true;
    }
    // fish shadows wander; one gets curious during "wait"
    for (const s of this.shadows) {
      if (this.phase === "wait" && this.bobberMesh) {
        const dx = this.bobber.x - s.x, dz = this.bobber.z - s.z;
        const d = Math.hypot(dx, dz);
        if (d < 30 && d > 2) {
          s.vx += (dx / d) * dt * 3;
          s.vz += (dz / d) * dt * 3;
        }
      }
      s.x += s.vx * dt;
      s.z += s.vz * dt;
      if (Math.abs(s.x - (c.x - 50)) > 70) s.vx *= -1;
      if (Math.abs(s.z - c.z) > 45) s.vz *= -1;
      s.mesh.position.set(s.x, -0.2 + Math.sin(this.fishT * 2 + s.x) * 0.08, s.z);
      s.mesh.rotation.y = Math.atan2(-s.vz, s.vx);
    }

    const angler = new THREE.Vector3(c.x - 8, 0, c.z);

    if (this.phase === "idle" || this.phase === "catch") {
      if (input.pressed1) this.beginCast();
      if (this.athlete) {
        this.athlete.position.copy(angler);
        this.athlete.rotation.y = -Math.PI / 2;
      }
    } else if (this.phase === "cast") {
      this.charge += this.chargeDir * dt * 110;
      if (this.charge >= 100) { this.charge = 100; this.chargeDir = -1; }
      if (this.charge <= 0) { this.charge = 0; this.chargeDir = 1; }
      if (!input.action1) {
        if (this.charge < 5) this.phase = "idle";
        else this.releaseCast();
      }
      if (this.athlete) {
        const { armR } = this.athlete.userData.limbs as Record<string, THREE.Mesh>;
        armR.rotation.x = -2.2 + (this.charge / 100) * 0.8; // rod winding back
      }
    } else if (this.phase === "wait") {
      this.rollBite(dt);
      if (this.bobberMesh) {
        this.bobberMesh.position.set(
          this.bobber.x,
          -0.1 + Math.sin(this.fishT * 3.2) * 0.14,
          this.bobber.z + Math.cos(this.fishT * 2.1) * 0.2
        );
      }
      if (this.ripple) {
        const s = 1 + Math.sin(this.fishT * 2.4) * 0.25;
        this.ripple.scale.setScalar(s);
      }
    } else if (this.phase === "bite") {
      this.biteWindow -= dt;
      if (this.bobberMesh) {
        this.bobberMesh.position.y = -0.45; // yanked under
      }
      if (input.pressed1) {
        this.hook();
      } else if (this.biteWindow <= 0) {
        this.phase = "wait";
        this.biteCooldown = 2.5;
        this.toast("Missed it… it nibbled and left.");
        if (this.ripple) this.ripple.scale.setScalar(1);
      }
    } else if (this.phase === "fight") {
      this.fightFish(dt, input);
      if (this.bobberMesh && this.phase === "fight") {
        const f = this.fight;
        const bx = angler.x - f.dist;
        this.bobberMesh.position.set(bx, -0.15, this.bobber.z);
        if (this.ripple) this.ripple.position.set(bx, 0.1, this.bobber.z);
      }
      if (this.athlete) {
        const { armR } = this.athlete.userData.limbs as Record<string, THREE.Mesh>;
        armR.rotation.x = input.up ? -1.9 : -1.2; // reeling pose
      }
    }

    // rod line follows the rod tip → bobber
    if (this.line && this.bobberMesh) {
      const pts = this.line.geometry.attributes.position as THREE.BufferAttribute;
      pts.setXYZ(0, angler.x, 1.6, angler.z);
      const bp = this.bobberMesh.position;
      pts.setXYZ(1, bp.x, bp.y + 0.25, bp.z);
      pts.needsUpdate = true;
    }

    if (this.athlete && this.phase !== "idle" && this.phase !== "catch") {
      this.athlete.position.copy(angler);
      this.athlete.rotation.y = -Math.PI / 2;
    }

    // camera looks out over the water past the bobber
    const lookX = this.phase === "wait" || this.phase === "bite" || this.phase === "fight"
      ? this.bobber.x : c.x - 30;
    this.camPos.lerp(new THREE.Vector3(c.x + 3, 5.5, c.z + 11), Math.min(1, 4 * dt));
    this.camLook.lerp(new THREE.Vector3(lookX, 0, c.z), Math.min(1, 4 * dt));
    const ctx = this.ctx;
    if (ctx) { ctx.camera.position.copy(this.camPos); ctx.camera.lookAt(this.camLook); }

    this.bus.emit({ type: "tick", sport: "fishing", state: this.hudState() });
  }
}
