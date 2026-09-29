import * as THREE from "three";
import { buildCity, HALF, type CityData, type Collider } from "./CityBuilder";
import { createHumanoid, PED_COLORS, type Humanoid } from "./Humanoid";
import {
  createCarMesh, createTrafficCar, updateTrafficCar, resolveCircleColliders,
  CarPhysics, type CarMesh, type TrafficCar, type DriveInput,
} from "./Vehicle";
import type { InputState } from "./input";
import type { GameAudio } from "./audio";

export interface HudState {
  speedKmh: number;
  inCar: boolean;
  nearCar: boolean;
  clock: string;
  isNight: boolean;
}

export interface Quote { price: number; change24h: number }

export interface WorldOpts {
  canvas: HTMLCanvasElement;
  minimap: HTMLCanvasElement;
  input: InputState;
  audio: GameAudio;
  quality: "high" | "low";
  onHud: (h: HudState) => void;
}

interface Drivable { mesh: CarMesh; phys: CarPhysics; taken: boolean }
interface Ped { h: Humanoid; pos: THREE.Vector3; target: THREE.Vector3; speed: number }

const DAY_LENGTH = 360; // seconds per full day

export class GTAWorld {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private city: CityData;
  private input: InputState;
  private audio: GameAudio;
  private onHud: WorldOpts["onHud"];
  private minimap: HTMLCanvasElement;
  private clock = new THREE.Clock();
  private raf = 0;
  private disposed = false;
  private paused = false;
  private time = 0;
  private dayT = 0.3;

  // player
  private player!: Humanoid;
  private pPos = new THREE.Vector3();
  private pVel = new THREE.Vector3();
  private pHeading = 0;
  private pVy = 0;
  private onGround = true;

  // camera orbit
  private camYaw = 0;
  private camPitch = 0.32;
  private camDist = 8;
  private lastDragT = 0;
  private dragDX = 0;
  private dragDY = 0;

  // cars
  private drivables: Drivable[] = [];
  private traffic: TrafficCar[] = [];
  private inCar: Drivable | null = null;
  private peds: Ped[] = [];

  // lights
  private sun!: THREE.DirectionalLight;
  private hemi!: THREE.HemisphereLight;
  private headlight: THREE.SpotLight | null = null;

  private hudT = 0;
  private mmT = 0;
  private lastHud: HudState | null = null;

  constructor(opts: WorldOpts) {
    this.input = opts.input;
    this.audio = opts.audio;
    this.onHud = opts.onHud;
    this.minimap = opts.minimap;

    this.renderer = new THREE.WebGLRenderer({ canvas: opts.canvas, antialias: opts.quality === "high" });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    if (opts.quality === "high") {
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.1, 2000);

    this.city = buildCity();
    this.scene.add(this.city.group);
    this.scene.fog = new THREE.Fog(0x0a0e16, 180, 900);

    // lights
    this.sun = new THREE.DirectionalLight(0xffffff, 2.2);
    this.sun.castShadow = opts.quality === "high";
    this.sun.shadow.mapSize.set(1024, 1024);
    const sc = this.sun.shadow.camera;
    sc.left = -220; sc.right = 220; sc.top = 220; sc.bottom = -220; sc.far = 800;
    this.scene.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight(0x8fb4dd, 0x1a1410, 0.7);
    this.scene.add(this.hemi);
    this.scene.add(new THREE.AmbientLight(0x223044, 0.5));

    // player
    this.player = createHumanoid({ shirt: 0x00c98a, pants: 0x23262e });
    this.pPos.set(this.city.spawn.x, 0, this.city.spawn.z);
    this.pHeading = this.city.spawn.heading;
    this.camYaw = this.pHeading + Math.PI;
    this.scene.add(this.player.group);

    // parked drivable cars
    for (const p of this.city.parked.slice(0, 10)) {
      const mesh = createCarMesh();
      mesh.group.position.set(p.x, 0, p.z);
      mesh.group.rotation.y = p.heading;
      this.scene.add(mesh.group);
      this.drivables.push({ mesh, phys: new CarPhysics(p.x, p.z, p.heading), taken: false });
    }

    // traffic
    for (let i = 0; i < 8; i++) {
      const ci = 1 + Math.floor(Math.random() * 4);
      const cj = 1 + Math.floor(Math.random() * 4);
      const dir = Math.floor(Math.random() * 4);
      const ni = Math.min(5, Math.max(0, ci + (dir === 0 ? 1 : dir === 1 ? -1 : 0)));
      const nj = Math.min(5, Math.max(0, cj + (dir === 2 ? 1 : dir === 3 ? -1 : 0)));
      if (ni === ci && nj === cj) continue;
      const car = createTrafficCar(this.city.nodes, ci, cj, ni, nj);
      this.scene.add(car.mesh.group);
      this.traffic.push(car);
    }

    // pedestrians
    for (let i = 0; i < 10; i++) {
      const h = createHumanoid(PED_COLORS[i % PED_COLORS.length]);
      const pos = this.randomSidewalk();
      h.group.position.copy(pos);
      this.scene.add(h.group);
      this.peds.push({ h, pos, target: this.randomSidewalk(), speed: 1.2 + Math.random() * 0.8 });
    }

    this.resize();
    window.addEventListener("resize", this.resize);
    this.loop();
  }

