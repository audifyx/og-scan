import * as THREE from "three";

/**
 * OrbitX City — dynamic weather + atmosphere.
 *
 * Instanced-feel rain (LineSegments, CPU-updated, wrapped in a box around the
 * player), splash ripple rings on the street, drifting fog banks, and
 * occasional lightning (storm mode) with a thunder callback the world wires
 * to the synthesized GameAudio.thunder().
 *
 * Phone-safe: one draw call for all rain, one instanced mesh for splashes,
 * six fog sprites, one flash light. No postprocessing.
 */

export type WeatherMode = "clear" | "drizzle" | "rain" | "storm";

export const WEATHER_MODES: WeatherMode[] = ["clear", "drizzle", "rain", "storm"];

interface ModeCfg {
  drops: number;
  fallSpeed: number;
  splashRate: number; // splashes per second
  fogDensity: number;
  wetness: number; // 0..1 — world ramps streak reflections with this
  rainGain: number; // 0..1 — ambient rain audio level
  lightning: boolean;
}

const CFG: Record<WeatherMode, ModeCfg> = {
  clear:   { drops: 0,    fallSpeed: 0,  splashRate: 0,  fogDensity: 0.020, wetness: 0.30, rainGain: 0,    lightning: false },
  drizzle: { drops: 450,  fallSpeed: 15, splashRate: 12, fogDensity: 0.028, wetness: 0.55, rainGain: 0.25, lightning: false },
  rain:    { drops: 950,  fallSpeed: 19, splashRate: 30, fogDensity: 0.035, wetness: 0.80, rainGain: 0.6,  lightning: false },
  storm:   { drops: 1400, fallSpeed: 25, splashRate: 55, fogDensity: 0.043, wetness: 1.0,  rainGain: 1.0,  lightning: true  },
};

const MAX_DROPS = 1400;
const RAIN_W = 44; // box around player
const RAIN_H = 16;

export class CityWeather {
  mode: WeatherMode = "drizzle";
  wetness = CFG.drizzle.wetness;
  rainGain = CFG.drizzle.rainGain;
  fogDensity = CFG.drizzle.fogDensity;

  private scene: THREE.Scene;
  private rainGeo!: THREE.BufferGeometry;
  private rainPos!: Float32Array;
  private rainMesh!: THREE.LineSegments;
  private splash!: THREE.InstancedMesh;
  private splashLife!: Float32Array;
  private splashTimer = 0;
  private fogSprites: THREE.Sprite[] = [];
  private flash!: THREE.DirectionalLight;
  private flashT = 0;
  private flashPulses = 0;
  private nextBolt = 8;
  private baseBg = new THREE.Color(0x05070d);
  private tmp = new THREE.Object3D();
  private onLightning: (() => void) | null = null;
  private disposed = false;

