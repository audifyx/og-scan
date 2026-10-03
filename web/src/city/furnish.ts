import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { DistrictBuildingDef, DistrictWorldHost } from "./CityDistrict";

/**
 * OrbitX City downtown — interior furnishing system.
 *
 * For every walkable district interior, places furniture from the shared
 * prop set (/city/props/<name>.glb). Every prop GLB 404 → procedural box
 * fallback with the same footprint, so interiors are complete before the
 * prop lane lands the assets.
 *
 * Every interior gets: floor (per-store color), baseboards, ceiling lamps
 * (emissive bulbs registered in the world's glow/flicker system), ≥1 plant,
 * wall decor, and clutter. Furniture colliders are pushed to the world so
 * counters/shelves block movement.
 *
 * Phone-safe: shared geometries/materials per furnisher, InstancedMesh for
 * repeated items (shelf products, washers, parking-style stall rows),
 * pixelRatio untouched (world-owned), no postprocessing.
 */

const loader = new GLTFLoader();
const propCache = new Map<string, Promise<THREE.Group | null>>();

function loadProp(name: string): Promise<THREE.Group | null> {
  const url = `/city/props/${name}.glb`;
  let p = propCache.get(url);
  if (!p) {
    p = loader.loadAsync(url).then((g) => g.scene).catch(() => null);
    propCache.set(url, p);
  }
  return p;
}

// ── TV static animation (independent of the world frame loop) ──

const tvRedraws: (() => void)[] = [];
let tvTimer: number | null = null;
/** Called from CityWorld.dispose(). */
export function disposeFurnishFx(): void {
  if (tvTimer !== null) { clearInterval(tvTimer); tvTimer = null; }
  tvRedraws.length = 0;
}
function animateTv(redraw: () => void): void {
  tvRedraws.push(redraw);
  if (tvTimer === null) {
    tvTimer = window.setInterval(() => { for (const r of tvRedraws) { try { r(); } catch { /* noop */ } } }, 160);
  }
}

// ── small builders ──

let glowTex: THREE.Texture | null = null;
function getGlowTex(): THREE.Texture {
  if (!glowTex) {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const ctx = c.getContext("2d")!;
    const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.4, "rgba(255,255,255,0.35)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    glowTex = new THREE.CanvasTexture(c);
  }
  return glowTex;
}

function std(color: number, rough = 0.85, metal = 0): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
}
function emissiveMat(color: number, intensity: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: 0x0a0d14, emissive: color, emissiveIntensity: intensity, roughness: 0.6,
  });
}
function box(w: number, h: number, d: number, color: number, rough = 0.85, metal = 0): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), std(color, rough, metal));
}

interface Ctx {
  world: DistrictWorldHost;
  def: DistrictBuildingDef;
  group: THREE.Group;
  accent: number;
}

/** Transform a local-space rect to world-space AABB (exact rotation). */
function xformRect(
  x0: number, z0: number, x1: number, z1: number, def: DistrictBuildingDef,
): { minX: number; maxX: number; minZ: number; maxZ: number } {
  const c = Math.cos(def.rotY), s = Math.sin(def.rotY);
  const pts = [[x0, z0], [x1, z0], [x0, z1], [x1, z1]].map(
    ([lx, lz]) => [def.x + lx * c + lz * s, def.z - lx * s + lz * c],
  );
  const wx = pts.map((p) => p[0]), wz = pts.map((p) => p[1]);
  return { minX: Math.min(...wx), maxX: Math.max(...wx), minZ: Math.min(...wz), maxZ: Math.max(...wz) };
}

function local(ctx: Ctx, obj: THREE.Object3D, lx: number, y: number, lz: number, ry = 0): THREE.Object3D {
  obj.position.set(lx, y, lz);
  obj.rotation.y = ry;
  ctx.group.add(obj);
  return obj;
}

/** Push a furniture collider (local coords → world AABB). */
function fcol(ctx: Ctx, x0: number, z0: number, x1: number, z1: number): void {
  ctx.world.collidersRef.push(xformRect(x0, z0, x1, z1, ctx.def));
}

