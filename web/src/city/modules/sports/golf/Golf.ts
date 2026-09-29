/**
 * ORBITXCITY sports — 9. Golf course (paper wagers).
 * 3-hole mini course: aim, charge the swing, beat par.
 * Each hole is a paper-CITY wager; under-par scores multiply the payout.
 * Champion tee time (real ORBITX, burned) doubles every payout.
 */
import * as THREE from "three";
import { SportBase } from "../base";
import { box, zoneDisc, labelSprite } from "../venues";
import type { SportInput } from "../types";
import { premiumBilling, PREMIUM_CATALOG } from "../billing";

type GPhase = "aim" | "charge" | "flight" | "holeDone" | "roundDone";

interface Hole {
  tee: THREE.Vector3;
  cup: THREE.Vector3;
  par: number;
  bunkers: { x: number; z: number; r: number }[];
  pond?: { x: number; z: number; r: number };
}

const WAGER_PRESETS = [10, 25, 50, 100] as const;

export class Golf extends SportBase {
  meta = {
    id: "golf" as const,
    name: "Golf",
    tagline: "Beat par. Paper wagers on every hole.",
    icon: "⛳",
    venue: "OrbitX Greens",
    premium: { cost: PREMIUM_CATALOG.golfChampionTee.cost, label: PREMIUM_CATALOG.golfChampionTee.label },
  };

  private holes: Hole[] = [];
  private holeIdx = 0;
  private phase: GPhase = "aim";
  private ball = new THREE.Vector3();
  private ballVel = new THREE.Vector3();
  private ballMesh: THREE.Mesh | null = null;
  private aimYaw = 0;
  private charge = 0;
  private chargeDir = 1;
  private needle = 0;
  private needleDir = 1;
  private strokes = 0;
  private wager = 25;
  private champion = false;
  private roundNet = 0;
  private flagsticks: THREE.Group[] = [];
  private cupRings: THREE.Mesh[] = [];
  private roundT = 0;

  // ---------------------------------------------------------------- venue

  private buildHoles(): Hole[] {
    const c = this.venues.golfCourse;
    const mk = (dx: number, len: number, par: number, bunkerDx: number[], pondDx?: number): Hole => {
      const tee = new THREE.Vector3(c.x + dx, 0, c.z);
      const cup = new THREE.Vector3(c.x + dx + len, 0, c.z + (dx % 2 === 0 ? 14 : -14));
      return {
        tee, cup, par,
        bunkers: bunkerDx.map((bx) => ({ x: c.x + dx + bx, z: cup.z + (bx % 2 === 0 ? 6 : -6), r: 3.4 })),
        pond: pondDx !== undefined ? { x: c.x + dx + pondDx, z: cup.z + 10, r: 6 } : undefined,
      };
    };
    return [
      mk(0, 62, 3, [44]),
      mk(90, 108, 4, [70, 92]),
      mk(220, 152, 5, [110, 132], 78),
    ];
  }

