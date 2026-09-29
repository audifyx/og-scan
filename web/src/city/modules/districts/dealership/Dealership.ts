/**
 * 11. ORBITX MOTORS — enterable car dealership: glass showroom, display
 * platforms with demo cars, sales desk.
 *
 * - Exterior: glass showroom facade at DEALERSHIP_FACADE_CENTER (reserved
 *   city lot — see FACADE_PLOTS) with a turntable display car out front.
 * - Interior: 4 display platforms, neon strip, sales desk (interact point).
 * - Sales: paper-CITY purchases settle in the local paper wallet; the
 *   "Aurora Hypercar" trim burns real ORBITX through the injected
 *   DistrictsBilling (reason `city:districts:dealership:<id>`). Delivery
 *   (spawning the actual drivable) is the integrator's job via the
 *   `onDeliver` callback — this module never touches the vehicle system.
 */
import * as THREE from "three";
import type { DoorTrigger, Vec3T } from "../types";
import { paperWallet } from "../paper/PaperWallet";
import type { DistrictsBilling } from "../billing";

export const DEALERSHIP_INTERIOR_ID = "dealership";
/** Outdoor facade footprint center — the reserved city lot (see FACADE_PLOTS). */
export const DEALERSHIP_FACADE_CENTER: Vec3T = [-158, 0, 68];
export const DEALERSHIP_DOOR: DoorTrigger = {
  id: "door:dealership",
  label: "OrbitX Motors",
  position: [-158, 0, 88],
  radius: 5,
  prompt: "Enter Dealership",
  interiorId: DEALERSHIP_INTERIOR_ID,
  interiorSpawn: [0, 0, 14],
  exitPosition: [-158, 0, 87],
};

export interface ShowroomVehicle {
  id: string;
  name: string;
  blurb: string;
  /** Paper-CITY price (0 when premium-only). */
  priceCity: number;
  /** Real-ORBITX burn price (0 when paper-only). */
  priceOrbitx: number;
  color: number;
}

/** Showroom catalog — game items with honest prices, never mock market data. */
export const SHOWROOM: ShowroomVehicle[] = [
  { id: "city-runner", name: "City Runner", blurb: "Nimble hatchback. Perfect first ride.", priceCity: 2500, priceOrbitx: 0, color: 0x2a6bc2 },
  { id: "harbor-hauler", name: "Harbor Hauler", blurb: "Boxy van. Swallows cargo, shrugs off curbs.", priceCity: 5200, priceOrbitx: 0, color: 0x6b5a48 },
  { id: "neon-gt", name: "Neon GT", blurb: "Coupe with underglow. Turns heads at the docks.", priceCity: 9800, priceOrbitx: 0, color: 0xb01e5a },
  { id: "aurora-hypercar", name: "Aurora Hypercar", blurb: "Limited trim. Real ORBITX burn, forever on the ledger.", priceCity: 0, priceOrbitx: 25, color: 0x22e5ff },
];

export function vehicleBurnReason(id: string): string {
  return `city:districts:dealership:${id}`;
}

const STORE_KEY = "orbitxcity:dealership:v1";

function loadOwned(): string[] {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch { return []; }
}

function saveOwned(ids: string[]): void {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(ids)); } catch { /* noop */ }
}

export function ownedVehicles(): string[] { return loadOwned(); }
export function ownsVehicle(id: string): boolean { return loadOwned().includes(id); }

/** Buy with paper CITY (local ledger). */
export function buyVehiclePaper(v: ShowroomVehicle): { ok: boolean; message: string } {
  if (ownsVehicle(v.id)) return { ok: false, message: "Already in your garage." };
  if (!(v.priceCity > 0)) return { ok: false, message: "This trim is ORBITX-only." };
  if (!paperWallet.trySpend(v.priceCity)) {
    return { ok: false, message: `Need ${v.priceCity.toLocaleString()} paper CITY (have ${Math.floor(paperWallet.city).toLocaleString()})` };
  }
  saveOwned([...loadOwned(), v.id]);
  return { ok: true, message: `${v.name} is yours — pick it up at the sales desk.` };
}