  /** External camera-orbit deltas from pointer drag. */
  addOrbit(dx: number, dy: number) {
    this.dragDX += dx;
    this.dragDY += dy;
    this.lastDragT = this.time;
  }

  /** Grappling-hook pull: add an external velocity impulse to the player. */
  addPlayerVelocity(v: THREE.Vector3) {
    this.pVel.add(v);
  }

  setPaused(b: boolean) {
    this.paused = b;
    if (b) this.audio.engineLevel(0, false);
  }

  updatePrices(quotes: Record<string, Quote>) {
    const arr = Object.entries(quotes)
      .filter(([, q]) => q.price > 0)
      .sort((a, b) => Math.abs(b[1].change24h) - Math.abs(a[1].change24h))
      .slice(0, 3);
    this.city.billboards.forEach((bb, i) => {
      if (i === 0) {
        bb.face.draw([
          { text: "ORBITX CITY", color: "#00ff9f", big: true },
          { text: "LIVE MARKET DATA", color: "#8fb4dd" },
        ]);
      } else {
        const [sym, q] = arr[i - 1] ?? [];
        if (sym && q) {
          const up = q.change24h >= 0;
          bb.face.draw([
            { text: sym, color: "#ffffff", big: true },
            { text: `$${fmtP(q.price)}  ${up ? "+" : ""}${q.change24h.toFixed(1)}%`, color: up ? "#00ff9f" : "#ff6b6b" },
          ]);
        }
      }
    });
  }

  toggleEnterExit() {
    if (this.inCar) {
      // exit: place player beside car
      const c = this.inCar;
      const sx = c.phys.pos.x + Math.cos(c.phys.heading) * 2.6;
      const sz = c.phys.pos.z - Math.sin(c.phys.heading) * 2.6;
      this.pPos.set(sx, 0, sz);
      this.pVel.set(0, 0, 0);
      c.phys.speed = 0;
      this.player.group.visible = true;
      this.inCar = null;
      this.audio.door();
      this.audio.engineLevel(0, false);
      if (this.headlight) { this.headlight.visible = false; }
      return;
    }
    let best: Drivable | null = null;
    let bd = 4.5;
    for (const d of this.drivables) {
      if (d.taken) continue;
      const dist = d.phys.pos.distanceTo(this.pPos);
      if (dist < bd) { bd = dist; best = d; }
    }
    if (best) {
      best.taken = true;
      this.inCar = best;
      this.player.group.visible = false;
      this.audio.door();
      this.audio.engineStart();
    }
  }

  get nearCar(): boolean {
    if (this.inCar) return true;
    for (const d of this.drivables) {
      if (!d.taken && d.phys.pos.distanceTo(this.pPos) < 4.5) return true;
    }
    return false;
  }

  /** Public read-only snapshot for module teams (missions, jobs, police…). */
  getPlayerState() {
    const car = this.inCar;
    return {
      onFoot: !car,
      pos: (car ? car.phys.pos : this.pPos).clone(),
      heading: car ? car.phys.heading : this.pHeading,
      speed: car ? Math.abs(car.phys.speed) : Math.hypot(this.pVel.x, this.pVel.z),
      speedKmh: car ? Math.abs(car.phys.speed) * 3.6 : 0,
      dayT: this.dayT,
      isNight: Math.sin((this.dayT - 0.25) * Math.PI * 2) < -0.08,
    };
  }

