/**
 * ORBITXCITY sports — 8. Surfing minigame.
 * Paddle out, catch a wave, ride the curl and throw tricks.
 * Style cashes to paper CITY; the Pro Board (real ORBITX, burned)
 * adds +25% style and steadier landings.
 */
import * as THREE from "three";
import { SportBase, animateRun } from "../base";
import { box, labelSprite } from "../venues";
import type { SportInput } from "../types";
import { premiumBilling, PREMIUM_CATALOG } from "../billing";

type SPhase = "paddle" | "ride" | "wipeout";

interface Trick {
  name: string;
  base: number;
  wipeRisk: number;
}

const TRICKS: Trick[] = [
  { name: "Cutback", base: 40, wipeRisk: 0.08 },
  { name: "Floater", base: 65, wipeRisk: 0.16 },
  { name: "Aerial 360", base: 110, wipeRisk: 0.30 },
];

const WAVE_PERIOD = 9; // seconds between waves
const PRO_BOARD_BONUS = 1.25;

export class Surf extends SportBase {
  meta = {
    id: "surf" as const,
    name: "Surf",
    tagline: "Catch the curl. Throw tricks. Don't wipe out.",
    icon: "🏄",
    venue: "Neon Break Beach",
    premium: { cost: PREMIUM_CATALOG.surfProBoard.cost, label: PREMIUM_CATALOG.surfProBoard.label },
  };

  private phase: SPhase = "paddle";
  private pos = new THREE.Vector3();
  private crestX = 0;      // leading edge of the active wave
  private waveSpeed = 0;
  private waveSize = 1;
  private waveT = 0;       // time until next wave
  private rideT = 0;       // time on the current wave
  private rideAcc = 0;      // fractional pocket style accumulator
  private offsetX = 0;     // player offset vs crest (sweet spot |offsetX| < 4)
  private stylePts = 0;
  private wavesCaught = 0;
  private board: THREE.Mesh | null = null;
  private swells: THREE.Mesh[] = [];
  private water: THREE.Mesh | null = null;
  private runT = 0;
  private trickFlash = 0;

  private get proBoard(): boolean {
    try {
      return localStorage.getItem("orbitxcity:sports:surf-pro") === "1";
    } catch { return false; }
  }
  private setProBoard(): void {
    try { localStorage.setItem("orbitxcity:sports:surf-pro", "1"); } catch { /* ignore */ }
  }

  // ---------------------------------------------------------------- venue