function glowAt(ctx: Ctx, lx: number, y: number, lz: number, color: number, scale: number, opacity = 0.45): void {
  const sm = new THREE.SpriteMaterial({
    map: getGlowTex(), color, transparent: true, opacity,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const sp = new THREE.Sprite(sm);
  // world position of the local point
  const c = Math.cos(ctx.def.rotY), s = Math.sin(ctx.def.rotY);
  sp.position.set(
    ctx.def.x + lx * c + lz * s,
    y,
    ctx.def.z - lx * s + lz * c,
  );
  sp.scale.set(scale, scale, 1);
  ctx.world.sceneRef.add(sp);
}

/** Ceiling pendant lamp: cord + shade + emissive bulb (flicker-registered). */
function pendantLamp(ctx: Ctx, lx: number, lz: number, hangY = 3.1): void {
  const cord = box(0.05, 0.9, 0.05, 0x14161c);
  local(ctx, cord, lx, hangY + 0.45, lz);
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, 0.3, 12), std(0x23262e, 0.6, 0.4));
  local(ctx, shade, lx, hangY, lz);
  const bulbMat = emissiveMat(0xffc873, 2.2);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), bulbMat);
  local(ctx, bulb, lx, hangY - 0.18, lz);
  ctx.world.addLampMat(bulbMat);
  glowAt(ctx, lx, hangY - 0.1, lz, 0xffc873, 3.4, 0.4);
}

/** Procedural plant (fallback when the plant GLB is missing). */
function plantMesh(): THREE.Group {
  const g = new THREE.Group();
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.26, 0.45, 10), std(0x8a5a34, 0.9));
  pot.position.y = 0.22;
  const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 0), std(0x2a6b3a, 0.95));
  leaves.position.y = 0.95;
  const leaves2 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.38, 0), std(0x35944a, 0.95));
  leaves2.position.set(0.25, 1.25, 0.1);
  g.add(pot, leaves, leaves2);
  return g;
}

async function putPlant(ctx: Ctx, lx: number, lz: number): Promise<void> {
  const glb = await loadProp("plant");
  if (glb) {
    const p = glb.clone(true);
    local(ctx, p, lx, 0, lz);
  } else {
    local(ctx, plantMesh(), lx, 0, lz);
  }
  fcol(ctx, lx - 0.4, lz - 0.4, lx + 0.4, lz + 0.4);
}

/** Wall art: canvas plane with the store name / abstract deco. */
function wallArt(ctx: Ctx, lx: number, y: number, lz: number, title: string, ry = 0): void {
  const c = document.createElement("canvas");
  c.width = 256; c.height = 160;
  const g2d = c.getContext("2d")!;
  g2d.fillStyle = "#0b0e15";
  g2d.fillRect(0, 0, 256, 160);
  g2d.strokeStyle = "#17e6d4";
  g2d.lineWidth = 3;
  for (let i = 0; i < 5; i++) {
    g2d.beginPath();
    g2d.moveTo(10, 130 - i * 22);
    g2d.lineTo(246, 130 - i * 22 - ((i * 37) % 40));
    g2d.stroke();
  }
  g2d.fillStyle = "#aef7ff";
  g2d.font = "bold 26px system-ui, sans-serif";
  g2d.textAlign = "center";
  g2d.fillText(title, 128, 148);
  const tex = new THREE.CanvasTexture(c);
  const art = new THREE.Mesh(
    new THREE.PlaneGeometry(2.4, 1.5),
    new THREE.MeshBasicMaterial({ map: tex }),
  );
  local(ctx, art, lx, y, lz, ry);
}