  /** Teleport the player (used by missions/interiors). Exits vehicle first. */
  teleport(x: number, z: number, heading?: number) {
    if (this.inCar) this.toggleEnterExit();
    this.pPos.set(x, 0, z);
    this.pVel.set(0, 0, 0);
    if (heading !== undefined) {
      this.pHeading = heading;
      this.camYaw = heading + Math.PI;
    }
  }

  /** Direct access to the Three.js scene for module teams (additive only). */
  get sceneRef(): THREE.Scene {
    return this.scene;
  }

  /** Direct access to the follow camera for module teams (raycasts, scanner). */
  get cameraRef(): THREE.PerspectiveCamera {
    return this.camera;
  }

  /** Collision boxes for module teams (ambient AI pathing). */
  get collidersRef(): Collider[] {
    return this.city.colliders;
  }

  private randomSidewalk(): THREE.Vector3 {
    const i = Math.floor(Math.random() * 6);
    const j = Math.floor(Math.random() * 6);
    const n = this.city.nodes[i][j];
    return new THREE.Vector3(
      n.x + (Math.random() - 0.5) * 20,
      0,
      n.z + (Math.random() - 0.5) * 20,
    );
  }

  private resize = () => {
    const c = this.renderer.domElement;
    const r = c.getBoundingClientRect();
    const w = Math.max(1, r.width), h = Math.max(1, r.height);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, this.clock.getDelta());
    if (!this.paused) {
      this.time += dt;
      this.dayT = (this.dayT + dt / DAY_LENGTH) % 1;
      this.update(dt);
    }
    this.renderer.render(this.scene, this.camera);
  };

  private update(dt: number) {
    const inp = this.input;
    if (inp.action) {
      inp.action = false;
      this.toggleEnterExit();
    }
    // camera orbit from drag
    this.camYaw -= this.dragDX * 0.004;
    this.camPitch = Math.min(1.1, Math.max(0.08, this.camPitch + this.dragDY * 0.003));
    this.dragDX = 0; this.dragDY = 0;

    if (this.inCar) this.updateDriving(dt);
    else this.updateOnFoot(dt);

    this.updateTraffic(dt);
    this.updatePeds(dt);
    this.updateDayNight();
    this.updateCamera(dt);
    this.updateHud(dt);
    this.drawMinimap(dt);
  }

  private updateOnFoot(dt: number) {
    const inp = this.input;
    const mx = inp.moveX, my = inp.moveY;
    const moving = Math.hypot(mx, my) > 0.08;
    const sprint = inp.sprint && my > 0.1;
    const speed = sprint ? 9.5 : 5.2;

    if (moving) {
      // move relative to camera yaw
      const wish = Math.atan2(mx, my) + this.camYaw + Math.PI;
      let dh = wish - this.pHeading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      this.pHeading += dh * Math.min(1, dt * 10);
      const tx = Math.sin(this.pHeading) * speed;
      const tz = Math.cos(this.pHeading) * speed;
      this.pVel.x += (tx - this.pVel.x) * Math.min(1, dt * 10);
      this.pVel.z += (tz - this.pVel.z) * Math.min(1, dt * 10);
      // auto-align camera behind when not recently dragged
      if (this.time - this.lastDragT > 2.2) {
        let dy = (this.pHeading + Math.PI) - this.camYaw;
        while (dy > Math.PI) dy -= Math.PI * 2;
        while (dy < -Math.PI) dy += Math.PI * 2;
        this.camYaw += dy * Math.min(1, dt * 1.6);
      }
    } else {
      this.pVel.x *= Math.max(0, 1 - dt * 10);
      this.pVel.z *= Math.max(0, 1 - dt * 10);
    }

    // jump / gravity
    if (inp.jump && this.onGround) {
      this.pVy = 5.2;
      this.onGround = false;
      inp.jump = false;
    }
    this.pVy -= 14 * dt;
    let ny = this.pPos.y + this.pVy * dt;
    if (ny <= 0) { ny = 0; this.pVy = 0; this.onGround = true; }

    this.pPos.x += this.pVel.x * dt;
    this.pPos.z += this.pVel.z * dt;
    this.pPos.y = ny;
    // clamp to world
    this.pPos.x = Math.max(-HALF - 40, Math.min(HALF + 40, this.pPos.x));
    this.pPos.z = Math.max(-HALF - 40, Math.min(HALF + 40, this.pPos.z));
    resolveCircleColliders(this.pPos, 0.55, this.city.colliders);

    this.player.group.position.copy(this.pPos);
    this.player.group.rotation.y = this.pHeading;
    const spd01 = Math.min(1, Math.hypot(this.pVel.x, this.pVel.z) / 9.5);
    this.player.update(dt, this.onGround ? spd01 : 0.15);
  }

  private updateDriving(dt: number) {
    const car = this.inCar;
    if (!car) return;
    const inp = this.input;
    const drive: DriveInput = {
      throttle: inp.moveY,
      steer: -inp.moveX,
      handbrake: inp.handbrake || inp.jump,
    };
    const { crashed } = car.phys.update(dt, drive, this.city.colliders);
    if (crashed && Math.abs(car.phys.speed) > 6) this.audio.crash();
    car.mesh.group.position.copy(car.phys.pos);
    car.mesh.group.rotation.y = car.phys.heading;
    const spin = car.phys.speed * dt * 2.6;
    car.mesh.wheels.forEach((w) => { w.rotation.x += spin; });
    // brake lights
    car.mesh.taillightMat.emissiveIntensity = inp.moveY < -0.1 ? 2.2 : 0.5;
    this.audio.engineLevel(Math.min(1, Math.abs(car.phys.speed) / car.phys.maxSpeed), true);
    this.camDist += (11 - this.camDist) * Math.min(1, dt * 3);
  }

  private updateTraffic(dt: number) {
    const others = [
      ...this.traffic.map((c) => c.phys),
      ...this.drivables.map((d) => d.phys),
    ];
    for (const car of this.traffic) updateTrafficCar(car, dt, this.city.nodes, others);
  }

  private updatePeds(dt: number) {
    for (const p of this.peds) {
      const to = new THREE.Vector3().subVectors(p.target, p.pos);
      to.y = 0;
      const dist = to.length();
      if (dist < 1.5) {
        p.target = this.randomSidewalk();
        continue;
      }
      to.normalize();
      p.pos.addScaledVector(to, p.speed * dt);
      p.h.group.position.copy(p.pos);
      p.h.group.rotation.y = Math.atan2(to.x, to.z);
      p.h.update(dt, 0.45);
    }
  }

  private updateDayNight() {
    const t = this.dayT; // 0 = midnight
    const sunA = (t - 0.25) * Math.PI * 2; // sunrise at t=0.25
    const elev = Math.sin(sunA);
    const night = Math.max(0, Math.min(1, -elev * 2.2));
    const day = Math.max(0, Math.min(1, elev * 2.5));

    this.sun.position.set(Math.cos(sunA) * 400, Math.max(20, elev * 400), 160);
    this.sun.intensity = 0.15 + day * 2.2;
    this.sun.color.setHSL(0.12, 0.5, 0.5 + day * 0.35);
    this.hemi.intensity = 0.25 + day * 0.55;
    // sky
    const sky = new THREE.Color().setHSL(0.6, 0.5, 0.04 + day * 0.32 - night * 0.015);
    if (Math.abs(elev) < 0.25) sky.setHSL(0.05, 0.55, 0.16); // dusk tint
    this.scene.background = sky;
    (this.scene.fog as THREE.Fog).color.copy(sky).multiplyScalar(1.05);
    // lamps + windows
    for (const m of this.city.lampMats) m.emissiveIntensity = night * 2.4;
    for (const m of this.city.windowMats) m.emissiveIntensity = night * 1.5;
    // player headlights at night
    if (this.inCar) {
      const cm = this.inCar.mesh;
      cm.headlightMat.emissiveIntensity = night > 0.4 ? 2.5 : 0.4;
      if (night > 0.4 && !this.headlight) {
        this.headlight = new THREE.SpotLight(0xcfe6ff, 60, 60, 0.5, 0.4, 1.2);
        this.headlight.position.set(0, 1.4, 2.6);
        cm.group.add(this.headlight);
        this.headlight.target.position.set(0, 0, 30);
        cm.group.add(this.headlight.target);
      }
      if (this.headlight) this.headlight.visible = night > 0.4;
    }
  }

  private updateCamera(dt: number) {
    const focus = this.inCar ? this.inCar.phys.pos : this.pPos;
    const baseYaw = this.inCar ? this.inCar.phys.heading + Math.PI : this.camYaw;
    // when driving and no recent drag, keep camera behind car
    let yaw = baseYaw;
    if (this.inCar && this.time - this.lastDragT > 2.5 && Math.abs(this.inCar.phys.speed) > 3) {
      let dy = (this.inCar.phys.heading + Math.PI) - this.camYaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      this.camYaw += dy * Math.min(1, dt * 2.2);
      yaw = this.camYaw;
    }
    const dist = this.inCar ? this.camDist : 8;
    const pitch = this.camPitch;
    const cx = focus.x + Math.sin(yaw) * Math.cos(pitch) * dist;
    const cz = focus.z + Math.cos(yaw) * Math.cos(pitch) * dist;
    const cy = focus.y + 1.6 + Math.sin(pitch) * dist;
    this.camera.position.set(cx, Math.max(1.2, cy), cz);
    this.camera.lookAt(focus.x, focus.y + 1.5, focus.z);
    if (!this.inCar) this.camDist += (8 - this.camDist) * Math.min(1, dt * 3);
  }

  private updateHud(dt: number) {
    this.hudT += dt;
    if (this.hudT < 0.2) return;
    this.hudT = 0;
    const t = this.dayT;
    const hh = Math.floor(t * 24);
    const mm = Math.floor((t * 24 - hh) * 60);
    const h: HudState = {
      speedKmh: this.inCar ? Math.abs(this.inCar.phys.speed) * 3.6 : 0,
      inCar: !!this.inCar,
      nearCar: this.nearCar,
      clock: `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`,
      isNight: Math.sin((t - 0.25) * Math.PI * 2) < -0.08,
    };
    const l = this.lastHud;
    if (!l || l.speedKmh !== Math.round(h.speedKmh) || l.inCar !== h.inCar || l.nearCar !== h.nearCar || l.clock !== h.clock || l.isNight !== h.isNight) {
      this.lastHud = h;
      this.onHud(h);
    }
  }

  private drawMinimap(dt: number) {
    this.mmT += dt;
    if (this.mmT < 0.3) return;
    this.mmT = 0;
    const c = this.minimap;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const S = c.width;
    const k = S / (HALF * 2 + 80);
    const px = (x: number) => S / 2 + x * k;
    ctx.fillStyle = "rgba(5,8,14,0.85)";
    ctx.fillRect(0, 0, S, S);
    // roads
    ctx.strokeStyle = "#3d4657";
    ctx.lineWidth = Math.max(1, 14 * k);
    for (let i = 0; i <= 5; i++) {
      const n0 = this.city.nodes[i][0], n1 = this.city.nodes[i][5];
      ctx.beginPath(); ctx.moveTo(px(n0.x), px(n0.z)); ctx.lineTo(px(n1.x), px(n1.z)); ctx.stroke();
      const m0 = this.city.nodes[0][i], m1 = this.city.nodes[5][i];
      ctx.beginPath(); ctx.moveTo(px(m0.x), px(m0.z)); ctx.lineTo(px(m1.x), px(m1.z)); ctx.stroke();
    }
    // cars
    ctx.fillStyle = "#e8c33a";
    for (const d of this.drivables) {
      ctx.beginPath(); ctx.arc(px(d.phys.pos.x), px(d.phys.pos.z), 2.4, 0, Math.PI * 2); ctx.fill();
    }
    // player arrow
    const p = this.inCar ? this.inCar.phys.pos : this.pPos;
    const hd = this.inCar ? this.inCar.phys.heading : this.pHeading;
    ctx.save();
    ctx.translate(px(p.x), px(p.z));
    ctx.rotate(Math.atan2(Math.sin(hd), -Math.cos(hd)) + Math.PI);
    ctx.fillStyle = "#00ff9f";
    ctx.beginPath();
    ctx.moveTo(0, -6); ctx.lineTo(4.4, 5); ctx.lineTo(-4.4, 5);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    // north + border
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 1;
    ctx.strokeRect(1, 1, S - 2, S - 2);
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "10px system-ui";
    ctx.fillText("N", S / 2 - 3, 12);
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.resize);
    this.audio.engineStop();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.geometry.dispose();
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        mats.forEach((x) => x.dispose());
      }
    });
    this.player.dispose();
    this.drivables.forEach((d) => d.mesh.dispose());
    this.traffic.forEach((t) => t.mesh.dispose());
    this.peds.forEach((p) => p.h.dispose());
    this.renderer.dispose();
  }
}

function fmtP(p: number): string {
  if (p >= 100) return p.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (p >= 1) return p.toFixed(3);
  return p.toPrecision(4);
}