  buildVenue(): THREE.Object3D[] {
    const c = this.venues.surfBeach;
    const g: THREE.Object3D[] = [];

    // sand strip (shore at c.x, water toward -x)
    g.push(box(26, 1.6, 90, 0xd9b77c, c.x + 6, -0.8, c.z));

    // water plane
    const waterGeo = new THREE.PlaneGeometry(150, 90, 40, 16);
    this.water = new THREE.Mesh(
      waterGeo,
      new THREE.MeshStandardMaterial({ color: 0x0e5a7d, roughness: 0.35, metalness: 0.25 })
    );
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.set(c.x - 75, 0.05, c.z);
    this.water.receiveShadow = true;
    g.push(this.water);

    // drifting swell lines (purely visual; the gameplay wave is logical)
    this.swells = [];
    for (let i = 0; i < 5; i++) {
      const swell = new THREE.Mesh(
        new THREE.BoxGeometry(1.6, 0.9, 90),
        new THREE.MeshStandardMaterial({ color: 0x7dd3fc, roughness: 0.4, transparent: true, opacity: 0.55 })
      );
      swell.position.set(c.x - 30 - i * 26, 0.4, c.z);
      this.swells.push(swell);
      g.push(swell);
    }

    // buoy line marking the break zone
    for (let i = -2; i <= 2; i++) {
      const buoy = new THREE.Mesh(
        new THREE.SphereGeometry(0.5, 12, 10),
        new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.5 })
      );
      buoy.position.set(c.x - 34, 0.5, c.z + i * 16);
      g.push(buoy);
    }

    // lifeguard shack
    g.push(box(5, 3.4, 4, 0xef4444, c.x + 10, 1.7, c.z - 30));
    g.push(box(5.6, 0.4, 4.6, 0xf8fafc, c.x + 10, 3.6, c.z - 30));

    const label = labelSprite("NEON BREAK — SURF ZONE", { size: 12 });
    label.position.set(c.x - 10, 9, c.z);
    g.push(label);
    return g;
  }

  // ---------------------------------------------------------------- HUD actions

  /** HUD: buy the Pro Board (real ORBITX, burned). +25% style, steadier tricks. */
  async buyProBoard(): Promise<{ ok: boolean; reason: string }> {
    if (this.proBoard) return { ok: true, reason: "Already riding the Pro Board." };
    const item = PREMIUM_CATALOG.surfProBoard;
    const res = await premiumBilling.spend(item.cost, "surfProBoard");
    if (res.ok) {
      this.setProBoard();
      this.toast("🏄 Pro Board equipped — +25% style, steadier landings!");
      this.bus.emit({ type: "tick", sport: "surf", state: this.hudState() });
    } else {
      this.toast(res.reason);
    }
    return res;
  }

  // ---------------------------------------------------------------- lifecycle

  start(): void {
    const c = this.venues.surfBeach;
    this._active = true;
    this.phase = "paddle";
    this.pos.set(c.x - 34, 0, c.z);
    this.waveT = 2.5;
    this.rideT = 0;
    this.stylePts = 0;
    this.wavesCaught = 0;
    this.runT = 0;
    this.trickFlash = 0;
    this.spawnAthlete(this.pos, 0x06b6d4);
    this.board = new THREE.Mesh(
      new THREE.BoxGeometry(2.1, 0.08, 0.55),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5 })
    );
    this.board.castShadow = true;
    this.ctx?.scene.add(this.board);
    this.snapCam(
      new THREE.Vector3(this.pos.x - 10, 5, this.pos.z + 9),
      new THREE.Vector3(this.pos.x, 1, this.pos.z)
    );
    this.toast("Paddle (W) toward the break. When a wave reaches you, press Space to POP UP!");
    this.bus.emit({ type: "tick", sport: "surf", state: this.hudState() });
  }

  stop(): void {
    if (!this._active) return;
    this._active = false;
    if (this.board) { this.ctx?.scene.remove(this.board); this.board = null; }
    this.despawnAthlete();
    if (this.stylePts > 0) {
      const { paper } = this.ledger.cashStyle(this.stylePts, "surf session");
      this.ctx?.notify?.(`Surf session: ${this.wavesCaught} wave${this.wavesCaught === 1 ? "" : "s"}, ${this.stylePts} style → +${paper} paper CITY`);
    }
  }

  private styleGain(pts: number, label: string): void {
    const final = this.proBoard ? Math.round(pts * PRO_BOARD_BONUS) : pts;
    this.stylePts += final;
    this.style(final, label);
  }

  private hudState() {
    return {
      phase: this.phase,
      style: this.stylePts,
      waves: this.wavesCaught,
      nextWaveIn: Math.max(0, Math.round(this.waveT * 10) / 10),
      rideTime: Math.round(this.rideT * 10) / 10,
      sweetSpot: this.phase === "ride" && Math.abs(this.offsetX) < 4,
      proBoard: this.proBoard,
      billingReady: premiumBilling.available,
    };
  }

  // ---------------------------------------------------------------- frame

  update(dt: number, input: SportInput): void {
    this.elapsed += dt;
    this.runT += dt;
    if (this.trickFlash > 0) this.trickFlash -= dt;
    const c = this.venues.surfBeach;

    // water shimmer
    if (this.water) {
      const p = this.water.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i);
        p.setZ(i, Math.sin(x * 0.12 + this.runT * 1.6) * 0.22 + Math.cos(y * 0.15 + this.runT) * 0.18);
      }
      p.needsUpdate = true;
    }
    // swells drift toward shore and loop
    for (const s of this.swells) {
      s.position.x += 3.2 * dt;
      if (s.position.x > c.x - 4) s.position.x = c.x - 150;
    }

    if (this.phase === "paddle") {
      this.waveT -= dt;
      // paddle movement
      const spd = 5;
      if (input.up) this.pos.x -= spd * dt;
      if (input.down) this.pos.x += spd * dt;
      if (input.left) this.pos.z -= spd * dt;
      if (input.right) this.pos.z += spd * dt;
      this.pos.x = THREE.MathUtils.clamp(this.pos.x, c.x - 120, c.x - 4);
      this.pos.z = THREE.MathUtils.clamp(this.pos.z, c.z - 40, c.z + 40);

      // wave arrival
      if (this.waveT <= 0) {
        this.waveT = WAVE_PERIOD + Math.random() * 3;
        this.waveSize = 1 + Math.random() * 2; // 1..3
        this.waveSpeed = 7 + this.waveSize * 1.5;
        this.crestX = this.pos.x - 14; // crest forms just outside the player
        this.toast(`🌊 ${this.waveSize > 2.2 ? "BIG set" : "Wave"} incoming! Space to pop up!`);
      }
      // crest sweeps toward shore past the player
      this.crestX += this.waveSpeed * dt;
      const nearCrest = Math.abs(this.crestX - this.pos.x) < 12;
      if (input.pressed1 && nearCrest) {
        this.phase = "ride";
        this.rideT = 0;
        this.rideAcc = 0;
        this.offsetX = THREE.MathUtils.clamp(this.pos.x - this.crestX, -6, 6);
        this.wavesCaught++;
        this.toast("🏄 Riding! ↑/↓ ride the curl, ←/→ carve, 2/3/4 = tricks. Stay in the pocket!");
      } else if (input.pressed1) {
        this.toast("Too far from the wave — paddle closer to the break!");
      }
      if (this.athlete) {
        this.athlete.position.set(this.pos.x, 0.1, this.pos.z);
        animateRun(this.athlete, this.runT, 0.8); // paddling-ish
      }
    }

    if (this.phase === "ride") {
      this.rideT += dt;
      // ride the pocket: ↑ toward shore / ↓ fall back — too far either way = wipeout
      if (input.up) this.offsetX += 9 * dt;
      if (input.down) this.offsetX -= 9 * dt;
      this.offsetX -= 2.2 * dt; // wave constantly pulls you back
      // carve along the face
      if (input.left) this.pos.z -= 7 * dt;
      if (input.right) this.pos.z += 7 * dt;
      this.pos.z = THREE.MathUtils.clamp(this.pos.z, c.z - 40, c.z + 40);
      this.crestX += this.waveSpeed * dt;
      this.pos.x = this.crestX + this.offsetX;

      const sweet = Math.abs(this.offsetX) < 4;
      if (sweet) {
        // pocket time banks style (accumulated, paid out in half-second ticks)
        this.rideAcc += 10 * dt;
        if (Math.floor(this.rideT * 2) !== Math.floor((this.rideT - dt) * 2)) {
          const pts = Math.round(this.rideAcc + 5 * this.waveSize);
          this.rideAcc = 0;
          this.stylePts += pts;
          this.style(pts, "pocket ride");
        }
      }
      // tricks
      const trickIdx = input.pressed2 ? 0 : input.pressed3 ? 1 : input.pressed4 ? 2 : -1;
      if (trickIdx >= 0) {
        const t = TRICKS[trickIdx];
        const risk = t.wipeRisk * (this.proBoard ? 0.7 : 1) * (sweet ? 0.6 : 1.4);
        if (Math.random() < risk) {
          this.wipeout(`Wiped out throwing the ${t.name}!`);
        } else {
          this.trickFlash = 0.5;
          this.styleGain(Math.round(t.base * this.waveSize), t.name);
          this.toast(`✨ ${t.name}! +${Math.round(t.base * this.waveSize)} style`);
        }
      }
      // wave dies at the shore; losing the pocket = wipeout
      if (Math.abs(this.offsetX) > 12) {
        this.wipeout("Lost the pocket — the wave left you behind!");
      } else if (this.pos.x > c.x - 6) {
        this.endRide(true);
      }
      if (this.athlete) {
        this.athlete.position.set(this.pos.x, 0.55 + Math.sin(this.rideT * 6) * 0.12, this.pos.z);
        this.athlete.rotation.y = Math.PI / 2;
        const { armL, armR, legL, legR } = this.athlete.userData.limbs as Record<string, THREE.Mesh>;
        if (this.trickFlash > 0) {
          armL.rotation.z = 2.2; armR.rotation.z = -2.2;
          legL.rotation.x = -0.6; legR.rotation.x = 0.6;
        } else {
          armL.rotation.z = 0.9; armR.rotation.z = -0.9;
          legL.rotation.z = 0.3; legR.rotation.z = -0.3;
        }
      }
    }

    if (this.phase === "wipeout") {
      this.waveT -= dt;
      if (this.waveT <= 0) {
        this.phase = "paddle";
        this.waveT = 2;
        this.pos.x = THREE.MathUtils.clamp(this.pos.x - 10, c.x - 120, c.x - 6);
        if (this.athlete) { this.athlete.rotation.x = 0; this.athlete.rotation.z = 0; }
        this.toast("Back on the board. Paddle out for the next set.");
      }
      if (this.athlete) this.athlete.rotation.z += dt * 6; // tumble
    }

    if (this.board && this.phase !== "wipeout") {
      this.board.position.set(this.pos.x, 0.28, this.pos.z);
      this.board.rotation.y = this.phase === "ride" ? Math.PI / 2 : 0;
    } else if (this.board) {
      this.board.position.set(this.pos.x, 0.28, this.pos.z);
      this.board.rotation.z += dt * 4;
    }

    this.chase(this.pos, 9, 4.2);
    this.bus.emit({ type: "tick", sport: "surf", state: this.hudState() });
  }

  private wipeout(msg: string): void {
    this.phase = "wipeout";
    this.waveT = 2.2;
    this.toast(`💥 ${msg}`);
    if (this.athlete) this.athlete.rotation.x = Math.PI / 2;
  }

  private endRide(shore: boolean): void {
    this.phase = "paddle";
    this.waveT = 2.5;
    const bonus = Math.round(this.rideT * 6);
    this.styleGain(bonus, shore ? "shore ride-out" : "ride");
    this.toast(shore ? `🌊 Rode it to the beach! +${bonus} style` : "Wave fizzled out.");
    if (this.athlete) { this.athlete.rotation.x = 0; this.athlete.rotation.z = 0; }
  }
}