  buildVenue(): THREE.Object3D[] {
    const g: THREE.Object3D[] = [];
    this.holes = this.buildHoles();
    this.flagsticks = [];
    this.cupRings = [];

    for (const h of this.holes) {
      const mid = new THREE.Vector3().addVectors(h.tee, h.cup).multiplyScalar(0.5);
      const len = h.tee.distanceTo(h.cup);
      const yaw = Math.atan2(-(h.cup.z - h.tee.z), h.cup.x - h.tee.x);
      // fairway strip
      const fair = box(len, 0.3, 12, 0x3d8b4f, mid.x, -0.15, mid.z);
      fair.rotation.y = -yaw;
      g.push(fair);
      // tee box
      const teeDisc = zoneDisc(2.2, 0x22d3ee);
      teeDisc.position.set(h.tee.x, 0.02, h.tee.z);
      g.push(teeDisc);
      // green
      const green = new THREE.Mesh(
        new THREE.CircleGeometry(9, 36),
        new THREE.MeshStandardMaterial({ color: 0x4caf6d, roughness: 0.9 })
      );
      green.rotation.x = -Math.PI / 2;
      green.position.set(h.cup.x, 0.02, h.cup.z);
      green.receiveShadow = true;
      g.push(green);
      // cup
      const cup = new THREE.Mesh(
        new THREE.CylinderGeometry(0.55, 0.55, 0.3, 16),
        new THREE.MeshStandardMaterial({ color: 0x0b0f14, roughness: 1 })
      );
      cup.position.set(h.cup.x, 0.05, h.cup.z);
      g.push(cup);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.7, 0.08, 8, 24),
        new THREE.MeshBasicMaterial({ color: 0xfbbf24 })
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.set(h.cup.x, 0.12, h.cup.z);
      g.push(ring);
      this.cupRings.push(ring);
      // flagstick
      const flag = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3, 8), new THREE.MeshStandardMaterial({ color: 0xf8fafc }));
      pole.position.y = 1.5;
      flag.add(pole);
      const flagCloth = new THREE.Mesh(
        new THREE.PlaneGeometry(1.1, 0.7),
        new THREE.MeshBasicMaterial({ color: 0xef4444, side: THREE.DoubleSide })
      );
      flagCloth.position.set(0.6, 2.6, 0);
      flag.add(flagCloth);
      flag.position.set(h.cup.x, 0, h.cup.z);
      this.flagsticks.push(flag);
      g.push(flag);
      // bunkers
      for (const b of h.bunkers) {
        const sand = new THREE.Mesh(
          new THREE.CircleGeometry(b.r, 24),
          new THREE.MeshStandardMaterial({ color: 0xe3c98f, roughness: 1 })
        );
        sand.rotation.x = -Math.PI / 2;
        sand.position.set(b.x, 0.03, b.z);
        g.push(sand);
      }
      // pond
      if (h.pond) {
        const pond = new THREE.Mesh(
          new THREE.CircleGeometry(h.pond.r, 28),
          new THREE.MeshStandardMaterial({ color: 0x0e5a7d, roughness: 0.3 })
        );
        pond.rotation.x = -Math.PI / 2;
        pond.position.set(h.pond.x, 0.04, h.pond.z);
        g.push(pond);
      }
      // par label
      const lbl = labelSprite(`HOLE ${this.holes.indexOf(h) + 1} · PAR ${h.par}`, { size: 8 });
      lbl.position.set(h.tee.x, 6, h.tee.z - 8);
      g.push(lbl);
    }
    const main = labelSprite("ORBITX GREENS — 3 HOLES", { size: 12 });
    main.position.set(this.venues.golfCourse.x + 110, 10, this.venues.golfCourse.z - 20);
    g.push(main);
    return g;
  }

  // ---------------------------------------------------------------- HUD actions

  /** HUD: set the per-hole paper wager. */
  setWager(n: number): void {
    if (!(WAGER_PRESETS as readonly number[]).includes(n)) return;
    this.wager = n;
    this.toast(`Wager set: ${n} paper per hole.`);
    this.bus.emit({ type: "tick", sport: "golf", state: this.hudState() });
  }

  /** HUD: Champion tee time (real ORBITX, burned) — doubles all hole payouts this round. */
  async buyChampionTee(): Promise<{ ok: boolean; reason: string }> {
    if (this.champion) return { ok: true, reason: "Champion tee already active." };
    const item = PREMIUM_CATALOG.golfChampionTee;
    const res = await premiumBilling.spend(item.cost, "golfChampionTee");
    if (res.ok) {
      this.champion = true;
      this.toast("👑 Champion tee time — all payouts DOUBLED this round!");
      this.bus.emit({ type: "tick", sport: "golf", state: this.hudState() });
    } else {
      this.toast(res.reason);
    }
    return res;
  }

  // ---------------------------------------------------------------- lifecycle

  start(): void {
    this._active = true;
    this.holeIdx = 0;
    this.roundNet = 0;
    this.champion = false;
    this.roundT = 0;
    this.ballMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 14, 12),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 })
    );
    this.ballMesh.castShadow = true;
    this.ctx?.scene.add(this.ballMesh);
    this.spawnAthlete(new THREE.Vector3(), 0x4ade80);
    this.teeOff();
    this.toast(`Hole 1 · Par ${this.holes[0].par} · wager ${this.wager} paper. ←/→ aim, hold Space = power, release to swing.`);
  }

  stop(): void {
    if (!this._active) return;
    this._active = false;
    if (this.ballMesh) { this.ctx?.scene.remove(this.ballMesh); this.ballMesh = null; }
    this.despawnAthlete();
    if (this.roundNet !== 0) {
      this.ctx?.notify?.(`Golf round: net ${this.roundNet >= 0 ? "+" : ""}${this.roundNet} paper CITY`);
    }
  }

  private get hole(): Hole {
    return this.holes[this.holeIdx];
  }

  private teeOff(): void {
    const h = this.hole;
    if (!this.ledger.spend(this.wager, `golf hole ${this.holeIdx + 1} wager`)) {
      this.toast(`Need ${this.wager} paper for the hole ${this.holeIdx + 1} wager — round over.`);
      this.phase = "roundDone";
      this.bus.emit({ type: "tick", sport: "golf", state: this.hudState() });
      return;
    }
    this.roundNet -= this.wager;
    this.ball.copy(h.tee);
    this.ball.y = 0.22;
    this.ballVel.set(0, 0, 0);
    this.strokes = 0;
    this.phase = "aim";
    this.aimYaw = Math.atan2(-(h.cup.z - h.tee.z), h.cup.x - h.tee.x);
    this.bus.emit({ type: "tick", sport: "golf", state: this.hudState() });
  }

  private surfaceAt(x: number, z: number): "green" | "fairway" | "sand" | "pond" | "rough" {
    const h = this.hole;
    if (h.pond && Math.hypot(x - h.pond.x, z - h.pond.z) < h.pond.r) return "pond";
    for (const b of h.bunkers) {
      if (Math.hypot(x - b.x, z - b.z) < b.r) return "sand";
    }
    if (Math.hypot(x - h.cup.x, z - h.cup.z) < 9) return "green";
    // fairway: within 6 of the tee→cup segment
    const dx = h.cup.x - h.tee.x, dz = h.cup.z - h.tee.z;
    const len2 = dx * dx + dz * dz;
    const t = THREE.MathUtils.clamp(((x - h.tee.x) * dx + (z - h.tee.z) * dz) / len2, 0, 1);
    const px = h.tee.x + dx * t, pz = h.tee.z + dz * t;
    if (Math.hypot(x - px, z - pz) < 6) return "fairway";
    return "rough";
  }

  private strike(): void {
    const h = this.hole;
    const power = this.charge / 100;                 // 0..1
    const accuracy = 1 - Math.abs(this.needle);      // 0..1
    const dir = this.aimYaw + (this.needle * 0.28);  // slice/hook on bad timing
    const onGreen = this.surfaceAt(this.ball.x, this.ball.z) === "green";
    const inSand = this.surfaceAt(this.ball.x, this.ball.z) === "sand";
    const maxDist = onGreen ? 26 : 165;
    let speed = (8 + power * (maxDist - 8)) * (inSand ? 0.55 : 1);
    if (onGreen) speed = Math.min(speed, 20); // putts stay puttable
    const loft = onGreen ? 0.25 : 0.55 + power * 0.35;
    this.ballVel.set(Math.cos(dir) * speed, speed * loft * 0.55, -Math.sin(dir) * speed);
    this.strokes++;
    this.phase = "flight";
    if (accuracy < 0.35) this.toast(power > 0.85 ? "💥 SMASHED it… and sliced it!" : "Shanked it — timing was off.");
    else if (accuracy > 0.9 && power > 0.7) this.toast("🎯 Crushed it, dead straight!");
    void h;
  }

  private settle(): void {
    const h = this.hole;
    const surf = this.surfaceAt(this.ball.x, this.ball.z);
    if (surf === "pond") {
      this.strokes++;
      this.ball.copy(h.tee).lerp(h.cup, 0.35);
      this.ball.y = 0.22;
      this.toast("💧 Splash! +1 penalty stroke, drop taken.");
      this.phase = "aim";
      this.bus.emit({ type: "tick", sport: "golf", state: this.hudState() });
      return;
    }
    // holed?
    const dCup = Math.hypot(this.ball.x - h.cup.x, this.ball.z - h.cup.z);
    if (dCup < 0.75 && this.ball.y < 0.6) {
      this.holeComplete();
      return;
    }
    this.phase = "aim";
    this.aimYaw = Math.atan2(-(h.cup.z - this.ball.z), h.cup.x - this.ball.x);
    if (surf === "sand") this.toast("🏖️ In the bunker — next shot is heavy.");
    this.bus.emit({ type: "tick", sport: "golf", state: this.hudState() });
  }

  private holeComplete(): void {
    const h = this.hole;
    const diff = this.strokes - h.par;
    const baseMult = diff <= -2 ? 4 : diff === -1 ? 3 : diff === 0 ? 2 : diff === 1 ? 1 : 0;
    const mult = baseMult * (this.champion ? 2 : 1);
    const payout = this.wager * mult;
    const names = ["🦅 EAGLE or better!", "🐥 BIRDIE!", "✅ PAR", "😐 Bogey", "💩 Over bogey — wager lost"];
    const label = diff <= -2 ? names[0] : diff === -1 ? names[1] : diff === 0 ? names[2] : diff === 1 ? names[3] : names[4];
    if (payout > 0) {
      this.ledger.earn(payout, `golf hole ${this.holeIdx + 1}: ${this.strokes} strokes (${label})`);
      this.roundNet += payout;
    }
    this.phase = "holeDone";
    this.toast(`${label} ${this.strokes} strokes on a par ${h.par}${payout > 0 ? ` — +${payout} paper${this.champion ? " (champion x2)" : ""}` : ""}`);
    this.bus.emit({ type: "tick", sport: "golf", state: this.hudState() });
  }

  private nextHole(): void {
    this.holeIdx++;
    if (this.holeIdx >= this.holes.length) {
      this.phase = "roundDone";
      this.ctx?.notify?.(`⛳ Round complete! Net ${this.roundNet >= 0 ? "+" : ""}${this.roundNet} paper CITY. Space = play again.`);
    } else {
      this.teeOff();
      if (this.phase !== "roundDone") {
        this.toast(`Hole ${this.holeIdx + 1} · Par ${this.hole.par} · wager ${this.wager} paper.`);
      }
    }
    this.bus.emit({ type: "tick", sport: "golf", state: this.hudState() });
  }

  private hudState() {
    const h = this.holes[this.holeIdx];
    return {
      phase: this.phase,
      hole: this.holeIdx + 1,
      holes: this.holes.length,
      par: h?.par ?? null,
      strokes: this.strokes,
      wager: this.wager,
      wagers: [...WAGER_PRESETS],
      champion: this.champion,
      roundNet: this.roundNet,
      charge: Math.round(this.charge),
      needle: Math.round(this.needle * 100) / 100,
      ballToCup: h ? Math.round(Math.hypot(this.ball.x - h.cup.x, this.ball.z - h.cup.z)) : null,
      billingReady: premiumBilling.available,
    };
  }

  // ---------------------------------------------------------------- frame

  update(dt: number, input: SportInput): void {
    this.elapsed += dt;
    this.roundT += dt;
    const h = this.hole;
    if (!h) return;

    // flag wave
    for (const f of this.flagsticks) f.rotation.y = Math.sin(this.roundT * 2 + f.position.x) * 0.3;

    if (this.phase === "aim") {
      if (input.left) this.aimYaw += 1.6 * dt;
      if (input.right) this.aimYaw -= 1.6 * dt;
      if (input.pressed1) {
        this.phase = "charge";
        this.charge = 0;
        this.chargeDir = 1;
        this.needle = -1;
        this.needleDir = 1;
      }
      // golfer avatar stands by the ball
      if (this.athlete) {
        this.athlete.position.set(this.ball.x - Math.cos(this.aimYaw) * 1.2, 0, this.ball.z + Math.sin(this.aimYaw) * 1.2);
        this.athlete.rotation.y = -this.aimYaw + Math.PI / 2;
      }
    } else if (this.phase === "charge") {
      // power oscillates 0..100; accuracy needle sweeps -1..1
      this.charge += this.chargeDir * dt * 95;
      if (this.charge >= 100) { this.charge = 100; this.chargeDir = -1; }
      if (this.charge <= 0) { this.charge = 0; this.chargeDir = 1; }
      this.needle += this.needleDir * dt * 2.2;
      if (this.needle >= 1) { this.needle = 1; this.needleDir = -1; }
      if (this.needle <= -1) { this.needle = -1; this.needleDir = 1; }
      if (!input.action1) {
        // released → strike
        if (this.charge < 4) {
          this.phase = "aim"; // whiffed the press
        } else {
          this.strike();
        }
      }
    } else if (this.phase === "flight") {
      // ballistic + bounce + surface friction
      this.ballVel.y -= 22 * dt;
      this.ball.x += this.ballVel.x * dt;
      this.ball.y += this.ballVel.y * dt;
      this.ball.z += this.ballVel.z * dt;
      if (this.ball.y <= 0.22) {
        this.ball.y = 0.22;
        const surf = this.surfaceAt(this.ball.x, this.ball.z);
        if (this.ballVel.y < -3) {
          this.ballVel.y = -this.ballVel.y * 0.42;
          const fr = surf === "green" ? 0.82 : surf === "sand" ? 0.45 : surf === "fairway" ? 0.72 : 0.62;
          this.ballVel.x *= fr;
          this.ballVel.z *= fr;
        } else {
          this.ballVel.y = 0;
          const roll = surf === "green" ? 0.94 : surf === "sand" ? 0.78 : surf === "fairway" ? 0.90 : 0.84;
          const f = Math.pow(roll, dt * 60);
          this.ballVel.x *= f;
          this.ballVel.z *= f;
        }
      }
      // course bounds: lost ball → penalty drop at last lie
      const cx = this.venues.golfCourse.x;
      if (this.ball.x < cx - 40 || this.ball.x > cx + 400 || Math.abs(this.ball.z - this.venues.golfCourse.z) > 90) {
        this.strokes++;
        this.ball.copy(h.tee).lerp(h.cup, 0.5);
        this.ball.y = 0.22;
        this.ballVel.set(0, 0, 0);
        this.phase = "aim";
        this.toast("🌲 Lost ball! +1 penalty, drop taken.");
      } else if (this.ballVel.length() < 0.45 && this.ball.y <= 0.23) {
        this.ballVel.set(0, 0, 0);
        this.settle();
      }
    } else if (this.phase === "holeDone" || this.phase === "roundDone") {
      if (input.pressed1) {
        if (this.phase === "roundDone") {
          this.holeIdx = 0;
          this.roundNet = 0;
          this.teeOff();
        } else {
          this.nextHole();
        }
      }
    }

    if (this.ballMesh) this.ballMesh.position.copy(this.ball);

    // camera: behind the ball looking down the aim line (aim/charge), chase in flight
    if (this.athlete && this.phase !== "flight") {
      const back = 7;
      const ex = this.ball.x - Math.cos(this.aimYaw) * back;
      const ez = this.ball.z + Math.sin(this.aimYaw) * back;
      this.camPos.lerp(new THREE.Vector3(ex, 4.2, ez), Math.min(1, 5 * dt));
      this.camLook.lerp(new THREE.Vector3(this.ball.x + Math.cos(this.aimYaw) * 10, 0.8, this.ball.z - Math.sin(this.aimYaw) * 10), Math.min(1, 5 * dt));
      const ctx = this.ctx;
      if (ctx) { ctx.camera.position.copy(this.camPos); ctx.camera.lookAt(this.camLook); }
    } else {
      this.chase(this.ball, 8, 4);
    }

    this.bus.emit({ type: "tick", sport: "golf", state: this.hudState() });
  }
}