/** Menu board with real ORBITX prices (canvas texture). */
function menuBoard(
  ctx: Ctx, lx: number, y: number, lz: number,
  storeName: string, items: [string, number][],
): void {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 300;
  const g2d = c.getContext("2d")!;
  g2d.fillStyle = "#0a0d14";
  g2d.fillRect(0, 0, 512, 300);
  g2d.fillStyle = "#d9a441";
  g2d.font = "bold 40px system-ui, sans-serif";
  g2d.textAlign = "center";
  g2d.fillText(storeName.toUpperCase(), 256, 52);
  g2d.fillStyle = "#8a93a6";
  g2d.fillRect(40, 70, 432, 2);
  items.forEach(([name, price], i) => {
    const y0 = 112 + i * 58;
    g2d.fillStyle = "#e8ecf4";
    g2d.font = "28px system-ui, sans-serif";
    g2d.textAlign = "left";
    g2d.fillText(name, 40, y0);
    g2d.fillStyle = "#17e6d4";
    g2d.textAlign = "right";
    g2d.fillText(`${price} ORBITX`, 472, y0);
  });
  const tex = new THREE.CanvasTexture(c);
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(3.6, 2.1, 0.12),
    std(0x14161c, 0.6),
  );
  local(ctx, board, lx, y, lz);
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(3.4, 1.95),
    new THREE.MeshBasicMaterial({ map: tex }),
  );
  local(ctx, face, lx, y, lz + 0.07);
}

/** Counter run (try GLB, else procedural). Returns its local z-center. */
async function putCounter(ctx: Ctx, cx: number, cz: number, w: number, accent: number): Promise<void> {
  const glb = await loadProp("counter");
  if (glb) {
    const c = glb.clone(true);
    c.scale.set(w / 3, 1, 1);
    local(ctx, c, cx, 0, cz);
  } else {
    const top = box(w, 0.1, 1.1, 0x4a3524, 0.6);
    local(ctx, top, cx, 1.02, cz);
    const bodyM = box(w, 0.95, 1.0, accent, 0.8);
    local(ctx, bodyM, cx, 0.48, cz);
  }
  fcol(ctx, cx - w / 2, cz - 0.6, cx + w / 2, cz + 0.6);
}

/** Cash register with glowing screen. */
function putRegister(ctx: Ctx, lx: number, lz: number): void {
  const glbP = loadProp("register");
  void glbP.then((glb) => {
    if (glb) {
      const r = glb.clone(true);
      local(ctx, r, lx, 1.07, lz);
    } else {
      const base = box(0.45, 0.3, 0.4, 0x23262e, 0.6);
      local(ctx, base, lx, 1.22, lz);
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.24), emissiveMat(0x17e6d4, 1.8));
      local(ctx, scr, lx, 1.45, lz - 0.05, Math.PI);
      scr.rotation.x = -0.25;
    }
  });
}

/** Table + stools set. */
function tableSet(ctx: Ctx, lx: number, lz: number, stools = 2): void {
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 0.08, 14), std(0x6b4a2e, 0.6));
  local(ctx, top, lx, 0.74, lz);
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.7, 8), std(0x23262e, 0.5, 0.5));
  local(ctx, leg, lx, 0.37, lz);
  fcol(ctx, lx - 0.7, lz - 0.7, lx + 0.7, lz + 0.7);
  for (let i = 0; i < stools; i++) {
    const a = (i / stools) * Math.PI * 2 + 0.5;
    const sx = lx + Math.cos(a) * 1.05, sz = lz + Math.sin(a) * 1.05;
    const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.09, 10), std(ctx.accent, 0.7));
    local(ctx, seat, sx, 0.5, sz);
    const sleg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.46, 8), std(0x23262e, 0.5, 0.5));
    local(ctx, sleg, sx, 0.25, sz);
  }
}

/** Kitchen row: grill (glowing) + fryer + drink station. */
function kitchenRow(ctx: Ctx, cx: number, cz: number): void {
  // grill with hot top
  const grill = box(1.7, 0.9, 0.85, 0x1c1f26, 0.5, 0.6);
  local(ctx, grill, cx - 1.4, 0.45, cz);
  const hot = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.7), emissiveMat(0xe06428, 1.7));
  hot.rotation.x = -Math.PI / 2;
  local(ctx, hot, cx - 1.4, 0.92, cz);
  glowAt(ctx, cx - 1.4, 1.1, cz, 0xe06428, 2.4, 0.35);
  // fryer
  const fryer = box(0.85, 1.0, 0.85, 0x9aa0ae, 0.4, 0.7);
  local(ctx, fryer, cx + 0.1, 0.5, cz);
  const oil = new THREE.Mesh(new THREE.PlaneGeometry(0.65, 0.65), std(0x3a2c14, 0.3));
  oil.rotation.x = -Math.PI / 2;
  local(ctx, oil, cx + 0.1, 1.02, cz);
  // drink station
  const ds = box(1.1, 1.0, 0.7, 0xd8dce4, 0.5);
  local(ctx, ds, cx + 1.5, 0.5, cz);
  for (let i = 0; i < 3; i++) {
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.05, 0.18, 8), std([0xc23b4e, 0x17e6d4, 0xd9a441][i], 0.6));
    local(ctx, cup, cx + 1.2 + i * 0.3, 1.1, cz);
  }
  fcol(ctx, cx - 2.3, cz - 0.5, cx + 2.1, cz + 0.5);
}

