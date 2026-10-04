/**
 * 2. HOSPITAL — respawn point + wanted-level clearing for a bill.
 *
 * - Exterior: modern hospital block with red-cross tower at HOSPITAL_DOOR.
 * - Interior: reception lobby, ward with beds, "PAY BILL / CLEAR RECORD" desk.
 * - Respawn: on death the player wakes in a ward bed (HOSPITAL_RESPAWN).
 * - Clear wanted: each wanted star costs paper CITY (250/star). Premium
 *   "expedited record wipe" bills in real ORBITX via DistrictsBilling when live.
 *
 * Assumption: the wanted level lives with the integrator (core/future module);
 * this file consumes the `WantedProvider` adapter from types.ts.
 */
import * as THREE from "three";
import type { DoorTrigger, RespawnConfig, Vec3T, WantedProvider } from "../types";
import { paperWallet } from "../paper/PaperWallet";
import type { DistrictsBilling } from "../billing";

export const HOSPITAL_INTERIOR_ID = "hospital";
/** Outdoor facade footprint center — the reserved city lot (see FACADE_PLOTS). */
export const HOSPITAL_FACADE_CENTER: Vec3T = [-78, 0, 78];
export const HOSPITAL_DOOR: DoorTrigger = {
  id: "door:hospital",
  label: "OrbitX General Hospital",
  position: [-78, 0, 95],
  radius: 4,
  prompt: "Enter Hospital",
  interiorId: HOSPITAL_INTERIOR_ID,
  interiorSpawn: [0, 0, 12],
  exitPosition: [-78, 0, 94],
};

export const HOSPITAL_RESPAWN: RespawnConfig = {
  position: [6, 0, -6],
  heading: Math.PI,
};

export const WANTED_CLEAR_COST_PER_STAR = 250; // paper CITY
export const EXPEDITED_WIPE_COST_ORBITX = 5; // real ORBITX, premium

function mat(color: number, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.1, ...opts });
}
function box(w: number, h: number, d: number, color: number, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
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

/** Modern hospital block exterior. */
export function buildHospitalExterior(): THREE.Group {
  const g = new THREE.Group();
  const W = 40, H = 22, D = 24;
  g.add(box(W, H, D, 0xe9edf2, 0, H / 2, 0));
  // glass band
  g.add(box(W + 0.4, 3, D + 0.4, 0x9fd4e8, 0, 6, 0));
  // red cross tower
  g.add(box(6, 10, 6, 0xf2f5f8, 0, H + 5, 0));
  const crossMat = new THREE.MeshBasicMaterial({ color: 0xe02b2b });
  const c1 = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.1, 0.3), crossMat);
  c1.position.set(0, H + 6, 3.1);
  const c2 = new THREE.Mesh(new THREE.BoxGeometry(1.1, 3.4, 0.3), crossMat);
  c2.position.set(0, H + 6, 3.1);
  g.add(c1, c2);
  // ER canopy + sign
  g.add(box(14, 0.6, 6, 0xc23b3b, 0, 4, D / 2 + 3));
  for (const sx of [-5.5, 5.5]) g.add(box(0.5, 4, 0.5, 0x888888, sx, 2, D / 2 + 5));
  const c = document.createElement("canvas");
  c.width = 512; c.height = 96;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#7a1010"; ctx.fillRect(0, 0, 512, 96);
  ctx.fillStyle = "#fff"; ctx.font = "bold 52px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("EMERGENCY", 256, 50);
  const tex = new THREE.CanvasTexture(c);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(10, 1.9), new THREE.MeshBasicMaterial({ map: tex }));
  sign.position.set(0, 3.2, D / 2 + 6.1);
  g.add(sign);
  g.position.set(...HOSPITAL_FACADE_CENTER);
  return g;
}

export interface HospitalInterior {
  group: THREE.Group;
  /** Bed spawn positions (integrator picks one on respawn). */
  bedSpawns: Vec3T[];
  /** Billing desk position — prompt "Pay bill / clear record". */
  deskPosition: Vec3T;
  dispose(): void;
}

