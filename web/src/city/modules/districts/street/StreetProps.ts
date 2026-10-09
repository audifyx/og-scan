/**
 * STREET PROPS — daytime street furniture for OrbitX City.
 *
 * Benches, lamp posts (daytime fixtures — no night lighting per project rule),
 * planters, trash cans, and wayfinding signs. Integrator scatters these along
 * sidewalks via `buildStreetProps()`; positions are hand-placed to sit clear
 * of building lots and road lanes.
 */
import * as THREE from "three";
import type { Vec3T } from "../types";

function mat(color: number, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.2, ...opts });
}

function box(w: number, h: number, d: number, color: number, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function makeTextPlane(text: string, w: number, h: number, color: string, x: number, y: number, z: number, ry = 0) {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 128;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#101418";
  ctx.fillRect(0, 0, 512, 128);
  ctx.fillStyle = color;
  ctx.font = "bold 56px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 256, 68);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
  m.position.set(x, y, z);
  m.rotation.y = ry;
  return m;
}

/* ---------------------------------- pieces ---------------------------------- */

function bench(x: number, z: number, ry = 0): THREE.Group {
  const b = new THREE.Group();
  // slats
  for (let i = 0; i < 4; i++) {
    b.add(box(2.4, 0.09, 0.28, 0x8a5a3a, 0, 0.55, -0.5 + i * 0.33));
  }
  b.add(box(2.4, 0.7, 0.09, 0x8a5a3a, 0, 1.0, -0.72)); // backrest
  // iron legs
  for (const sx of [-1.0, 1.0]) {
    b.add(box(0.12, 0.55, 1.2, 0x2a2e34, sx, 0.28, 0));
  }
  b.position.set(x, 0, z);
  b.rotation.y = ry;
  return b;
}

function lampPost(x: number, z: number): THREE.Group {
  const l = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 7, 8), mat(0x2a2e34, { metalness: 0.5 }));
  pole.position.y = 3.5;
  pole.castShadow = true;
  l.add(pole);
  // arm + head (daytime: fixture only, no light)
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.6, 8), mat(0x2a2e34, { metalness: 0.5 }));
  arm.rotation.z = Math.PI / 2;
  arm.position.set(0.7, 6.9, 0);
  l.add(arm);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), mat(0xd8dee6, { roughness: 0.3 }));
  head.position.set(1.5, 6.75, 0);
  l.add(head);
  l.position.set(x, 0, z);
  return l;
}

function planter(x: number, z: number): THREE.Group {
  const p = new THREE.Group();
  const tub = box(1.8, 0.9, 1.8, 0x6a7a8a, 0, 0.45, 0);
  p.add(tub);
  // shrub ball
  const shrub = new THREE.Mesh(new THREE.SphereGeometry(0.95, 10, 8), mat(0x2a8a4a, { roughness: 0.9 }));
  shrub.position.y = 1.5;
  shrub.castShadow = true;
  p.add(shrub);
  p.position.set(x, 0, z);
  return p;
}

function trashCan(x: number, z: number): THREE.Group {
  const t = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.42, 1.2, 10), mat(0x3a6a4a, { metalness: 0.4 }));
  body.position.y = 0.6;
  body.castShadow = true;
  t.add(body);
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.12, 10), mat(0x2a4a34));
  lid.position.y = 1.26;
  t.add(lid);
  t.position.set(x, 0, z);
  return t;
}

function waySign(x: number, z: number, text: string, ry = 0): THREE.Group {
  const s = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 3.4, 8), mat(0x8a94a8, { metalness: 0.6 }));
  pole.position.y = 1.7;
  pole.castShadow = true;
  s.add(pole);
  s.add(makeTextPlane(text, 3.4, 0.85, "#7ae8ff", 0, 3.3, 0, 0));
  s.position.set(x, 0, z);
  s.rotation.y = ry;
  return s;
}

/* --------------------------------- assembly ---------------------------------- */

/** Hand-placed sidewalk furniture — clear of building lots and road lanes. */
const BENCHES: Array<[number, number, number]> = [
  [20, 40, 0], [-20, 40, Math.PI], [70, 20, Math.PI / 2], [-70, -20, -Math.PI / 2],
  [110, 30, Math.PI / 2], [-110, -30, -Math.PI / 2], [0, 120, 0], [0, -120, Math.PI],
];
const LAMPS: Array<Vec3T> = [
  [30, 0, 50], [-30, 0, 50], [30, 0, -50], [-30, 0, -50],
  [90, 0, 40], [-90, 0, 40], [90, 0, -40], [-90, 0, -40],
  [130, 0, 0], [-130, 0, 0], [0, 0, 110], [0, 0, -110],
];
const PLANTERS: Array<Vec3T> = [
  [14, 0, 44], [-14, 0, 44], [14, 0, -44], [-14, 0, -44],
  [64, 0, 26], [-64, 0, -26], [104, 0, 34], [-104, 0, -34],
];
const TRASH: Array<Vec3T> = [
  [24, 0, 46], [-24, 0, -46], [76, 0, 24], [-76, 0, -24],
  [116, 0, 36], [-116, 0, -36],
];
const SIGNS: Array<[number, number, number, string, number]> = [
  [10, 0, 60, "DOWNTOWN →", 0],
  [-10, 0, -60, "← PLAZA", 0],
  [60, 0, 10, "MALL →", Math.PI / 2],
  [-60, 0, -10, "← BANK", Math.PI / 2],
];

/** Street furniture group. Integrator adds to the outdoor world group. */
export function buildStreetProps(): THREE.Group {
  const g = new THREE.Group();
  for (const [x, z, ry] of BENCHES) g.add(bench(x, z, ry));
  for (const [x, , z] of LAMPS) g.add(lampPost(x, z));
  for (const [x, , z] of PLANTERS) g.add(planter(x, z));
  for (const [x, , z] of TRASH) g.add(trashCan(x, z));
  for (const [x, , z, text, ry] of SIGNS) g.add(waySign(x, z, text, ry));
  return g;
}
