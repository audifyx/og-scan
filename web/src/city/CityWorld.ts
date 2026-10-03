import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { buildRig, type CityRig } from "./CityRig";
import { getStyle, getCityPoints, addCityPoints } from "./cityState";
import { resolveCircleColliders } from "./core/Vehicle";
import type { InputState } from "./core/input";
import type { GameAudio } from "./core/audio";

/**
 * OrbitX City (rebuild) — one night block traced from the reference boards.
 *
 * Layout (x right, z toward viewer/south, y up), block ~±32:
 *   street.glb at origin (road plane y=0, crosswalk, tree, 2 lamps, signal)
 *   shop     (-13,-17) door gap 2.4w×3.2h on the +z face → walkable interior
 *   apartment (14,-16)   lobby (-15,15)   garage (15,16)
 *
 * Every building GLB 404 → procedural fallback (same footprint/colliders),
 * so the world is fully playable before sibling agents land the assets.
 *
 * Phone-safe: no EffectComposer, pixelRatio ≤ 2, ≤250 dust points,
 * glow via additive sprites, shadows off (blob shadow under player).
 */

export interface CityHudState {
  clock: string;
  cityPoints: number;
  speedKmh: number;
  isNight: boolean;
}

export interface Quote { price: number; change24h: number; marketCap?: number }

export interface CityWorldOpts {
  canvas: HTMLCanvasElement;
  minimap: HTMLCanvasElement;
  input: InputState;
  audio?: GameAudio | null;
  quality: "high" | "low";
  onHud: (h: CityHudState) => void;
}

interface Col { minX: number; maxX: number; minZ: number; maxZ: number }

const loader = new GLTFLoader();
const bldCache = new Map<string, Promise<THREE.Group | null>>();

function loadBuilding(name: string): Promise<THREE.Group | null> {
  const url = `/city/buildings/${name}.glb`;
  let p = bldCache.get(url);
  if (!p) {
    p = loader.loadAsync(url).then((g) => g.scene).catch(() => null);
    bldCache.set(url, p);
  }
  return p;
}

function findParts(root: THREE.Object3D, names: string[]): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  const lower = names.map((n) => n.toLowerCase());
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      const nm = (m.name || "").toLowerCase();
      if (lower.some((n) => nm.includes(n))) out.push(m);
    }
  });
  return out;
}

function uniqueMats(meshes: THREE.Mesh[]): THREE.MeshStandardMaterial[] {
  const set = new Set<THREE.MeshStandardMaterial>();
  for (const m of meshes) {
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    for (const x of mats) {
      const s = x as THREE.MeshStandardMaterial;
      if (s && s.isMeshStandardMaterial) set.add(s);
    }
  }
  return [...set];
}

function makeGlowTexture(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 2, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.25, "rgba(255,255,255,0.55)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  return t;
}

function makeNeonTexture(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 128;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#060a12";
  ctx.fillRect(0, 0, 512, 128);
  ctx.font = "bold 84px system-ui, sans-serif";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.shadowColor = "#17e6d4"; ctx.shadowBlur = 28;
  ctx.fillStyle = "#aef7ff";
  ctx.fillText("OrbitX", 256, 66);
  return new THREE.CanvasTexture(c);
}

function makeChartTexture(seed: number): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = 256; c.height = 160;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#070b13"; ctx.fillRect(0, 0, 256, 160);
  ctx.strokeStyle = "rgba(60,80,110,0.5)"; ctx.lineWidth = 1;
  for (let i = 1; i < 6; i++) { ctx.beginPath(); ctx.moveTo(0, i * 26); ctx.lineTo(256, i * 26); ctx.stroke(); }
  let y = 110;
  ctx.strokeStyle = "#22dd88"; ctx.lineWidth = 3; ctx.shadowColor = "#22dd88"; ctx.shadowBlur = 8;
  ctx.beginPath(); ctx.moveTo(0, y);
  let s = seed;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let x = 0; x <= 256; x += 8) {
    y += (rnd() - 0.42) * 22;
    y = Math.max(20, Math.min(140, y));
    ctx.lineTo(x, y);
  }
  ctx.stroke();
  return new THREE.CanvasTexture(c);
}

const tmpV = new THREE.Vector3();

export class CityWorld {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private input: InputState;
  private onHud: CityWorldOpts["onHud"];
  private minimap: HTMLCanvasElement;
  private clock = new THREE.Clock();
  private raf = 0;
  private disposed = false;
  private _paused = false;
  private time = 0;

  private colliders: Col[] = [];
  private glbRoots = new Set<THREE.Object3D>();
  private disposables: { dispose(): void }[] = [];

  // player
  private rig!: CityRig;
  private pPos = new THREE.Vector3(0, 0, 8);
  private pVel = new THREE.Vector3();
  private pHeading = Math.PI;
  private pVy = 0;
  private onGround = true;
  private blob!: THREE.Mesh;

