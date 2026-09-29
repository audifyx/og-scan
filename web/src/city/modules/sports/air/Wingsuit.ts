/**
 * ORBITXCITY sports — 5. Wingsuit gliding.
 * Launch off the tower in a wingsuit, thread neon rings between
 * buildings. Rings banked = style; miss all rings = no payout.
 */
import * as THREE from "three";
import { SportBase } from "../base";
import { buildTokenTower, labelSprite, ringMesh } from "../venues";
import type { SportInput } from "../types";

interface Ring { mesh: THREE.Mesh; hit: boolean; pos: THREE.Vector3 }

const RING_STYLE = 90;

export class Wingsuit extends SportBase {
  meta = {
    id: "wingsuit" as const,
    name: "Wingsuit",
    tagline: "Thread the rings. Don't kiss concrete.",
    icon: "🪽",
    venue: "OrbitX Tower → Downtown",
  };

  private rings: Ring[] = [];
  private pos = new THREE.Vector3();
  private vel = new THREE.Vector3();
  private yaw = 0;
  private flying = false;
  private stylePts = 0;
  private ringsHit = 0;
  private runT = 0;

  buildVenue(): THREE.Object3D[] {
    const g: THREE.Object3D[] = [];
    g.push(buildTokenTower(this.venues.towerTop, this.venues.towerBase));

    // ring line weaving between buildings, descending toward the plaza
    const top = this.venues.towerTop;
    const ringDefs: [number, number, number][] = [];
    let x = top.x + 14, y = top.y - 8, z = top.z + 10;
    for (let i = 0; i < 8; i++) {
      ringDefs.push([x, y, z]);
      x += 16 + (i % 3) * 5;
      z += (i % 2 === 0 ? 12 : -10);
      y -= 9;
    }
    for (const [rx, ry, rz] of ringDefs) {
      const mesh = ringMesh(3.2, 0x22d3ee);
      mesh.position.set(rx, ry, rz);
      mesh.rotation.y = Math.PI / 2;
      g.push(mesh);
      this.rings.push({ mesh, hit: false, pos: new THREE.Vector3(rx, ry, rz) });
    }
    const label = labelSprite("WINGSUIT RUN — 8 RINGS", { size: 13 });
    label.position.set(top.x, top.y + 12, top.z);
    g.push(label);
    return g;
  }

  start(): void {
    const top = this.venues.towerTop;
    this._active = true;
    this.pos.set(top.x, top.y + 1.2, top.z - 8);
    this.vel.set(0, 0, 0);
    this.yaw = -Math.PI / 2; // face the ring line
    this.flying = false;
    this.stylePts = 0;
    this.ringsHit = 0;
    this.runT = 0;
    for (const r of this.rings) {
      r.hit = false;
      (r.mesh.material as THREE.MeshBasicMaterial).color.set(0x22d3ee);
    }
    this.spawnAthlete(this.pos, 0x8b5cf6);
    this.snapCam(
      new THREE.Vector3(top.x - 10, top.y + 5, top.z - 20),
      new THREE.Vector3(top.x, top.y, top.z)
    );
    this.toast("Press Space to LAUNCH. Steer with arrows — thread all 8 rings!");
  }

  stop(): void {
    if (!this._active) return;
    this._active = false;
    this.despawnAthlete();
    if (this.stylePts > 0) {
      const { paper } = this.ledger.cashStyle(this.stylePts, "wingsuit run");
      this.ctx?.notify?.(`Wingsuit: ${this.ringsHit}/8 rings → +${paper} paper CITY`);
    }
  }

  update(dt: number, input: SportInput): void {
    this.elapsed += dt;
    this.runT += dt;

    if (!this.flying) {
      if (input.pressed1) {
        this.flying = true;
        this.vel.set(20, -2, 6);
        this.toast("🪽 Flying! Rings glow green when threaded.");
      }
      if (this.athlete) this.athlete.position.copy(this.pos);
      this.chase(this.pos, 9, 3.5);
    } else {
      // --- flight model: speed bleeds into lift ---
      if (input.left) this.yaw += 1.4 * dt;
      if (input.right) this.yaw -= 1.4 * dt;
      // pitch: up = flare (slower, less sink), down = dive (faster, more sink)
      const dive = input.down ? 1 : 0;
      const flare = input.up ? 1 : 0;
      const speed = this.vel.length();
      const sink = THREE.MathUtils.clamp(6 - speed * 0.08 + dive * 8 - flare * 3.5, 1.5, 16);
      this.vel.y = -sink;
      // forward along yaw
      const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
      const targetSpeed = 24 + dive * 14 - flare * 9;
      const cur = new THREE.Vector3(this.vel.x, 0, this.vel.z);
      cur.lerp(fwd.multiplyScalar(targetSpeed), Math.min(1, dt * 2.2));
      this.vel.x = cur.x; this.vel.z = cur.z;
      this.pos.addScaledVector(this.vel, dt);

      // --- ring hits ---
      for (const r of this.rings) {
        if (r.hit) continue;
        const d = this.pos.distanceTo(r.pos);
        if (d < 3.4) {
          r.hit = true;
          this.ringsHit++;
          (r.mesh.material as THREE.MeshBasicMaterial).color.set(0x34d399);
          this.stylePts += RING_STYLE;
          this.style(RING_STYLE, "wingsuit ring");
          this.toast(`⭕ Ring ${this.ringsHit}/8 threaded! +${RING_STYLE} style`);
        }
      }

      // --- ground ---
      if (this.pos.y <= 1) {
        this.pos.y = 1;
        if (speed > 18) {
          // too fast — ragdoll tumble
          if (this.athlete) {
            this.athlete.rotation.x = Math.PI / 2;
            this.athlete.position.set(this.pos.x, 0.5, this.pos.z);
          }
          this.toast(`💥 Too hot on touchdown (${Math.round(speed)} m/s)! Next time flare with ↑.`);
        } else {
          this.toast(`🛬 Touchdown at ${Math.round(speed)} m/s — clean!`);
          this.stylePts += 50;
          this.style(50, "clean touchdown");
        }
        this.endFlight();
        return;
      }

      // --- avatar: wingsuit spread ---
      if (this.athlete) {
        this.athlete.position.copy(this.pos);
        this.athlete.rotation.y = this.yaw;
        this.athlete.rotation.x = THREE.MathUtils.clamp(-this.vel.y * 0.03, -0.2, 0.6);
        const { armL, armR, legL, legR } = this.athlete.userData.limbs as Record<string, THREE.Mesh>;
        armL.rotation.z = 1.5; armR.rotation.z = -1.5;
        legL.rotation.z = 0.35; legR.rotation.z = -0.35;
      }
      this.chase(this.pos, 11, 4.5);
    }

    this.bus.emit({
      type: "tick", sport: "wingsuit",
      state: {
        flying: this.flying,
        altitude: Math.max(0, Math.round(this.pos.y)),
        speed: Math.round(this.vel.length() * 3.6),
        rings: this.ringsHit,
        total: this.rings.length,
        style: this.stylePts,
      },
    });
  }

  private endFlight(): void {
    this.flying = false;
    const bonus = this.ringsHit === this.rings.length ? 200 : 0;
    if (bonus > 0) {
      this.stylePts += bonus;
      this.style(bonus, "perfect run");
      this.toast("🌟 PERFECT RUN — all 8 rings! +200 bonus");
    }
    this.ctx?.notify?.(`Wingsuit run over: ${this.ringsHit}/${this.rings.length} rings. Press Space to fly again.`);
  }
}