/** Shelf aisle with instanced product boxes (one InstancedMesh). */
function shelfAisle(ctx: Ctx, cx: number, cz: number, len: number): void {
  const frame = new THREE.Group();
  const side1 = box(0.08, 1.8, 0.9, 0x3a3f4c, 0.7);
  side1.position.set(-len / 2, 0.9, 0);
  const side2 = box(0.08, 1.8, 0.9, 0x3a3f4c, 0.7);
  side2.position.set(len / 2, 0.9, 0);
  frame.add(side1, side2);
  for (let s = 0; s < 3; s++) {
    const boardM = box(len, 0.06, 0.9, 0x4a505e, 0.7);
    boardM.position.set(0, 0.45 + s * 0.55, 0);
    frame.add(boardM);
  }
  local(ctx, frame, cx, 0, cz);
  // products: instanced boxes, varied colors
  const palette = [0xc23b4e, 0x17e6d4, 0xd9a441, 0x7a4ae0, 0x2a7a4a, 0xd8dce4];
  const per = Math.floor(len / 0.55);
  const count = per * 3;
  const pg = new THREE.BoxGeometry(0.42, 0.32, 0.55);
  const pm = new THREE.MeshStandardMaterial({ roughness: 0.8 });
  const inst = new THREE.InstancedMesh(pg, pm, count);
  const mtx = new THREE.Matrix4();
  const col = new THREE.Color();
  let idx = 0;
  for (let s = 0; s < 3; s++) {
    for (let i = 0; i < per; i++) {
      mtx.makeTranslation(-len / 2 + 0.3 + i * 0.55, 0.45 + s * 0.55 + 0.19, (idx % 2 === 0 ? 0.12 : -0.12));
      inst.setMatrixAt(idx, mtx);
      col.setHex(palette[(idx * 7 + s) % palette.length]);
      inst.setColorAt(idx, col);
      idx++;
    }
  }
  inst.instanceMatrix.needsUpdate = true;
  if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  local(ctx, inst, cx, 0, cz);
  fcol(ctx, cx - len / 2 - 0.1, cz - 0.55, cx + len / 2 + 0.1, cz + 0.55);
}

/** Clutter: crates + trash bin in a corner. */
function clutter(ctx: Ctx, lx: number, lz: number): void {
  const c1 = box(0.6, 0.6, 0.6, 0x6b4a2e, 0.9);
  local(ctx, c1, lx, 0.3, lz);
  const c2 = box(0.45, 0.45, 0.45, 0x5a3d24, 0.9);
  local(ctx, c2, lx + 0.55, 0.22, lz + 0.1, 0.4);
  const bin = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.24, 0.7, 10), std(0x2a2e38, 0.8));
  local(ctx, bin, lx - 0.6, 0.35, lz + 0.3);
  fcol(ctx, lx - 0.9, lz - 0.4, lx + 0.8, lz + 0.6);
}

// ── per-interior base (floor, baseboards, lamps, plant, decor, clutter) ──