export function buildHospitalInterior(): HospitalInterior {
  const g = new THREE.Group();
  const W = 48, D = 36, H = 8;

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), mat(0xdfe6ea, { roughness: 0.35 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; g.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), mat(0xf4f7f9));
  ceil.rotation.x = Math.PI / 2; ceil.position.y = H; g.add(ceil);
  const wall = mat(0xf0f4f6);
  const mkWall = (w: number, h: number, x: number, y: number, z: number, ry = 0) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wall);
    m.position.set(x, y, z); m.rotation.y = ry; g.add(m);
  };
  mkWall(W, H, 0, H / 2, -D / 2);
  mkWall(W, H, 0, H / 2, D / 2, Math.PI);
  mkWall(D, H, -W / 2, H / 2, 0, Math.PI / 2);
  mkWall(D, H, W / 2, H / 2, 0, -Math.PI / 2);

  // reception desk
  g.add(box(10, 1.1, 2.4, 0xffffff, -12, 0.55, 12));
  g.add(box(10, 0.15, 2.4, 0x9fd4e8, -12, 1.2, 12));
  const deskPosition: Vec3T = [-12, 0, 10.5];

  // ward: 6 beds with dividers
  const bedSpawns: Vec3T[] = [];
  for (let i = 0; i < 6; i++) {
    const x = (i % 3 - 1) * 10;
    const z = i < 3 ? -6 : -12;
    g.add(box(2.2, 0.5, 4.2, 0xffffff, x, 0.55, z)); // mattress
    g.add(box(2.2, 0.5, 0.5, 0x9fd4e8, x, 0.9, z - 1.9)); // pillow
    for (const lx of [-0.9, 0.9]) for (const lz of [-1.8, 1.8])
      g.add(box(0.12, 0.5, 0.12, 0x666666, x + lx, 0.25, z + lz));
    // privacy curtain
    const curtain = new THREE.Mesh(
      new THREE.PlaneGeometry(4.4, 2),
      new THREE.MeshStandardMaterial({ color: 0x7fb8d4, transparent: true, opacity: 0.55, side: THREE.DoubleSide })
    );
    curtain.position.set(x, 1.6, z + 2.3);
    g.add(curtain);
    bedSpawns.push([x, 0, z + 0.5]);
  }

  // ceiling lights
  for (let ix = -1; ix <= 1; ix++) for (let iz = -1; iz <= 1; iz++) {
    const l = new THREE.PointLight(0xffffff, 500, 40);
    l.position.set(ix * 14, H - 1, iz * 10);
    g.add(l);
  }

  /* ------------------------- furnished interior ------------------------- */

  // RECEPTION sign above the billing desk (desk + deskPosition unchanged)
  const recSign = makeTextPlane("RECEPTION", 8, 1, "#ffffff", -12, 4.4, 13.2);
  recSign.rotation.y = Math.PI;
  g.add(recSign);

  // EMERGENCY sign on the entrance wall
  const erSign = makeTextPlane("EMERGENCY", 10, 1.25, "#ff4444", 8, 5.8, D / 2 - 0.15);
  erSign.rotation.y = Math.PI;
  g.add(erSign);

  // waiting-room bench rows (connected seats — fewer meshes than chairs)
  for (const rz of [7.5, 11]) {
    g.add(box(13, 0.15, 1.2, 0x3d6b8a, 12, 0.75, rz));      // seat
    g.add(box(13, 0.9, 0.15, 0x2f556e, 12, 1.2, rz + 0.62)); // backrest
    for (const bx of [6.5, 12, 17.5]) g.add(box(0.5, 0.68, 1, 0x555555, bx, 0.34, rz));
  }

  // medical crosses on all four walls
  const crossGrp = (x: number, y: number, z: number, ry = 0) => {
    const grp = new THREE.Group();
    const cm = mat(0xe02b2b, { emissive: 0xe02b2b, emissiveIntensity: 0.25 });
    const a = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.8, 0.15), cm);
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2.4, 0.15), cm);
    grp.add(a, b);
    grp.position.set(x, y, z); grp.rotation.y = ry;
    return grp;
  };
  g.add(crossGrp(-15, 5, -D / 2 + 0.15));
  g.add(crossGrp(15, 5, -D / 2 + 0.15));
  g.add(crossGrp(-W / 2 + 0.15, 5, 0, Math.PI / 2));
  g.add(crossGrp(W / 2 - 0.15, 5, 0, -Math.PI / 2));

  // pharmacy cabinet on the west wall with medicine bottles
  g.add(box(1.4, 3.4, 4, 0xf5f8fa, -W / 2 + 1, 1.7, -2));
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3),
    new THREE.MeshStandardMaterial({ color: 0xbfd9e8, transparent: true, opacity: 0.4 }));
  glass.position.set(-W / 2 + 1.75, 1.7, -2); glass.rotation.y = Math.PI / 2;
  g.add(glass);
  const medColors = [0xd45a5a, 0x5a8ad4, 0x5ad47a];
  for (let s = 0; s < 2; s++) for (let i = 0; i < 6; i++)
    g.add(box(0.3, 0.5, 0.3, medColors[(i + s) % 3], -W / 2 + 1.5, 1.1 + s * 0.9, -3.5 + i * 0.6));

  // floor directory stand near the entrance
  g.add(box(0.15, 2.6, 0.15, 0x777777, -4, 1.3, 15.5));
  const dir = makeTextPlane("HOSPITAL DIRECTORY", 7, 0.9, "#ffffff", -4, 3, 15.5);
  dir.rotation.y = Math.PI;
  g.add(dir);

  // ceiling light panels (emissive quads at each PointLight)
  for (let ix = -1; ix <= 1; ix++) for (let iz = -1; iz <= 1; iz++) {
    const panel = box(6, 0.12, 3, 0xf8fcff, ix * 14, H - 0.08, iz * 10);
    const pm = panel.material as THREE.MeshStandardMaterial;
    pm.emissive = new THREE.Color(0xffffff); pm.emissiveIntensity = 0.55;
    g.add(panel);
  }

  return {
    group: g,
    bedSpawns,
    deskPosition,
    dispose() {
      g.traverse((o) => { const m = o as THREE.Mesh; if (m.geometry) m.geometry.dispose(); });
    },
  };
}