/** Buy the premium trim: burns real ORBITX through billing, then records ownership. */
export async function buyVehiclePremium(
  v: ShowroomVehicle, billing: DistrictsBilling,
): Promise<{ ok: boolean; message: string; signature?: string }> {
  if (ownsVehicle(v.id)) return { ok: false, message: "Already in your garage." };
  if (!(v.priceOrbitx > 0)) return { ok: false, message: "This trim is paper-CITY only." };
  try {
    const { signature } = await billing.spendPremium({ amount: v.priceOrbitx, reason: vehicleBurnReason(v.id) });
    saveOwned([...loadOwned(), v.id]);
    return { ok: true, message: `${v.name} burned into your garage.`, signature };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Purchase failed — nothing was charged." };
  }
}

/* ---------------------------------- shared ---------------------------------- */

function mat(color: number, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.35, ...opts });
}

function box(w: number, h: number, d: number, color: number, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function makeTextPlane(text: string, w: number, h: number, color: string, x: number, y: number, z: number) {
  const c = document.createElement("canvas");
  c.width = 1024; c.height = 128;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#0a0c10";
  ctx.fillRect(0, 0, 1024, 128);
  ctx.fillStyle = color;
  ctx.font = "bold 72px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 512, 68);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex }));
  m.position.set(x, y, z);
  return m;
}

/** Stylized demo car (body + cabin + wheels + headlights). */
export function buildDemoCar(color: number, scale = 1): THREE.Group {
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.6 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2 * scale, 0.7 * scale, 4.4 * scale), paint);
  body.position.y = 0.75 * scale;
  body.castShadow = true;
  g.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.7 * scale, 0.6 * scale, 2.2 * scale),
    new THREE.MeshStandardMaterial({ color: 0x101418, roughness: 0.2, metalness: 0.4 }),
  );
  cabin.position.set(0, 1.35 * scale, -0.2 * scale);
  g.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.42 * scale, 0.42 * scale, 0.35 * scale, 14);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0c0d10, roughness: 0.9 });
  for (const [sx, sz] of [[-1, 1.4], [1, 1.4], [-1, -1.4], [1, -1.4]] as [number, number][]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(sx * 1.05 * scale, 0.42 * scale, sz * scale);
    g.add(w);
  }
  const lightMat = new THREE.MeshStandardMaterial({ color: 0x444444, emissive: 0xfff2c0, emissiveIntensity: 1.6 });
  for (const sx of [-1, 1]) {
    const hl = new THREE.Mesh(new THREE.SphereGeometry(0.16 * scale, 8, 8), lightMat);
    hl.position.set(sx * 0.65 * scale, 0.8 * scale, 2.22 * scale);
    g.add(hl);
  }
  return g;
}

/* --------------------------------- exterior --------------------------------- */

/** Glass showroom facade + turntable display car out front. */
export function buildDealershipExterior(): THREE.Group {
  const g = new THREE.Group();
  const W = 48, H = 10, D = 30;

  g.add(box(W, H, D, 0x2a2e35, 0, H / 2, -4));
  // glass front
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(W * 0.92, H * 0.72),
    new THREE.MeshStandardMaterial({ color: 0x9fc4d8, transparent: true, opacity: 0.45, roughness: 0.15, metalness: 0.2 }),
  );
  glass.position.set(0, H * 0.44, D / 2 - 4 + 0.1);
  g.add(glass);
  // sign band
  g.add(box(W * 0.7, 2, 0.6, 0x101418, 0, H - 1.6, D / 2 - 4 + 0.4));
  g.add(makeTextPlane("ORBITX MOTORS", W * 0.62, 1.7, "#22e5ff", 0, H - 1.6, D / 2 - 4 + 0.75));
  // turntable display car
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 5.5, 0.5, 24), mat(0x1a1e24));
  disc.position.set(0, 0.25, D / 2 + 7);
  disc.receiveShadow = true;
  g.add(disc);
  const demo = buildDemoCar(0xb01e5a, 1.15);
  demo.position.set(0, 0.5, D / 2 + 7);
  demo.rotation.y = 0.6;
  g.add(demo);
  // door glow marker
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(5, 5),
    new THREE.MeshBasicMaterial({ color: 0x22e5ff, transparent: true, opacity: 0.3, side: THREE.DoubleSide }),
  );
  glow.position.set(-W * 0.32, 2.5, D / 2 - 4 + 0.2);
  g.add(glow);

  g.position.set(...DEALERSHIP_FACADE_CENTER);
  return g;
}

