/**
 * ORBITXCITY sports — 3. Parkour time trials.
 * Sprint a rooftop course, hit every checkpoint, beat the par time.
 * Falls drop you back to the last checkpoint (time keeps running).
 */
import * as THREE from "three";
import { SportBase, animateRun, resetPose } from "../base";
import { box, zoneDisc, labelSprite, ringMesh } from "../venues";
import type { SportInput } from "../types";

interface Roof {
  x: number; z: number; w: number; d: number; top: number;
}

const PAR_TIME = 75; // seconds for gold

export class Parkour extends SportBase {
  meta = {
    id: "parkour" as const,
    name: "Parkour Trials",
    tagline: "Rooftops. Checkpoints. Beat the clock.",
    icon: "🏃",
    venue: "Downtown Rooftop Course",
  };

  private roofs: Roof[] = [];
  private checkpointRings: THREE.Mesh[] = [];
  private pos = new THREE.Vector3();
  private vel = new THREE.Vector3();
  private yaw = 0;
  private vy = 0;
  private grounded = true;
  private cpIndex = 0;
  private time = 0;
  private running = false;
  private finished = false;
  private runT = 0;
  private best = 0;

  buildVenue(): THREE.Object3D[] {
    const g: THREE.Object3D[] = [];
    const starts = this.venues.parkourStart;
    // Course: 6 rooftops chained from each start — use start[0] as the course
    const s = starts[0];
    const defs: Roof[] = [];
    const heights = [24, 27, 23, 30, 26, 28];
    const sizes = [[14, 12], [12, 10], [10, 12], [12, 14], [10, 10], [16, 12]];
    let x = s.x, z = s.z;
    for (let i = 0; i < 6; i++) {
      const w = sizes[i][0], d = sizes[i][1];
      const top = heights[i];
      defs.push({ x, z, w, d, top });
      x += 22 + (i % 2) * 6;
      z += (i % 2 === 0 ? -8 : 10);
    }
    this.roofs = defs;
    this.checkpointRings = [];

    for (let i = 0; i < defs.length; i++) {
      const r = defs[i];
      const b = box(r.w, r.top, r.d, 0x27303f, r.x, r.top / 2, r.z);
      g.push(b);
      // neon edge trim
      const trim = box(r.w + 0.3, 0.25, r.d + 0.3, 0x22d3ee, r.x, r.top + 0.1, r.z);
      (trim.material as THREE.MeshStandardMaterial).emissive = new THREE.Color(0x22d3ee);
      g.push(trim);
      // checkpoint ring on each roof except the first (start pad instead)
      if (i > 0) {
        const ring = ringMesh(1.6, i === defs.length - 1 ? 0xfbbf24 : 0x22d3ee);
        ring.position.set(r.x, r.top + 1.2, r.z);
        ring.rotation.y = Math.PI / 2;
        this.checkpointRings.push(ring);
        g.push(ring);
      }
    }
    // start pad marker + finish arch
    const start = zoneDisc(2.5, 0x22d3ee);
    start.position.set(defs[0].x, defs[0].top + 0.05, defs[0].z);
    g.push(start);
    const last = defs[defs.length - 1];
    const arch = box(0.4, 5, 6, 0xfbbf24, last.x, last.top + 2.5, last.z);
    g.push(arch);
    const label = labelSprite("PARKOUR — BEAT THE CLOCK", { size: 14 });
    label.position.set(defs[0].x, defs[0].top + 8, defs[0].z);
    g.push(label);
    return g;
  }

  start(): void {
    const r = this.roofs[0];
    this._active = true;
    this.pos.set(r.x, r.top, r.z);
    this.vel.set(0, 0, 0);
    this.yaw = Math.atan2(1, 1);
    this.vy = 0;
    this.grounded = true;
    this.cpIndex = 0;
    this.time = 0;
    this.running = false;
    this.finished = false;
    this.runT = 0;
    this.spawnAthlete(this.pos, 0xa3e635);
    this.snapCam(
      new THREE.Vector3(this.pos.x - 8, this.pos.y + 6, this.pos.z + 8),
      new THREE.Vector3(this.pos.x, this.pos.y + 1, this.pos.z)
    );
    this.toast(`Run! Sprint (W) + jump (Space) roof to roof — pass all ${this.roofs.length - 1} rings. Par ${PAR_TIME}s.`);
  }

  stop(): void {
    if (!this._active) return;
    this._active = false;
    this.despawnAthlete();
  }

  private currentRoof(x: number, z: number): Roof | null {
    for (const r of this.roofs) {
      if (Math.abs(x - r.x) <= r.w / 2 && Math.abs(z - r.z) <= r.d / 2) return r;
    }
    return null;
  }