  // camera
  private camYaw = Math.PI + Math.PI; // behind player (heading PI → camYaw = heading+PI)
  private camPitch = 0.32;
  private camDist = 8;
  private camPos = new THREE.Vector3();
  private camVel = new THREE.Vector3();
  private camInit = false;
  private pitchKick = 0;
  private lastDragT = -10;
  private dragDX = 0;
  private dragDY = 0;

  // atmosphere handles
  private lampMats: THREE.MeshStandardMaterial[] = [];
  private chartMats: THREE.MeshStandardMaterial[] = [];
  private signalMats: THREE.MeshStandardMaterial[] = [];
  private chartTex: THREE.Texture[] = [];
  private glowTex: THREE.Texture | null = null;

  // dust
  private dust!: THREE.Points;
  private dustVel!: Float32Array;

  // scan pulse
  private scanRing: THREE.Mesh | null = null;
  private scanT = 0;
  private scanUntil = -1;
  private scanCooldownUntil = 0;

  // hud / points
  private hudT = 0;
  private mmT = 0;
  private distAccum = 0;
  private cityPoints = 0;
  private lastClock = "";

  constructor(opts: CityWorldOpts) {
    this.input = opts.input;
    this.onHud = opts.onHud;
    this.minimap = opts.minimap;
    this.cityPoints = getCityPoints();

    this.renderer = new THREE.WebGLRenderer({ canvas: opts.canvas, antialias: opts.quality === "high" });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.1, 400);

    // ── night atmosphere (phone-safe: no postprocessing) ──
    this.scene.background = new THREE.Color(0x05070d);
    this.scene.fog = new THREE.FogExp2(0x05070d, 0.028);
    const hemi = new THREE.HemisphereLight(0x2a3a5f, 0x0a0c12, 0.55);
    const moon = new THREE.DirectionalLight(0x8fb4ff, 0.4);
    moon.position.set(-60, 90, 40);
    this.scene.add(hemi, moon);
    // warm interior light inside the shop
    const shopGlow = new THREE.PointLight(0xffb35c, 30, 20, 1.6);
    shopGlow.position.set(-13, 3.4, -17);
    this.scene.add(shopGlow);

    this.glowTex = makeGlowTexture();
    this.disposables.push(this.glowTex);

    // ── player rig (selected trader style; degen default) ──
    this.rig = buildRig(getStyle());
    this.rig.group.position.copy(this.pPos);
    this.rig.group.rotation.y = this.pHeading;
    this.scene.add(this.rig.group);

