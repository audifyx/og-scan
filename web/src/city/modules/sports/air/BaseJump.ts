/**
 * ORBITXCITY sports — 4. Base jumping.
 * Leap off the tallest token tower, freefall, pull the chute, land in the zone.
 * Style for airtime + tricks; precision landing multiplies the payout.
 */
import * as THREE from "three";
import { SportBase } from "../base";
import { buildTokenTower, zoneDisc, labelSprite, ringMesh } from "../venues";
import type { SportInput } from "../types";

const PHASES = ["climb", "fall", "chute", "landed"] as const;
type Phase = (typeof PHASES)[number];

export class BaseJump extends SportBase {
  meta = {
    id: "basejump" as const,
    name: "Base Jump",
    tagline: "Off the OrbitX Tower. Pull late, land clean.",
    icon: "🪂",
    venue: "OrbitX Tower",
  };

  private phase: Phase = "climb";
  private pos = new THREE.Vector3();
  private vy = 0;
  private chuteOpen = false;
  private fallTime = 0;
  private stylePts = 0;
  private drift = new THREE.Vector3();
  private canopy: THREE.Mesh | null = null;
  private targetZone = new THREE.Vector3();
  private flareT = 0;

  buildVenue(): THREE.Object3D[] {
    const g: THREE.Object3D[] = [];
    g.push(buildTokenTower(this.venues.towerTop, this.venues.towerBase));
    // landing zone at tower base
    this.targetZone.set(this.venues.towerBase.x + 18, 0, this.venues.towerBase.z + 12);
    const disc = zoneDisc(5, 0xfbbf24);
    disc.position.set(this.targetZone.x, 0.05, this.targetZone.z);
    g.push(disc);
    const bull = ringMesh(1.2, 0xfbbf24);
    bull.position.set(this.targetZone.x, 0.1, this.targetZone.z);
    bull.rotation.x = -Math.PI / 2;
    g.push(bull);
    const label = labelSprite("BASE JUMP — LAND IN THE ZONE", { size: 13 });
    label.position.set(this.venues.towerTop.x, this.venues.towerTop.y + 12, this.venues.towerTop.z);
    g.push(label);
    return g;
  }

  start(): void {
    const top = this.venues.towerTop;
    this._active = true;
    this.phase = "climb";
    this.pos.set(top.x, top.y + 1.2, top.z - 8);
    this.vy = 0;
    this.chuteOpen = false;
    this.fallTime = 0;
    this.stylePts = 0;
    this.flareT = 0;
    this.drift.set(0, 0, 0);
    this.spawnAthlete(this.pos, 0xf97316);
    this.snapCam(
      new THREE.Vector3(top.x, top.y + 6, top.z - 24),
      new THREE.Vector3(top.x, top.y, top.z)
    );
    this.toast("Walk to the edge and press Space to JUMP. Pull the chute (Space) — not too late!");
  }

  stop(): void {
    if (!this._active) return;
    this._active = false;
    this.clearCanopy();
    this.despawnAthlete();
    const { paper } = this.ledger.cashStyle(this.stylePts, "base jump");
    if (this.stylePts > 0) this.ctx?.notify?.(`Base jump: ${this.stylePts} style → +${paper} paper CITY`);
  }

  private clearCanopy(): void {
    if (this.canopy) {
      this.ctx?.scene.remove(this.canopy);
      this.canopy = null;
    }
  }