function furnishBase(
  ctx: Ctx,
  opts: { floor: number; art: string; lamps?: [number, number][]; plants?: [number, number][] },
): void {
  const { hx, hz } = ctx.def;
  // floor (per-store variation)
  const fg = new THREE.PlaneGeometry(hx * 2 - 0.7, hz * 2 - 0.7);
  const floor = new THREE.Mesh(fg, std(opts.floor, 0.85));
  floor.rotation.x = -Math.PI / 2;
  local(ctx, floor, 0, 0.03, 0);
  // baseboards
  const bb = 0x14161c;
  const t = 0.12, h = 0.18;
  const mk = (w: number, d: number, lx: number, lz: number) => local(ctx, box(w, h, d, bb, 0.9), lx, h / 2, lz);
  mk(hx * 2 - 0.7, t, 0, -hz + 0.42);
  mk(hx * 2 - 0.7, t, 0, hz - 0.42);
  mk(t, hz * 2 - 0.7, -hx + 0.42, 0);
  mk(t, hz * 2 - 0.7, hx - 0.42, 0);
  // ceiling lamps
  const lamps = opts.lamps ?? [[-hx / 2, 0], [hx / 2, 0]];
  for (const [lx, lz] of lamps) pendantLamp(ctx, lx, lz);
  // plants
  const plants = opts.plants ?? [[-hx + 1, -hz + 1]];
  void (async () => { for (const [lx, lz] of plants) await putPlant(ctx, lx, lz); })();
  // wall decor on the back wall
  wallArt(ctx, 0, 3.4, -hz + 0.48, opts.art);
  // clutter in a front corner
  clutter(ctx, hx - 1.6, hz - 1.6);
}

// ── store furnishers ──

interface FoodSpec {
  items: [string, number][];
  art: string;
  floor: number;
}

async function furnishFastFood(ctx: Ctx, spec: FoodSpec): Promise<void> {
  const { hx, hz } = ctx.def;
  furnishBase(ctx, { floor: spec.floor, art: spec.art });
  const cz = -hz + 1.9; // counter line near the back
  await putCounter(ctx, 0, cz, Math.min(hx * 1.5, 7), ctx.accent);
  menuBoard(ctx, 0, 3.6, cz - 0.4, ctx.def.label, spec.items);
  putRegister(ctx, hx * 0.55, cz);
  kitchenRow(ctx, 0, -hz + 0.85);
  // dining tables
  const rows = Math.max(1, Math.floor((hz - 4) / 3));
  for (let r = 0; r < rows; r++) {
    const lz = cz + 2.6 + r * 2.8;
    if (lz > hz - 1.6) break;
    tableSet(ctx, -hx / 2.6, lz, 2);
    tableSet(ctx, hx / 2.6, lz, 2);
  }
}

async function furnishWallorbit(ctx: Ctx): Promise<void> {
  const { hx, hz } = ctx.def;
  furnishBase(ctx, { floor: 0x3a3f4c, art: "WALLORBIT", lamps: [[-4, -2], [4, -2], [-4, 3], [4, 3]] });
  // wall sign
  wallArt(ctx, 0, 4.6, -hz + 0.48, "EVERYDAY LOW ORBITS");
  // shelf aisles
  const aisleLen = hx * 1.5;
  shelfAisle(ctx, 0, -hz + 3.2, aisleLen);
  shelfAisle(ctx, 0, -hz + 5.6, aisleLen);
  // checkout lanes near the door
  for (const lx of [-3.4, 3.4]) {
    const lane = box(2.4, 0.95, 1.0, 0x2a5ad9, 0.7);
    local(ctx, lane, lx, 0.48, hz - 2.6);
    const belt = box(1.7, 0.06, 0.7, 0x14161c, 0.4);
    local(ctx, belt, lx - 0.2, 0.99, hz - 2.6);
    putRegister(ctx, lx + 0.8, hz - 2.6);
    fcol(ctx, lx - 1.2, hz - 3.2, lx + 1.2, hz - 2.0);
  }
  // carts parked by the entrance (procedural)
  void (async () => {
    const glb = await loadProp("cart");
    for (let i = 0; i < 3; i++) {
      const lx = -hx + 1.2 + i * 1.3, lz = hz - 1.1;
      if (glb) {
        const c = glb.clone(true);
        local(ctx, c, lx, 0, lz, 0.3);
      } else {
        const basket = box(0.7, 0.45, 0.5, 0x9aa0ae, 0.4, 0.7);
        local(ctx, basket, lx, 0.75, lz);
        const handle = box(0.06, 0.5, 0.5, 0x23262e, 0.5, 0.5);
        local(ctx, handle, lx - 0.4, 0.75, lz);
        for (const [wx, wz] of [[-0.25, -0.18], [0.25, -0.18], [-0.25, 0.18], [0.25, 0.18]] as [number, number][]) {
          const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.06, 8), std(0x14161c, 0.7));
          wheel.rotation.x = Math.PI / 2;
          local(ctx, wheel, lx + wx, 0.09, lz + wz);
        }
      }
    }
    fcol(ctx, -hx + 0.4, hz - 1.8, -hx + 4.4, hz - 0.5);
  })();
}