  constructor(scene: THREE.Scene, onLightning?: () => void) {
    this.scene = scene;
    this.onLightning = onLightning ?? null;

    // ── rain streaks (single LineSegments draw call) ──
    this.rainGeo = new THREE.BufferGeometry();
    this.rainPos = new Float32Array(MAX_DROPS * 2 * 3);
    this.rainGeo.setAttribute("position", new THREE.BufferAttribute(this.rainPos, 3));
    const rainMat = new THREE.LineBasicMaterial({
      color: 0x8fb4d8, transparent: true, opacity: 0.34, depthWrite: false,
    });
    this.rainMesh = new THREE.LineSegments(this.rainGeo, rainMat);
    this.rainMesh.frustumCulled = false;
    this.rainMesh.visible = false;
    scene.add(this.rainMesh);

    // ── splash ripples (instanced rings) ──
    const ringGeo = new THREE.RingGeometry(0.06, 0.14, 10);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x9fc4e8, transparent: true, opacity: 0.4,
      side: THREE.DoubleSide, depthWrite: false,
    });
    this.splash = new THREE.InstancedMesh(ringGeo, ringMat, 70);
    this.splash.frustumCulled = false;
    this.splash.visible = false;
    for (let i = 0; i < 70; i++) {
      this.tmp.position.set(0, -10, 0);
      this.tmp.scale.setScalar(0.001);
      this.tmp.updateMatrix();
      this.splash.setMatrixAt(i, this.tmp.matrix);
    }
    this.splashLife = new Float32Array(70); // remaining life, 0 = dead
    scene.add(this.splash);

    // ── drifting fog banks ──
    const fogTex = this.makeFogTexture();
    for (let i = 0; i < 6; i++) {
      const sm = new THREE.SpriteMaterial({
        map: fogTex, color: 0x6a7f9e, transparent: true,
        opacity: 0.10 + Math.random() * 0.06, depthWrite: false,
      });
      const sp = new THREE.Sprite(sm);
      sp.scale.set(26 + Math.random() * 18, 9 + Math.random() * 5, 1);
      sp.position.set((Math.random() - 0.5) * 70, 2.5 + Math.random() * 3, (Math.random() - 0.5) * 70);
      sp.userData.vx = 0.25 + Math.random() * 0.4;
      this.fogSprites.push(sp);
      scene.add(sp);
    }

    // ── lightning flash light ──
    this.flash = new THREE.DirectionalLight(0xcfe4ff, 0);
    this.flash.position.set(30, 60, -20);
    scene.add(this.flash);
  }

  private makeFogTexture(): THREE.Texture {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const ctx = c.getContext("2d")!;
    const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
    g.addColorStop(0, "rgba(255,255,255,0.85)");
    g.addColorStop(0.55, "rgba(255,255,255,0.28)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    return tex;
  }

  setMode(m: WeatherMode): void {
    this.mode = m;
  }

  /** True while a lightning flash is strobing (day/night should not fight it). */
  get flashActive(): boolean {
    return this.flashT > 0;
  }

  /** Seed rain positions around the player (call once when rain starts). */
  private seedRain(cx: number, cz: number): void {
    const n = CFG[this.mode].drops;
    for (let i = 0; i < n; i++) {
      const x = cx + (Math.random() - 0.5) * RAIN_W;
      const y = Math.random() * RAIN_H;
      const z = cz + (Math.random() - 0.5) * RAIN_W;
      this.writeDrop(i, x, y, z);
    }
    this.rainGeo.setDrawRange(0, n * 2);
    (this.rainGeo.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
  }

  private writeDrop(i: number, x: number, y: number, z: number): void {
    const o = i * 6;
    const len = 0.55;
    this.rainPos[o] = x;     this.rainPos[o + 1] = y;         this.rainPos[o + 2] = z;
    this.rainPos[o + 3] = x; this.rainPos[o + 4] = y + len;    this.rainPos[o + 5] = z;
  }

  update(dt: number, player: THREE.Vector3, time: number): void {
    if (this.disposed) return;
    const cfg = CFG[this.mode];

    // smooth wetness / gain / fog toward mode targets
    const k = Math.min(1, dt * 0.8);
    this.wetness += (cfg.wetness - this.wetness) * k;
    this.rainGain += (cfg.rainGain - this.rainGain) * k;
    this.fogDensity += (cfg.fogDensity - this.fogDensity) * k;

    // ── rain ──
    const n = cfg.drops;
    const wasVisible = this.rainMesh.visible;
    this.rainMesh.visible = n > 0;
    this.splash.visible = n > 0;
    if (n > 0) {
      if (!wasVisible) this.seedRain(player.x, player.z);
      const pos = this.rainPos;
      const spd = cfg.fallSpeed;
      for (let i = 0; i < n; i++) {
        const o = i * 6;
        let y = pos[o + 1] - spd * dt;
        if (y < 0) {
          y = RAIN_H * (0.7 + Math.random() * 0.3);
          pos[o] = player.x + (Math.random() - 0.5) * RAIN_W;
          pos[o + 2] = player.z + (Math.random() - 0.5) * RAIN_W;
        }
        this.writeDrop(i, pos[o], y, pos[o + 2]);
      }
      this.rainGeo.setDrawRange(0, n * 2);
      (this.rainGeo.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;

      // ── splashes ──
      this.splashTimer -= dt;
      if (this.splashTimer <= 0) {
        this.splashTimer = 1 / Math.max(1, cfg.splashRate);
        for (let i = 0; i < 70; i++) {
          if (this.splashLife[i] <= 0) {
            this.splashLife[i] = 0.5;
            this.tmp.position.set(
              player.x + (Math.random() - 0.5) * RAIN_W * 0.8,
              0.04,
              player.z + (Math.random() - 0.5) * RAIN_W * 0.8,
            );
            this.tmp.scale.setScalar(0.25);
            this.tmp.rotation.set(-Math.PI / 2, 0, 0);
            this.tmp.updateMatrix();
            this.splash.setMatrixAt(i, this.tmp.matrix);
            break;
          }
        }
      }
      let dirty = false;
      for (let i = 0; i < 70; i++) {
        if (this.splashLife[i] > 0) {
          this.splashLife[i] -= dt;
          const life = Math.max(0, this.splashLife[i] / 0.5); // 1→0
          this.splash.getMatrixAt(i, this.tmp.matrix);
          this.tmp.matrix.decompose(this.tmp.position, this.tmp.quaternion, this.tmp.scale);
          const s = 0.25 + (1 - life) * 1.1;
          this.tmp.scale.setScalar(Math.max(0.001, s * life + 0.001));
          this.tmp.position.y = 0.04;
          this.tmp.updateMatrix();
          this.splash.setMatrixAt(i, this.tmp.matrix);
          dirty = true;
        }
      }
      if (dirty) this.splash.instanceMatrix.needsUpdate = true;
    }

    // ── fog banks drift ──
    for (const sp of this.fogSprites) {
      sp.position.x += sp.userData.vx * dt;
      if (sp.position.x > 42) sp.position.x = -42;
      (sp.material as THREE.SpriteMaterial).opacity =
        0.07 + this.wetness * 0.09 + Math.sin(time * 0.4 + sp.position.z) * 0.02;
    }

    // ── lightning (storm only) ──
    if (cfg.lightning) {
      this.nextBolt -= dt;
      if (this.nextBolt <= 0) {
        this.nextBolt = 5 + Math.random() * 9;
        this.flashT = 0.55;
        this.flashPulses = 2 + Math.floor(Math.random() * 2);
        if (this.onLightning) {
          const delay = 400 + Math.random() * 1800;
          window.setTimeout(() => this.onLightning && this.onLightning(), delay);
        }
      }
    }
    if (this.flashT > 0) {
      this.flashT -= dt;
      const env = Math.max(0, this.flashT / 0.55);
      // strobe: 2-3 pulses
      const pulse = Math.abs(Math.sin(env * Math.PI * this.flashPulses * 2));
      this.flash.intensity = pulse * env * 90;
      this.scene.background = new THREE.Color(0x05070d).lerp(new THREE.Color(0x33415e), pulse * env * 0.55);
    } else {
      this.flash.intensity = 0;
    }
  }

  dispose(): void {
    this.disposed = true;
    this.scene.remove(this.rainMesh, this.splash, this.flash);
    for (const sp of this.fogSprites) this.scene.remove(sp);
    this.rainGeo.dispose();
    (this.rainMesh.material as THREE.Material).dispose();
    (this.splash.material as THREE.Material).dispose();
    this.splash.geometry.dispose();
  }
}