  update(dt: number, input: SportInput): void {
    this.elapsed += dt;

    if (this.phase === "climb") {
      // waddle to the deck edge
      const edge = this.venues.towerTop.x;
      const speed = 2.2;
      if (input.up) this.pos.z -= speed * dt;
      if (input.down) this.pos.z += speed * dt;
      if (input.left) this.pos.x -= speed * dt;
      if (input.right) this.pos.x += speed * dt;
      const c = this.venues.towerTop;
      this.pos.x = THREE.MathUtils.clamp(this.pos.x, c.x - 7, c.x + 7);
      this.pos.z = THREE.MathUtils.clamp(this.pos.z, c.z - 7, c.z + 7);
      this.pos.y = c.y + 1.2;
      if (input.pressed1) {
        this.phase = "fall";
        // jump off toward the landing zone
        const dir = new THREE.Vector3().subVectors(this.targetZone, this.pos).setY(0).normalize();
        this.drift.copy(dir.multiplyScalar(9));
        this.vy = 0;
        this.toast("🪂 Falling! Space = deploy chute");
      }
      if (this.athlete) {
        this.athlete.position.copy(this.pos);
        this.athlete.position.y -= 1.2; // feet on deck
      }
      this.chase(this.pos, 9, 3.5);
    }

    if (this.phase === "fall" || this.phase === "chute") {
      this.fallTime += dt;
      // steer with arrows
      const steer = this.chuteOpen ? 14 : 6;
      if (input.left) this.drift.x -= steer * dt;
      if (input.right) this.drift.x += steer * dt;
      if (input.up) this.drift.z -= steer * dt;
      if (input.down) this.drift.z += steer * dt;
      const maxDrift = this.chuteOpen ? 16 : 10;
      if (this.drift.length() > maxDrift) this.drift.setLength(maxDrift);

      // deploy chute
      if (input.pressed1 && this.phase === "fall") {
        if (this.pos.y < 12) {
          // too late — splat
          this.splat();
          return;
        }
        this.phase = "chute";
        this.chuteOpen = true;
        this.vy = Math.max(this.vy, -14);
        this.openCanopy();
        this.toast(`Chute open at ${Math.round(this.pos.y)}m! Steer into the gold zone.`);
        const airBonus = Math.round(this.fallTime * 8);
        this.stylePts += airBonus;
        this.style(airBonus, "freefall airtime");
      }

      // trick inputs during freefall (action2-4 = flips)
      if (this.phase === "fall" && (input.pressed2 || input.pressed3 || input.pressed4)) {
        const names = ["Backflip", "Frontflip", "Barrel roll"];
        const idx = input.pressed2 ? 0 : input.pressed3 ? 1 : 2;
        this.stylePts += 60;
        this.style(60, names[idx]);
        this.toast(`✨ ${names[idx]}! +60 style`);
      }

      // vertical speed
      const targetVy = this.chuteOpen ? -4.2 : -46;
      this.vy += (targetVy - this.vy) * Math.min(1, dt * (this.chuteOpen ? 3 : 1.2));
      this.pos.addScaledVector(this.drift, dt);
      this.pos.y += this.vy * dt;

      // flare just before touchdown for a soft landing
      if (this.chuteOpen && this.pos.y < 6 && input.pressed1) {
        this.vy = -1.6;
        this.flareT = 0.6;
        this.toast("Flare! 🧈");
      }
      if (this.flareT > 0) this.flareT -= dt;

      // avatar pose
      if (this.athlete) {
        this.athlete.position.copy(this.pos);
        if (!this.chuteOpen) {
          const { armL, armR, legL, legR } = this.athlete.userData.limbs as Record<string, THREE.Mesh>;
          armL.rotation.z = 1.2; armR.rotation.z = -1.2;
          legL.rotation.x = 0.3; legR.rotation.x = 0.3;
          this.athlete.rotation.x = 0.5; // head-down-ish
        } else {
          this.athlete.rotation.x = 0;
        }
      }

      this.chase(this.pos, 10, 4);
      if (this.canopy) {
        this.canopy.position.set(this.pos.x, this.pos.y + 3.4, this.pos.z);
        this.canopy.rotation.y += dt * (input.left ? 1.5 : input.right ? -1.5 : 0.2);
      }

      // touchdown
      if (this.pos.y <= 0.9) this.touchdown();
      if (this.pos.y < -4) this.splat();
    }

    if (this.phase === "landed" && input.pressed1) {
      // jump again
      this.start();
      return;
    }

    this.bus.emit({
      type: "tick", sport: "basejump",
      state: {
        phase: this.phase,
        altitude: Math.max(0, Math.round(this.pos.y)),
        style: this.stylePts,
        chuteOpen: this.chuteOpen,
        fallTime: Math.round(this.fallTime * 10) / 10,
      },
    });
  }

  private openCanopy(): void {
    this.clearCanopy();
    const geo = new THREE.SphereGeometry(2.6, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    this.canopy = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.7, side: THREE.DoubleSide }));
    this.canopy.castShadow = true;
    this.ctx?.scene.add(this.canopy);
  }

  private touchdown(): void {
    this.phase = "landed";
    this.pos.y = 0.9;
    const d = Math.hypot(this.pos.x - this.targetZone.x, this.pos.z - this.targetZone.z);
    let mult = 1;
    let verdict: string;
    if (!this.chuteOpen) {
      verdict = "💀 No chute… somehow you walked it off (this once).";
    } else if (d <= 1.5) {
      mult = 3; verdict = "🎯 BULLSEYE! x3 precision bonus";
      this.stylePts += 150;
      this.style(150, "bullseye landing");
    } else if (d <= 5) {
      mult = 2; verdict = "✅ In the zone! x2 precision bonus";
      this.stylePts += 80;
      this.style(80, "zone landing");
    } else {
      verdict = `Landed ${Math.round(d)}m off target — style only.`;
    }
    this.clearCanopy();
    if (this.athlete) { this.athlete.rotation.x = 0; this.athlete.position.copy(this.pos); }
    const { paper } = this.ledger.cashStyle(Math.round(this.stylePts * mult), "base jump landing");
    this.ctx?.notify?.(`${verdict} → +${paper} paper CITY`);
    this.toast("Press Space to jump again.");
  }

  private splat(): void {
    this.phase = "landed";
    this.clearCanopy();
    if (this.athlete) {
      this.athlete.rotation.x = Math.PI / 2; // faceplant
      this.athlete.position.set(this.pos.x, 0.4, this.pos.z);
    }
    this.toast("💥 SPLAT. Chute needs air to open — pull earlier! (Space to retry)");
    this.stylePts = 0;
  }
}