  update(dt: number, input: SportInput): void {
    // restart after a finished run — the toast promises "Space to run it back"
    if (this.finished && input.pressed1) {
      this.start();
      return;
    }
    if (!this.running && (input.up || input.pressed1)) {
      this.running = true;
      this.toast("Timer started!");
    }
    if (this.running && !this.finished) this.time += dt;
    this.elapsed += dt;
    this.runT += dt;

    // --- movement ---
    const speed = input.up ? 8.5 : input.down ? 3 : 5.5;
    if (input.left) this.yaw += 2.6 * dt;
    if (input.right) this.yaw -= 2.6 * dt;
    const moving = input.up || input.down;
    if (moving && this.grounded) {
      this.pos.x += -Math.sin(this.yaw) * speed * dt;
      this.pos.z += -Math.cos(this.yaw) * speed * dt;
    }
    // jump
    if (input.pressed1 && this.grounded) {
      this.vy = 6.4;
      this.grounded = false;
      if (!this.running) { this.running = true; this.toast("Timer started!"); }
    }
    // vertical physics
    if (!this.grounded) {
      this.vy -= 18 * dt;
      this.pos.y += this.vy * dt;
      // air control
      if (moving) {
        this.pos.x += -Math.sin(this.yaw) * speed * 0.55 * dt;
        this.pos.z += -Math.cos(this.yaw) * speed * 0.55 * dt;
      }
    }

    // landing / falling
    const roof = this.currentRoof(this.pos.x, this.pos.z);
    if (this.pos.y <= 0) {
      // fell to street — respawn at last checkpoint
      this.respawn();
    } else if (roof && this.pos.y <= roof.top && this.vy <= 0) {
      this.pos.y = roof.top;
      this.vy = 0;
      this.grounded = true;
    } else if (!roof && this.grounded && this.pos.y > 0.5) {
      // walked off an edge
      this.grounded = false;
    }

    // --- checkpoints ---
    if (this.running && !this.finished && this.cpIndex < this.checkpointRings.length) {
      const ring = this.checkpointRings[this.cpIndex];
      const d = Math.hypot(this.pos.x - ring.position.x, this.pos.y - ring.position.y, this.pos.z - ring.position.z);
      if (d < 2.2) {
        this.cpIndex++;
        this.toast(this.cpIndex === this.checkpointRings.length ? "🏁 Finish!" : `Checkpoint ${this.cpIndex}/${this.checkpointRings.length}`);
        ring.material = new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.9 });
        if (this.cpIndex === this.checkpointRings.length) this.finishRun();
      }
    }

    // --- avatar ---
    if (this.athlete) {
      this.athlete.position.copy(this.pos);
      this.athlete.rotation.y = this.yaw;
      if (this.grounded && moving) animateRun(this.athlete, this.runT, 1);
      else if (!this.grounded) {
        const { armL, armR } = this.athlete.userData.limbs as Record<string, THREE.Mesh>;
        armL.rotation.z = 1.4; armR.rotation.z = -1.4; // superman pose
      } else resetPose(this.athlete);
    }
    this.chase(this.pos, 7.5, 3.2);

    this.bus.emit({
      type: "tick", sport: "parkour",
      state: {
        time: Math.round(this.time * 10) / 10,
        par: PAR_TIME,
        checkpoint: this.cpIndex,
        total: this.checkpointRings.length,
        running: this.running,
        finished: this.finished,
        best: this.best > 0 ? this.best : null,
      },
    });
  }

  private respawn(): void {
    const r = this.cpIndex === 0 ? this.roofs[0] : this.roofs[this.cpIndex];
    this.pos.set(r.x, r.top + 0.5, r.z);
    this.vy = 0;
    this.grounded = true;
    this.toast("💥 Missed the roof — back to the last checkpoint. Clock's still running!");
  }

  private finishRun(): void {
    this.finished = true;
    const t = Math.round(this.time * 10) / 10;
    const isBest = this.best === 0 || t < this.best;
    if (isBest) this.best = t;
    let payout: number;
    let medal: string;
    if (t <= PAR_TIME) { payout = 120; medal = "🥇 GOLD"; }
    else if (t <= PAR_TIME * 1.5) { payout = 70; medal = "🥈 SILVER"; }
    else { payout = 35; medal = "🥉 BRONZE"; }
    this.ledger.earn(payout, `parkour time trial ${t}s (${medal.trim()})`);
    this.ctx?.notify?.(`${medal} — ${t}s! +${payout} paper CITY${isBest ? " (new best!)" : ""}`);
    this.toast("Press Space to run it back, or leave to exit.");
  }
}