async function furnishBank(ctx: Ctx): Promise<void> {
  const { hx, hz } = ctx.def;
  furnishBase(ctx, { floor: 0x2a3040, art: "ORBITX BANK" });
  // teller counter
  await putCounter(ctx, 0, -hz + 2.0, hx * 1.2, 0x1a2a5a);
  putRegister(ctx, -1.5, -hz + 2.0);
  // ATMs on the right wall (glowing screens)
  void (async () => {
    const glb = await loadProp("atm");
    for (let i = 0; i < 2; i++) {
      const lz = -1.5 + i * 2.2;
      if (glb) {
        const a = glb.clone(true);
        local(ctx, a, hx - 0.9, 0, lz, -Math.PI / 2);
      } else {
        const body = box(0.7, 1.9, 0.95, 0x23262e, 0.5, 0.4);
        local(ctx, body, hx - 0.9, 0.95, lz);
        const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.4), emissiveMat(0x17e6d4, 1.8));
        local(ctx, scr, hx - 1.27, 1.35, lz, -Math.PI / 2);
      }
      glowAt(ctx, hx - 1.1, 1.35, lz, 0x17e6d4, 2.0, 0.35);
    }
    fcol(ctx, hx - 1.5, -2.6, hx - 0.3, 1.0);
  })();
  // rope queue: posts + rope bars
  for (let i = 0; i < 3; i++) {
    const lx = -2 + i * 2;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.0, 8), std(0xd9a441, 0.4, 0.8));
    local(ctx, post, lx, 0.5, 1.2);
    if (i < 2) {
      const rope = box(1.9, 0.07, 0.07, 0x7a2a2a, 0.9);
      local(ctx, rope, lx + 1, 0.88, 1.2);
    }
  }
  fcol(ctx, -3, 0.9, 3, 1.5);
}