/* --------------------------------- interior --------------------------------- */

export interface DealershipInterior {
  group: THREE.Group;
  /** Sales desk position (integrator proximity-opens <DealershipUI>). */
  deskPosition: Vec3T;
  dispose(): void;
}

export function buildDealershipInterior(): DealershipInterior {
  const g = new THREE.Group();
  const W = 56, D = 44, H = 10;

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), mat(0x1e2126, { roughness: 0.25, metalness: 0.5 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  g.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), mat(0x0c0e12));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = H;
  g.add(ceil);
  const wallMat = mat(0x2a2e35);
  const mkWall = (w: number, h: number, x: number, y: number, z: number, ry = 0) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wallMat);
    m.position.set(x, y, z);
    m.rotation.y = ry;
    g.add(m);
  };
  mkWall(W, H, 0, H / 2, -D / 2);
  mkWall(W, H, 0, H / 2, D / 2, Math.PI);
  mkWall(D, H, -W / 2, H / 2, 0, Math.PI / 2);
  mkWall(D, H, W / 2, H / 2, 0, -Math.PI / 2);

  // neon strip around the ceiling edge
  const neon = new THREE.Mesh(
    new THREE.BoxGeometry(W * 0.96, 0.18, D * 0.96),
    new THREE.MeshBasicMaterial({ color: 0x22e5ff }),
  );
  neon.position.y = H - 0.6;
  g.add(neon);
  const key = new THREE.PointLight(0xdfe8ff, 900, 70);
  key.position.set(0, H - 1.5, 0);
  g.add(key);

  // 4 display platforms with demo cars
  SHOWROOM.forEach((v, i) => {
    const x = (i % 2 === 0 ? -1 : 1) * 13;
    const z = (i < 2 ? -1 : 1) * 9 - 2;
    const plat = new THREE.Mesh(new THREE.CylinderGeometry(5, 5.4, 0.6, 24), mat(0x2a2e35));
    plat.position.set(x, 0.3, z);
    plat.receiveShadow = true;
    g.add(plat);
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(5.1, 0.12, 8, 32),
      new THREE.MeshBasicMaterial({ color: 0x22e5ff }),
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.set(x, 0.62, z);
    g.add(rim);
    const car = buildDemoCar(v.color, 1.1);
    car.position.set(x, 0.6, z);
    car.rotation.y = 0.5 + i * 0.4;
    g.add(car);
    g.add(makeTextPlane(`${v.name}`, 7, 1.1, "#ffffff", x, 3.4, z + 5.2));
    const price = v.priceCity > 0 ? `${v.priceCity.toLocaleString()} CITY` : `🔥 ${v.priceOrbitx} ORBITX`;
    g.add(makeTextPlane(price, 7, 1.1, v.priceCity > 0 ? "#34d399" : "#fbbf24", x, 2.1, z + 5.2));
  });

  // sales desk near the entrance
  const deskPosition: Vec3T = [0, 0, 14];
  g.add(box(6, 1.1, 1.8, 0x3a2e20, 0, 0.55, 14));
  g.add(box(6, 0.15, 2, 0x1e1812, 0, 1.18, 14));
  g.add(makeTextPlane("SALES DESK", 5, 1, "#f5c518", 0, 3, 13.9));

  g.add(makeTextPlane("◀ EXIT", 4, 1, "#ff5544", 0, 3.4, D / 2 - 0.3));

  return {
    group: g,
    deskPosition,
    dispose() {
      g.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
      });
    },
  };
}

export { paperWallet };