/* ------------------------------- billing logic ------------------------------ */

export interface ClearWantedResult { ok: boolean; message: string; starsCleared: number; }

/** Pay the hospital bill in paper CITY to clear the wanted level. */
export function clearWantedPaper(wanted: WantedProvider): ClearWantedResult {
  const stars = wanted.getStars();
  if (stars <= 0) return { ok: false, message: "No wanted level to clear.", starsCleared: 0 };
  const cost = stars * WANTED_CLEAR_COST_PER_STAR;
  if (!paperWallet.trySpend(cost)) {
    return { ok: false, message: `Bill is ${cost} paper CITY — you have ${Math.floor(paperWallet.city)}.`, starsCleared: 0 };
  }
  wanted.clear();
  return { ok: true, message: `Record wiped. Paid ${cost} paper CITY.`, starsCleared: stars };
}

/**
 * Premium "expedited record wipe": instant, no questions, billed in real
 * ORBITX through the tokenomics billing path when live. Defensive: throws a
 * clear error while billing is not live (UI should gate on billing.state).
 */
export async function clearWantedPremium(
  wanted: WantedProvider,
  billing: DistrictsBilling
): Promise<ClearWantedResult> {
  if (billing.state !== "live") {
    return { ok: false, message: "Premium wipe unavailable — billing not live yet.", starsCleared: 0 };
  }
  const stars = wanted.getStars();
  if (stars <= 0) return { ok: false, message: "No wanted level to clear.", starsCleared: 0 };
  const { signature } = await billing.spendPremium({
    amount: EXPEDITED_WIPE_COST_ORBITX,
    reason: "city-hospital:expedited-wipe",
    ref: crypto.randomUUID(),
  });
  wanted.clear();
  return { ok: true, message: `Expedited wipe complete · sig ${signature.slice(0, 8)}…`, starsCleared: stars };
}

/** Hospital treatment bill on respawn (flat paper-CITY fee). */
export function chargeTreatmentBill(): number {
  const bill = 100;
  paperWallet.adjustCity(-Math.min(bill, paperWallet.city));
  return bill;
}