async function furnishHotel(ctx: Ctx): Promise<void> {
  const { hx, hz } = ctx.def;
  furnishBase(ctx, { floor: 0x1f2a33, art: "GRAND ORBIT", lamps: [[-3, -2], [3, -2], [0, 3]] });
  // reception desk + monitor
  await putCounter(ctx, -hx + 2.2, -hz + 2.0, 3.4, 0x0f3a3a);
  const monBase = box(0.5, 0.06, 0.35, 0x14161c, 0.6);
  local(ctx, monBase, -hx + 2.2, 1.1, -hz + 2.0);
  const monScr = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.6), emissiveMat(0x2a9ad9, 1.5));
  local(ctx, monScr, -hx + 2.2, 1.55, -hz + 2.3, Math.PI);
  // lounge: rug + couches + coffee table
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 3.4), std(0x7a2a2a, 0.95));
  rug.rotation.x = -Math.PI / 2;
  local(ctx, rug, 1.5, 0.045, 1.2);
  const mkCouch = (lx: number, lz: number, ry: number) => {
    const g = new THREE.Group();
    const seat = box(2.2, 0.5, 0.9, 0x2a6f5f, 0.9); seat.position.y = 0.35;
    const back = box(2.2, 0.7, 0.22, 0x2a6f5f, 0.9); back.position.set(0, 0.85, -0.36);
    const arm1 = box(0.22, 0.65, 0.9, 0x245f52, 0.9); arm1.position.set(-1.0, 0.6, 0);
    const arm2 = box(0.22, 0.65, 0.9, 0x245f52, 0.9); arm2.position.set(1.0, 0.6, 0);
    g.add(seat, back, arm1, arm2);
    local(ctx, g, lx, 0, lz, ry);
    fcol(ctx, lx - 1.2, lz - 0.6, lx + 1.2, lz + 0.6);
  };
  mkCouch(0.4, 0.2, 0);
  mkCouch(2.8, 2.6, Math.PI / 2);
  const coffee = box(1.4, 0.4, 0.7, 0x4a3524, 0.6);
  local(ctx, coffee, 1.6, 0.2, 1.4);
  // TV with animated static on the left wall
  const tvBody = box(1.6, 1.0, 0.12, 0x14161c, 0.5);
  local(ctx, tvBody, -hx + 0.5, 2.6, 0.5, Math.PI / 2);
  const staticC = document.createElement("canvas");
  staticC.width = 96; staticC.height = 60;
  const sctx = staticC.getContext("2d")!;
  const staticTex = new THREE.CanvasTexture(staticC);
  const drawStatic = () => {
    const img = sctx.createImageData(96, 60);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.floor(Math.random() * 90) + 20;
      img.data[i] = v * 0.6; img.data[i + 1] = v; img.data[i + 2] = v * 0.9; img.data[i + 3] = 255;
    }
    sctx.putImageData(img, 0, 0);
    staticTex.needsUpdate = true;
  };
  drawStatic();
  animateTv(drawStatic);
  const tvScr = new THREE.Mesh(new THREE.PlaneGeometry(1.45, 0.88), new THREE.MeshBasicMaterial({ map: staticTex }));
  local(ctx, tvScr, -hx + 0.58, 2.6, 0.5, Math.PI / 2);
  glowAt(ctx, -hx + 0.7, 2.6, 0.5, 0x9adfff, 2.6, 0.3);
}

async function furnishLaundromat(ctx: Ctx): Promise<void> {
  const { hx, hz } = ctx.def;
  furnishBase(ctx, { floor: 0xd8dce4, art: "SPIN CYCLE" });
  // washer/dryer rows — instanced bodies, individual glowing doors
  const rows: [number, number][] = [[-2.6, -hz + 1.6], [2.6, -hz + 1.6], [-2.6, 0.2], [2.6, 0.2]];
  const bodyG = new THREE.BoxGeometry(1.0, 1.15, 0.95);
  const bodyM = new THREE.MeshStandardMaterial({ color: 0xe8ecf4, roughness: 0.4, metalness: 0.5 });
  const bodies = new THREE.InstancedMesh(bodyG, bodyM, 12);
  const mtx = new THREE.Matrix4();
  let idx = 0;
  for (const [cx, cz] of rows) {
    for (let i = -1; i <= 1; i++) {
      mtx.makeTranslation(cx + i * 1.15, 0.58, cz);
      bodies.setMatrixAt(idx++, mtx);
      const door = new THREE.Mesh(new THREE.CircleGeometry(0.3, 16), emissiveMat(0x2a9ad9, 1.2));
      local(ctx, door, cx + i * 1.15, 0.58, cz + 0.49);
    }
  }
  bodies.instanceMatrix.needsUpdate = true;
  local(ctx, bodies, 0, 0, 0);
  for (const [cx, cz] of rows) fcol(ctx, cx - 1.8, cz - 0.55, cx + 1.8, cz + 0.55);
  // folding table + benches
  const fold = box(2.6, 0.08, 1.1, 0xd8dce4, 0.5);
  local(ctx, fold, 0, 0.85, hz - 2.2);
  for (const lx of [-1.1, 1.1]) {
    const leg = box(0.08, 0.85, 1.0, 0x9aa0ae, 0.5, 0.5);
    local(ctx, leg, lx, 0.42, hz - 2.2);
  }
  fcol(ctx, -1.4, hz - 2.9, 1.4, hz - 1.6);
  const bench = box(2.2, 0.45, 0.5, 0x4a505e, 0.8);
  local(ctx, bench, -hx + 1.2, 0.22, hz - 2.2);
  fcol(ctx, -hx + 0.1, hz - 2.5, -hx + 2.3, hz - 1.9);
}