    // blob shadow
    const blobG = new THREE.CircleGeometry(0.42, 20);
    const blobM = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.42, depthWrite: false });
    this.blob = new THREE.Mesh(blobG, blobM);
    this.blob.rotation.x = -Math.PI / 2;
    this.blob.position.y = 0.02;
    this.scene.add(this.blob);
    this.disposables.push(blobG, blobM);

    // ── block: GLBs with procedural fallback ──
    void this.buildBlock();

    // ── dust motes ──
    const N = opts.quality === "high" ? 200 : 120;
    const pos = new Float32Array(N * 3);
    this.dustVel = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 70;
      pos[i * 3 + 1] = Math.random() * 10 + 0.5;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 70;
      this.dustVel[i * 3] = (Math.random() - 0.5) * 0.25;
      this.dustVel[i * 3 + 1] = -0.12 - Math.random() * 0.2;
      this.dustVel[i * 3 + 2] = (Math.random() - 0.5) * 0.25;
    }
    const dg = new THREE.BufferGeometry();
    dg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const dm = new THREE.PointsMaterial({ color: 0x9db8ff, size: 0.09, transparent: true, opacity: 0.45, depthWrite: false, sizeAttenuation: true });
    this.dust = new THREE.Points(dg, dm);
    this.scene.add(this.dust);
    this.disposables.push(dg, dm);

    this.resize();
    window.addEventListener("resize", this.resize);
    this.loop();
  }

  // ── surface useGtaGame expects ──────────────────────────────

  get paused(): boolean { return this._paused; }
  setPaused(b: boolean): void { this._paused = b; }

  addOrbit(dx: number, dy: number): void {
    this.dragDX += dx;
    this.dragDY += dy;
    this.lastDragT = this.time;
  }

  updatePrices(_quotes: Record<string, Quote>): void {
    // Charts read live price drift in a future pass; ticker stepping is ambient.
  }

  /** No cars in the rebuild — E does nothing. */
  toggleEnterExit(): void { /* noop */ }

  /** Velocity impulse (HOOK dash). */
  addPlayerVelocity(v: THREE.Vector3): void { this.pVel.add(v); }

  teleport(x: number, z: number, heading?: number): void {
    this.pPos.set(x, 0, z);
    this.pVel.set(0, 0, 0);
    if (heading !== undefined) {
      this.pHeading = heading;
      this.camYaw = heading + Math.PI;
    }
  }

  getPlayerState() {
    return {
      onFoot: true,
      pos: this.pPos.clone(),
      heading: this.pHeading,
      speed: Math.hypot(this.pVel.x, this.pVel.z),
      speedKmh: Math.hypot(this.pVel.x, this.pVel.z) * 3.6,
      dayT: 0.9,
      isNight: true,
    };
  }

  /** Integration hosts (systems/apps shells) mount against these. */
  get sceneRef(): THREE.Scene { return this.scene; }
  get cameraRef(): THREE.PerspectiveCamera { return this.camera; }
  get collidersRef(): Col[] { return this.colliders; }

  /** SCAN / PPS: expanding ring + minimap POI pop for 6s. */
  scanPulse(): void {
    if (this.time < this.scanCooldownUntil || this.disposed) return;
    this.scanCooldownUntil = this.time + 3;
    this.scanUntil = this.time + 6;
    if (this.scanRing) { this.scene.remove(this.scanRing); this.scanRing = null; }
    const g = new THREE.RingGeometry(0.9, 1.0, 48);
    const m = new THREE.MeshBasicMaterial({
      color: 0x17e6d4, transparent: true, opacity: 0.9,
      side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const ring = new THREE.Mesh(g, m);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(this.pPos.x, 0.08, this.pPos.z);
    this.scene.add(ring);
    this.scanRing = ring;
    this.scanT = 0;
    this.disposables.push(g, m);
  }

  // ── block construction ──────────────────────────────────────

  private tagGlb(root: THREE.Object3D): void {
    root.traverse((o) => { o.userData.oxcGlb = true; });
    this.glbRoots.add(root);
  }

  private addGlow(x: number, y: number, z: number, color: number, scale: number, opacity = 0.55): void {
    if (!this.glowTex) return;
    const sm = new THREE.SpriteMaterial({
      map: this.glowTex, color, transparent: true, opacity,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const sp = new THREE.Sprite(sm);
    sp.position.set(x, y, z);
    sp.scale.set(scale, scale, 1);
    this.scene.add(sp);
    this.disposables.push(sm);
  }

  private glowAtMesh(m: THREE.Mesh, color: number, scale: number, dy = 0): void {
    m.getWorldPosition(tmpV);
    this.addGlow(tmpV.x, tmpV.y + dy, tmpV.z, color, scale);
  }

  private box(w: number, h: number, d: number, color: number, rough = 0.85, metal = 0): THREE.Mesh {
    const g = new THREE.BoxGeometry(w, h, d);
    const mt = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
    const mesh = new THREE.Mesh(g, mt);
    this.disposables.push(g, mt);
    return mesh;
  }

  private emissive(color: number, intensity: number): THREE.MeshStandardMaterial {
    const mt = new THREE.MeshStandardMaterial({ color: 0x0a0d14, emissive: color, emissiveIntensity: intensity, roughness: 0.6 });
    this.disposables.push(mt);
    return mt;
  }

  /** Wet-asphalt streak: elongated additive gradient plane under a light. */
  private streak(x: number, z: number, color: number, len = 7, w = 1.6): void {
    if (!this.glowTex) return;
    const sm = new THREE.MeshBasicMaterial({
      map: this.glowTex, color, transparent: true, opacity: 0.28,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, len), sm);
    p.rotation.x = -Math.PI / 2;
    p.position.set(x, 0.03, z + len * 0.25);
    this.scene.add(p);
    this.disposables.push(p.geometry, sm);
  }

  private async buildBlock(): Promise<void> {
    if (this.disposed) return;
    // street first (defines the ground), then buildings in parallel
    const street = await loadBuilding("street");
    if (this.disposed) return;
    if (street) this.mountGlb(street, 0, 0, 0, "street");
    else this.buildFallbackStreet();

    await Promise.all([
      this.placeBuilding("shop", -13, -17, 0, "shop"),
      this.placeBuilding("apartment", 14, -16, 0, "tower"),
      this.placeBuilding("lobby", -15, 15, 0, "lobby"),
      this.placeBuilding("garage", 15, 16, 0, "garage"),
    ]);
  }

  private async placeBuilding(name: string, x: number, z: number, rotY: number, kind: "shop" | "tower" | "lobby" | "garage"): Promise<void> {
    if (this.disposed) return;
    const glb = await loadBuilding(name);
    if (this.disposed) return;
    if (glb) {
      const inst = glb.clone(true);
      this.tagGlb(inst);
      inst.position.set(x, 0, z);
      inst.rotation.y = rotY;
      this.scene.add(inst);
      this.registerEmissive(inst, name, x, z);
    } else {
      if (kind === "shop") this.buildFallbackShop(x, z);
      else this.buildFallbackBlock(kind, x, z);
    }
    this.addColliders(kind, x, z);
  }

  private mountGlb(root: THREE.Group, x: number, y: number, z: number, name: string): void {
    const inst = root.clone(true);
    this.tagGlb(inst);
    inst.position.set(x, y, z);
    this.scene.add(inst);
    this.registerEmissive(inst, name, x, z);
  }

  /** Wire emissive parts (contractual names) into the animation system. */
  private registerEmissive(root: THREE.Object3D, name: string, bx: number, bz: number): void {
    void bx; void bz;
    for (const m of findParts(root, ["lampbulb"])) {
      const mats = uniqueMats([m]);
      this.lampMats.push(...mats);
      this.glowAtMesh(m, 0xffc873, 4.2);
      m.getWorldPosition(tmpV);
      this.streak(tmpV.x, tmpV.z, 0xffc873);
    }
    for (const m of findParts(root, ["neon"])) {
      this.glowAtMesh(m, 0x17e6d4, 6.5);
      m.getWorldPosition(tmpV);
      this.streak(tmpV.x, tmpV.z, 0x17e6d4, 9, 2.4);
    }
    const charts = findParts(root, ["chart1", "chart2"]);
    for (const m of charts) {
      const mats = uniqueMats([m]);
      for (const mt of mats) {
        mt.emissive = new THREE.Color(0x22dd88);
        mt.emissiveIntensity = 1.4;
      }
      this.chartMats.push(...mats);
    }
    for (const m of findParts(root, ["signal"])) {
      const mats = uniqueMats([m]);
      for (const mt of mats) {
        mt.emissive = new THREE.Color(0xff3b3b);
        mt.emissiveIntensity = 2.2;
      }
      this.signalMats.push(...mats);
      this.glowAtMesh(m, 0xff3b3b, 2.4);
    }
    // windows / interiorlight: leave their authored emissive, just register glow for neon-ish ones
    if (name === "shop") {
      for (const m of findParts(root, ["interiorlight"])) this.glowAtMesh(m, 0xffb35c, 5, -0.5);
    }
  }

  // ── procedural fallbacks (same footprints/colliders as the GLB kit) ──

  private buildFallbackStreet(): void {
    // wet asphalt: dark, low roughness, some metalness
    const g = new THREE.PlaneGeometry(70, 70);
    const m = new THREE.MeshStandardMaterial({ color: 0x11141a, roughness: 0.35, metalness: 0.6 });
    const road = new THREE.Mesh(g, m);
    road.rotation.x = -Math.PI / 2;
    this.scene.add(road);
    this.disposables.push(g, m);

    // crosswalk stripes (board 9)
    const stripeG = new THREE.BoxGeometry(1.2, 0.04, 4.5);
    const stripeM = new THREE.MeshStandardMaterial({ color: 0xd8dce4, roughness: 0.7 });
    this.disposables.push(stripeG, stripeM);
    for (let i = 0; i < 8; i++) {
      const s = new THREE.Mesh(stripeG, stripeM);
      s.position.set(-10.5 + i * 3, 0.02, 1);
      this.scene.add(s);
    }
    // center dashes
    const dashG = new THREE.BoxGeometry(2.2, 0.04, 0.28);
    this.disposables.push(dashG);
    for (let i = 0; i < 10; i++) {
      const d = new THREE.Mesh(dashG, stripeM);
      d.position.set(-27 + i * 6, 0.02, -8);
      this.scene.add(d);
    }

    // tree (board 9: one voxel tree)
    const trunk = this.box(0.5, 2.6, 0.5, 0x4a3524);
    trunk.position.set(26, 1.3, 2);
    const leafM = new THREE.MeshStandardMaterial({ color: 0x1f5c2e, roughness: 0.9 });
    this.disposables.push(leafM);
    const leafG = new THREE.IcosahedronGeometry(2.2, 0);
    this.disposables.push(leafG);
    const leaves = new THREE.Mesh(leafG, leafM);
    leaves.position.set(26, 4.4, 2);
    this.scene.add(trunk, leaves);
    this.colliders.push({ minX: 25.4, maxX: 26.6, minZ: 1.4, maxZ: 2.6 });

    // 2 lamps with flickering bulbs
    const lampPos: [number, number][] = [[-6, 8], [8, -6]];
    lampPos.forEach(([x, z], i) => {
      const pole = this.box(0.22, 5.2, 0.22, 0x23262e, 0.6, 0.4);
      pole.position.set(x, 2.6, z);
      const bulbMesh = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), this.emissive(0xffc873, 2.4));
      bulbMesh.name = `lampbulb${i}`;
      bulbMesh.position.set(x, 5.4, z);
      this.scene.add(pole, bulbMesh);
      this.disposables.push(bulbMesh.geometry);
      this.lampMats.push(bulbMesh.material as THREE.MeshStandardMaterial);
      this.addGlow(x, 5.4, z, 0xffc873, 4.2);
      this.streak(x, z, 0xffc873);
      this.colliders.push({ minX: x - 0.25, maxX: x + 0.25, minZ: z - 0.25, maxZ: z + 0.25 });
    });

    // traffic signal (alternates red/green every 4s)
    const post = this.box(0.18, 3.4, 0.18, 0x23262e, 0.6, 0.4);
    post.position.set(10, 1.7, 4);
    const sigMesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.9, 0.5), this.emissive(0xff3b3b, 2.2));
    sigMesh.name = "signal";
    sigMesh.position.set(10, 3.6, 4);
    this.scene.add(post, sigMesh);
    this.disposables.push(sigMesh.geometry);
    this.signalMats.push(sigMesh.material as THREE.MeshStandardMaterial);
    this.addGlow(10, 3.6, 4, 0xff3b3b, 2.4);
    this.colliders.push({ minX: 9.7, maxX: 10.3, minZ: 3.7, maxZ: 4.3 });
  }

  private buildFallbackShop(x: number, z: number): void {
    // footprint 14×10 centered (x,z), front wall at z+5 facing +z (street)
    const W = 14, D = 10, H = 6;
    const wall = 0x3a3f4c;
    const put = (mesh: THREE.Mesh, px: number, py: number, pz: number) => {
      mesh.position.set(px, py, pz);
      this.scene.add(mesh);
      return mesh;
    };
    // back / side walls
    put(this.box(W, H, 0.4, wall), x, H / 2, z - D / 2);
    put(this.box(0.4, H, D, wall), x - W / 2, H / 2, z);
    put(this.box(0.4, H, D, wall), x + W / 2, H / 2, z);
    // front wall with 2.4w × 3.2h door gap centered
    const segW = (W - 2.4) / 2;
    put(this.box(segW, H, 0.4, wall), x - 2.4 / 2 - segW / 2, H / 2, z + D / 2);
    put(this.box(segW, H, 0.4, wall), x + 2.4 / 2 + segW / 2, H / 2, z + D / 2);
    put(this.box(2.4, H - 3.2, 0.4, wall), x, 3.2 + (H - 3.2) / 2, z + D / 2); // lintel
    put(this.box(W + 0.4, 0.4, D + 0.4, 0x2a2e38), x, H + 0.2, z); // roof
    // interior floor (warm wood, board 5)
    const fg = new THREE.PlaneGeometry(W - 0.8, D - 0.8);
    const fm = new THREE.MeshStandardMaterial({ color: 0x9a7a52, roughness: 0.8 });
    const floor = new THREE.Mesh(fg, fm);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(x, 0.02, z);
    this.scene.add(floor);
    this.disposables.push(fg, fm);

    // neon OrbitX sign above the door (contractual "neon")
    const neonTex = makeNeonTexture();
    this.disposables.push(neonTex);
    const neonM = new THREE.MeshBasicMaterial({ map: neonTex });
    const neon = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 1.15), neonM);
    neon.name = "neon";
    neon.position.set(x, 4.7, z + D / 2 + 0.25);
    this.scene.add(neon);
    this.disposables.push(neon.geometry, neonM);
    this.addGlow(x, 4.7, z + D / 2 + 0.6, 0x17e6d4, 6.5);
    this.streak(x, z + D / 2 + 1.5, 0x17e6d4, 9, 2.4);

    // chart screens (contractual "chart1"/"chart2") — canvas textures, stepping ticker
    const mkChart = (name: string, px: number) => {
      const tex = makeChartTexture(px * 7919 + 13);
      tex.wrapS = THREE.RepeatWrapping;
      this.disposables.push(tex);
      this.chartTex.push(tex);
      const mt = new THREE.MeshStandardMaterial({ color: 0x05070c, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 1.1, roughness: 0.5 });
      this.disposables.push(mt);
      const cm = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.65), mt);
      cm.name = name;
      cm.position.set(px, 3.4, z - D / 2 + 0.25);
      this.scene.add(cm);
      this.disposables.push(cm.geometry);
      const frame = this.box(2.8, 1.85, 0.08, 0x14161c, 0.6);
      frame.position.set(px, 3.4, z - D / 2 + 0.18);
      this.scene.add(frame);
      this.chartMats.push(mt);
    };
    mkChart("chart1", x - 2.2);
    mkChart("chart2", x + 1.6);

    // counter + rug + plant (board 5)
    const counter = this.box(3.4, 1.0, 1.2, 0x6b4a2e, 0.7);
    counter.position.set(x - 2.5, 0.5, z - 1);
    this.scene.add(counter);
    const rugG = new THREE.PlaneGeometry(2.6, 1.8);
    const rugM = new THREE.MeshStandardMaterial({ color: 0x7a2a2a, roughness: 0.95 });
    const rug = new THREE.Mesh(rugG, rugM);
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(x, 0.04, z + 2);
    this.scene.add(rug);
    this.disposables.push(rugG, rugM);
    const plant = this.box(0.7, 1.1, 0.7, 0x2a6b3a, 0.9);
    plant.position.set(x - 5.5, 0.55, z - 2);
    this.scene.add(plant);

    // warm windows flanking the door
    const winM = this.emissive(0xffb35c, 1.6);
    const winG = new THREE.PlaneGeometry(2.2, 1.8);
    this.disposables.push(winG);
    for (const wx of [x - 4.6, x + 4.6]) {
      const wmesh = new THREE.Mesh(winG, winM);
      wmesh.name = "windows";
      wmesh.position.set(wx, 2.6, z + D / 2 + 0.22);
      this.scene.add(wmesh);
    }
  }

  private buildFallbackBlock(kind: "tower" | "lobby" | "garage", x: number, z: number): void {
    const dims = kind === "tower" ? [12, 17, 10] : kind === "lobby" ? [12, 7, 9] : [13, 5, 11];
    const [W, H, D] = dims;
    const body = this.box(W, H, D, kind === "tower" ? 0x2b2f3a : 0x33363f, 0.9);
    body.position.set(x, H / 2, z);
    this.scene.add(body);
    // emissive window grid on the street-facing side (contractual "windows")
    const winM = this.emissive(kind === "garage" ? 0x17e6d4 : 0xffb35c, 1.5);
    const cols = Math.floor(W / 2.2), rows = Math.floor(H / 2.6);
    const wg = new THREE.PlaneGeometry(1.1, 1.4);
    this.disposables.push(wg);
    // face toward origin (street): pick the side with min |coord|
    const faceZ = z > 0 ? z - D / 2 - 0.06 : z + D / 2 + 0.06;
    const rotY = z > 0 ? Math.PI : 0;
    for (let cxi = 0; cxi < cols; cxi++) {
      for (let ryi = 0; ryi < rows; ryi++) {
        if ((cxi * 7 + ryi * 3 + (x > 0 ? 1 : 0)) % 4 === 0) continue; // some dark windows
        const wmesh = new THREE.Mesh(wg, winM);
        wmesh.name = "windows";
        wmesh.position.set(x - W / 2 + 1.2 + cxi * 2.2, 2 + ryi * 2.6, faceZ);
        wmesh.rotation.y = rotY;
        this.scene.add(wmesh);
      }
    }
  }

  private addColliders(kind: "shop" | "tower" | "lobby" | "garage", x: number, z: number): void {
    const dims = kind === "shop" ? [14, 10] : kind === "tower" ? [12, 10] : kind === "lobby" ? [12, 9] : [13, 11];
    const [W, D] = dims;
    if (kind === "shop") {
      // walls with a walkable door gap: front wall z+D/2, gap 2.4w×3.2h centered
      const fz = z + D / 2, bz = z - D / 2, lx = x - W / 2, rx = x + W / 2;
      const segW = (W - 2.4) / 2;
      this.colliders.push(
        { minX: lx, maxX: rx, minZ: bz - 0.2, maxZ: bz + 0.2 },                       // back
        { minX: lx - 0.2, maxX: lx + 0.2, minZ: bz, maxZ: fz },                       // left
        { minX: rx - 0.2, maxX: rx + 0.2, minZ: bz, maxZ: fz },                       // right
        { minX: lx, maxX: x - 1.2, minZ: fz - 0.2, maxZ: fz + 0.2 },                  // front-left
        { minX: x + 1.2, maxX: rx, minZ: fz - 0.2, maxZ: fz + 0.2 },                  // front-right
        { minX: x - 4.2, maxX: x - 0.8, minZ: z - 1.6, maxZ: z - 0.4 },              // counter
      );
    } else {
      this.colliders.push({ minX: x - W / 2, maxX: x + W / 2, minZ: z - D / 2, maxZ: z + D / 2 });
    }
  }

  // ── loop ──────────────────────────────────────────────────────

  private resize = (): void => {
    const c = this.renderer.domElement;
    const r = c.getBoundingClientRect();
    const w = Math.max(1, r.width), h = Math.max(1, r.height);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };

  private loop = (): void => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, this.clock.getDelta());
    if (!this._paused) {
      this.time += dt;
      this.update(dt);
    }
    this.renderer.render(this.scene, this.camera);
  };

  private update(dt: number): void {
    const inp = this.input;
    const mx = inp.moveX, my = inp.moveY;
    const moving = Math.hypot(mx, my) > 0.08;
    const sprint = inp.sprint && my > 0.1;
    const speed = sprint ? 9.5 : 5.2;

    // camera orbit from drag
    this.camYaw -= this.dragDX * 0.004;
    this.camPitch = Math.min(1.1, Math.max(0.08, this.camPitch + this.dragDY * 0.003));
    this.dragDX = 0; this.dragDY = 0;

    const prevX = this.pPos.x, prevZ = this.pPos.z;

    if (moving) {
      const wish = Math.atan2(mx, my) + this.camYaw + Math.PI;
      let dh = wish - this.pHeading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      this.pHeading += dh * Math.min(1, dt * 10);
      const tx = Math.sin(this.pHeading) * speed;
      const tz = Math.cos(this.pHeading) * speed;
      const accel = Math.min(1, dt * 10);
      this.pVel.x += (tx - this.pVel.x) * accel;
      this.pVel.z += (tz - this.pVel.z) * accel;
      // yaw lerps toward heading+PI when idle 2.2s (ported feel)
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
    const wasAir = !this.onGround;
    this.pVy -= 14 * dt;
    let ny = this.pPos.y + this.pVy * dt;
    if (ny <= 0) {
      if (wasAir && this.pVy < -3) this.pitchKick = Math.min(0.09, 0.03 - this.pVy * 0.008); // landing dip
      ny = 0; this.pVy = 0; this.onGround = true;
    }

    this.pPos.x += this.pVel.x * dt;
    this.pPos.z += this.pVel.z * dt;
    this.pPos.y = ny;
    this.pPos.x = Math.max(-34, Math.min(34, this.pPos.x));
    this.pPos.z = Math.max(-34, Math.min(34, this.pPos.z));
    resolveCircleColliders(this.pPos, 0.55, this.colliders);

    // CITY points: +1 per 10m traveled
    this.distAccum += Math.hypot(this.pPos.x - prevX, this.pPos.z - prevZ);
    if (this.distAccum >= 10) {
      const n = Math.floor(this.distAccum / 10);
      this.distAccum -= n * 10;
      this.cityPoints = addCityPoints(n);
    }

    this.rig.group.position.copy(this.pPos);
    this.rig.group.rotation.y = this.pHeading;
    const spd01 = Math.min(1, Math.hypot(this.pVel.x, this.pVel.z) / 9.5);
    this.rig.update(dt, this.onGround ? spd01 : 0.15);
    this.blob.position.set(this.pPos.x, 0.02, this.pPos.z);
    const blobS = Math.max(0.6, 1 - this.pPos.y * 0.25);
    this.blob.scale.set(blobS, blobS, 1);

    this.updateCamera(dt);
    this.updateAtmosphere(dt);
    this.updateScan(dt);
    this.updateHud(dt);
    this.drawMinimap(dt);
  }

  /** Follow cam: dist 8, pitch 0.32, FOV 62, lookAt focus+1.5y — critically-damped spring. */
  private updateCamera(dt: number): void {
    const focus = this.pPos;
    const pitch = this.camPitch + this.pitchKick;
    const yaw = this.camYaw;
    const dist = this.camDist;
    tmpV.set(
      focus.x + Math.sin(yaw) * Math.cos(pitch) * dist,
      Math.max(1.2, focus.y + 1.6 + Math.sin(pitch) * dist),
      focus.z + Math.cos(yaw) * Math.cos(pitch) * dist,
    );
    if (!this.camInit) {
      this.camPos.copy(tmpV);
      this.camVel.set(0, 0, 0);
      this.camInit = true;
    }
    // critically-damped spring (stiffness 90, damping 14)
    const k = 90, c = 14;
    this.camVel.x += ((tmpV.x - this.camPos.x) * k - this.camVel.x * c) * dt;
    this.camVel.y += ((tmpV.y - this.camPos.y) * k - this.camVel.y * c) * dt;
    this.camVel.z += ((tmpV.z - this.camPos.z) * k - this.camVel.z * c) * dt;
    this.camPos.addScaledVector(this.camVel, dt);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(focus.x, focus.y + 1.5, focus.z);
    this.pitchKick *= Math.exp(-dt * 6);
  }

  private updateAtmosphere(dt: number): void {
    const t = this.time;
    // lamp flicker (emissive noise on lampbulb0/1)
    for (let i = 0; i < this.lampMats.length; i++) {
      const mt = this.lampMats[i];
      mt.emissiveIntensity = 2.3 + Math.sin(t * 31 + i * 2.7) * 0.22 + Math.sin(t * 7.3 + i) * 0.12;
    }
    // traffic signal alternates red/green every 4s
    const green = Math.floor(t / 4) % 2 === 1;
    for (const mt of this.signalMats) {
      mt.emissive.setHex(green ? 0x2bd96a : 0xff3b3b);
      mt.emissiveIntensity = 2.2;
    }
    // chart ticker: stepping emissive pattern (live-feeling)
    const step = Math.floor(t * 2.5);
    for (let i = 0; i < this.chartMats.length; i++) {
      this.chartMats[i].emissiveIntensity = 0.9 + ((step + i * 2) % 4) * 0.22;
    }
    if (this.chartTex.length) {
      const off = (step % 32) / 32;
      for (const tex of this.chartTex) tex.offset.x = -off * 0.25;
    }
    // dust drift
    const p = this.dust.geometry.getAttribute("position") as THREE.BufferAttribute;
    const arr = p.array as Float32Array;
    for (let i = 0; i < arr.length; i += 3) {
      arr[i] += this.dustVel[i] * dt;
      arr[i + 1] += this.dustVel[i + 1] * dt;
      arr[i + 2] += this.dustVel[i + 2] * dt;
      if (arr[i + 1] < 0.2) arr[i + 1] = 10;
      if (arr[i] > 36) arr[i] = -36; else if (arr[i] < -36) arr[i] = 36;
      if (arr[i + 2] > 36) arr[i + 2] = -36; else if (arr[i + 2] < -36) arr[i + 2] = 36;
    }
    p.needsUpdate = true;
  }

  private updateScan(dt: number): void {
    if (!this.scanRing) return;
    this.scanT += dt;
    const life = 1.4;
    const k = Math.min(1, this.scanT / life);
    const s = 1 + k * 17;
    this.scanRing.scale.set(s, s, 1);
    (this.scanRing.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - k);
    if (k >= 1) {
      this.scene.remove(this.scanRing);
      this.scanRing = null;
    }
  }

  private updateHud(dt: number): void {
    this.hudT += dt;
    if (this.hudT < 0.2) return; // 5Hz
    this.hudT = 0;
    const d = new Date();
    const clock = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    const h: CityHudState = {
      clock,
      cityPoints: this.cityPoints,
      speedKmh: Math.hypot(this.pVel.x, this.pVel.z) * 3.6,
      isNight: true,
    };
    if (clock !== this.lastClock) this.lastClock = clock;
    this.onHud(h);
  }

  private drawMinimap(dt: number): void {
    this.mmT += dt;
    if (this.mmT < 0.3) return;
    this.mmT = 0;
    const c = this.minimap;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const S = c.width;
    const k = S / 76; // world ±34 → pad
    const px = (x: number) => S / 2 + x * k;
    const py = (z: number) => S / 2 + z * k;
    ctx.fillStyle = "rgba(5,8,14,0.92)";
    ctx.fillRect(0, 0, S, S);
    // street block
    ctx.fillStyle = "#232833";
    ctx.fillRect(px(-35), py(-35), 70 * k, 70 * k);
    // buildings
    const bld: [number, number, number, number, string][] = [
      [-20, -22, 14, 10, "#3d4657"], // shop
      [8, -21, 12, 10, "#333947"],   // apartment
      [-21, 10.5, 12, 9, "#333947"], // lobby
      [8.5, 10.5, 13, 11, "#333947"],// garage
    ];
    for (const [x0, z0, w, d, col] of bld) {
      ctx.fillStyle = col;
      ctx.fillRect(px(x0), py(z0), w * k, d * k);
    }
    // POIs: shop + lobby dots (pop during scan)
    const scanning = this.time < this.scanUntil;
    const pois: [number, number][] = [[-13, -12], [-15, 10.5]];
    for (const [x, z] of pois) {
      const r = scanning ? 4 + Math.sin(this.time * 10) * 1.5 : 2.6;
      ctx.fillStyle = scanning ? "#17e6d4" : "rgba(23,230,212,0.75)";
      ctx.beginPath(); ctx.arc(px(x), py(z), Math.max(2, r), 0, Math.PI * 2); ctx.fill();
    }
    if (scanning) {
      const rr = ((this.time % 1.5) / 1.5) * 30 * k;
      ctx.strokeStyle = "rgba(23,230,212,0.6)";
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(px(this.pPos.x), py(this.pPos.z), rr, 0, Math.PI * 2); ctx.stroke();
    }
    // player arrow (green, board 9)
    const hd = this.pHeading;
    ctx.save();
    ctx.translate(px(this.pPos.x), py(this.pPos.z));
    ctx.rotate(Math.PI - hd);
    ctx.fillStyle = "#00ff9f";
    ctx.beginPath();
    ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(-5, 6);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    // N + border
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 1;
    ctx.strokeRect(1, 1, S - 2, S - 2);
    ctx.fillStyle = "rgba(255,255,255,0.65)";
    ctx.font = "10px system-ui";
    ctx.fillText("N", S - 16, 14);
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.resize);
    this.rig.dispose();
    this.glbRoots.forEach((r) => r.parent?.remove(r));
    this.glbRoots.clear();
    this.scene.traverse((o) => {
      if (o.userData.oxcGlb) return; // cached GLB geometry — never dispose
      const m = o as THREE.Mesh;
      if (m.isMesh && m.geometry) m.geometry.dispose();
    });
    this.disposables.forEach((d) => { try { d.dispose(); } catch { /* noop */ } });
    this.renderer.dispose();
  }
}