async function furnishGasKiosk(ctx: Ctx): Promise<void> {
  const { hx, hz } = ctx.def;
  furnishBase(ctx, { floor: 0x3a3f4c, art: "ORBIT GAS MART" });
  // shelf + fridge + counter
  shelfAisle(ctx, -1.6, -hz + 2.2, 3.2);
  const fridge = box(1.1, 2.0, 0.9, 0xd8dce4, 0.4, 0.3);
  local(ctx, fridge, hx - 1.2, 1.0, -hz + 1.6);
  const fdoor = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 1.6), emissiveMat(0x9adfff, 0.9));
  local(ctx, fdoor, hx - 1.2, 1.0, -hz + 2.06);
  fcol(ctx, hx - 1.8, -hz + 1.1, hx - 0.6, -hz + 2.1);
  await putCounter(ctx, 0.6, hz - 2.2, 2.6, 0xc23b4e);
  putRegister(ctx, 0.6, hz - 2.2);
}

// ── entry ──

const FOOD_SPECS: Record<string, FoodSpec> = {
  mcorbits:   { items: [["Big Orbit Burger", 30], ["McFry Basket", 20], ["Lucky Nuggets", 50]], art: "MCORBIT'S", floor: 0x4a2c2c },
  burgerkhan: { items: [["Khan Burger", 30], ["Flame Fries", 20], ["Golden Crown Shake", 50]], art: "BURGER KHAN", floor: 0x3a2a1e },
  wendas:     { items: [["Frosty Orbit", 30], ["Square Patty Melt", 20], ["Chili Cheese Luck", 50]], art: "WENDA'S", floor: 0x1e3a3a },
  pizzashack: { items: [["Moon Cheese Slice", 30], ["Pepperoni Comet", 20], ["Lucky Calzone", 50]], art: "PIZZA ORBIT", floor: 0x3a2a26 },
  coffeeshop: { items: [["Lunar Latte", 30], ["Starlight Cold Brew", 20], ["Golden Bean Jackpot", 50]], art: "MOONBUX", floor: 0x2e2419 },
};

const ACCENTS: Record<string, number> = {
  mcorbits: 0xc23b4e, burgerkhan: 0xe06428, wendas: 0x17e6d4,
  pizzashack: 0xc23b4e, coffeeshop: 0x6b4a2e, wallorbit: 0x2a5ad9,
  bank: 0x1a2a5a, hotel: 0x0f3a3a, laundromat: 0x17e6d4, gasstation: 0xc23b4e,
};

/**
 * Furnish every walkable district interior. Safe to call once per world —
 * buildings without a door (officetower2) and the open plaza are skipped.
 */
export async function furnishDistrict(
  world: DistrictWorldHost,
  defs: DistrictBuildingDef[],
): Promise<void> {
  const jobs: Promise<void>[] = [];
  for (const def of defs) {
    if (!def.door || def.open) continue;
    const ctx: Ctx = {
      world,
      def,
      group: new THREE.Group(),
      accent: ACCENTS[def.name] ?? 0x3a3f4c,
    };
    ctx.group.position.set(def.x, 0, def.z);
    ctx.group.rotation.y = def.rotY;
    world.sceneRef.add(ctx.group);
    const spec = FOOD_SPECS[def.name];
    if (spec) jobs.push(furnishFastFood(ctx, spec));
    else if (def.name === "wallorbit") jobs.push(furnishWallorbit(ctx));
    else if (def.name === "bank") jobs.push(furnishBank(ctx));
    else if (def.name === "hotel") jobs.push(furnishHotel(ctx));
    else if (def.name === "laundromat") jobs.push(furnishLaundromat(ctx));
    else if (def.name === "gasstation") jobs.push(furnishGasKiosk(ctx));
    else {
      // generic furnished interior (fallback for future walkables)
      furnishBase(ctx, { floor: 0x2a2e38, art: def.label.toUpperCase() });
      jobs.push((async () => { await putCounter(ctx, 0, -ctx.def.hz + 2, 3, ctx.accent); })());
    }
  }
  await Promise.all(jobs);
}
