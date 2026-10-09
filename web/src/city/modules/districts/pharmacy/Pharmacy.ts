/**
 * 15. MEDIORBIT — enterable pharmacy.
 *
 * - Exterior: storefront facade at PHARMACY_FACADE_CENTER (reserved city lot —
 *   see FACADE_PLOTS) with glass front + green cross sign.
 * - Interior: stocked shelf aisles, pharmacy counter at the back (interact
 *   point), waiting chairs, bright clinical lighting.
 */
import * as THREE from "three";
import type { DoorTrigger, Vec3T } from "../types";
import { mountAsset } from "@/city/modules/assets/loadAsset";

export const PHARMACY_INTERIOR_ID = "pharmacy";
/** Outdoor facade footprint center — the reserved city lot (see FACADE_PLOTS). */
export const PHARMACY_FACADE_CENTER: Vec3T = [78, 0, -156];
export const PHARMACY_DOOR: DoorTrigger = {
  id: "door:pharmacy",
  label: "MediOrbit",
  position: [78, 0, -141],
  radius: 4,
  prompt: "Enter MediOrbit",
  interiorId: PHARMACY_INTERIOR_ID,
  interiorSpawn: [0, 0, 10],
  exitPosition: [78, 0, -142],
};

/* ---------------------------------- shared ---------------------------------- */

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

/** Green cross sign plane (drawn on canvas — no emoji). */
function makeCrossSign(w: number, h: number, x: number, y: number, z: number) {
  const c = document.createElement("canvas");
  c.width = 256; c.height = 256;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#f4f8f4";
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = "#1fae55";
  ctx.fillRect(96, 48, 64, 160);
  ctx.fillRect(48, 96, 160, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex }));
  m.position.set(x, y, z);
  return m;
}

/* --------------------------------- exterior --------------------------------- */

/** Pharmacy storefront. Integrator adds to the outdoor world group. */
export function buildPharmacyExterior(): THREE.Group {
  const g = new THREE.Group();
  const W = 36, H = 9, D = 24;

  // Procedural body — fallback until the GLB strip loads.
  const body = new THREE.Group();
  body.userData.proceduralBody = true;
  body.add(box(W, H, D, 0xdfe4e2, 0, H / 2, 0));
  // glass storefront
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(W * 0.9, H * 0.62),
    new THREE.MeshStandardMaterial({ color: 0xd8f0e8, transparent: true, opacity: 0.5, roughness: 0.2, emissive: 0xa8e8c8, emissiveIntensity: 0.3 }),
  );
  glass.position.set(0, H * 0.42, D / 2 + 0.1);
  body.add(glass);
  // teal awning stripes
  for (let i = 0; i < 9; i++) {
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(W * 0.1, 0.18, 2.4),
      mat(i % 2 === 0 ? 0x1fae55 : 0xf4f8f4),
    );
    stripe.position.set(-W * 0.45 + i * W * 0.1 + W * 0.05, H * 0.78, D / 2 + 1.2);
    stripe.rotation.x = 0.25;
    body.add(stripe);
  }
  g.add(body);
  // Real GLB commercial strip (Kenney CC0) — swaps the procedural body when loaded.
  mountAsset(g, "buildings/commercial/shop-d", { position: [-10, 0, 0], scale: 10 });
  mountAsset(g, "buildings/commercial/shop-n", { position: [7, 0, 0], scale: 7 });
  // sign
  g.add(box(W * 0.72, 1.8, 0.6, 0x0e1a14, 0, H - 1.4, D / 2 + 0.4));
  g.add(makeTextPlane("MEDIORBIT", W * 0.5, 1.5, "#3ae87a", 0.8, H - 1.4, D / 2 + 0.75));
  g.add(makeCrossSign(1.6, 1.6, -W * 0.28, H - 1.4, D / 2 + 0.75));
  // door glow marker
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(3.6, 4.4),
    new THREE.MeshBasicMaterial({ color: 0x3ae87a, transparent: true, opacity: 0.3, side: THREE.DoubleSide }),
  );
  glow.position.set(0, 2.2, D / 2 + 0.2);
  g.add(glow);

  g.position.set(...PHARMACY_FACADE_CENTER);
  return g;
}

/* --------------------------------- interior --------------------------------- */

export interface PharmacyInterior {
  group: THREE.Group;
  /** Pharmacy counter position (integrator proximity-opens <PharmacyUI>). */
  counterPosition: Vec3T;
  dispose(): void;
}

const PRODUCT_COLORS = [0x1fae55, 0x2a6bc2, 0xe8e8e8, 0xd8a02e, 0x7a3bc2, 0xc23b3b];

function shelfAisle(x: number): THREE.Group {
  const a = new THREE.Group();
  for (const sz of [-1, 1]) {
    const z = sz * 1.9;
    a.add(box(9, 2.4, 1.1, 0x9aa4ae, x, 1.2, z)); // shelf body
    a.add(box(9.2, 0.12, 1.3, 0x6a747e, x, 2.5, z)); // top board
    // two stocked shelf levels
    for (const ly of [0.85, 1.7]) {
      for (let k = 0; k < 6; k++) {
        const prod = new THREE.Mesh(
          new THREE.BoxGeometry(0.9, 0.7, 0.9),
          mat(PRODUCT_COLORS[(k + (ly > 1 ? 3 : 0)) % PRODUCT_COLORS.length]),
        );
        prod.position.set(x - 3.6 + k * 1.45, ly + 0.35, z);
        prod.castShadow = true;
        a.add(prod);
      }
    }
  }
  a.position.set(0, 0, 0);
  return a;
}

function waitingChair(x: number, z: number, ry = 0): THREE.Group {
  const c = new THREE.Group();
  c.add(box(1.1, 0.18, 1.1, 0x3a6a8a, 0, 0.7, 0));
  c.add(box(1.1, 1.1, 0.16, 0x3a6a8a, 0, 1.25, -0.5));
  for (const [dx, dz] of [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]] as const) {
    c.add(box(0.1, 0.7, 0.1, 0x2a2e35, dx, 0.35, dz));
  }
  c.position.set(x, 0, z);
  c.rotation.y = ry;
  return c;
}

export function buildPharmacyInterior(): PharmacyInterior {
  const g = new THREE.Group();
  const W = 36, D = 24, H = 8;

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), mat(0xeef2f0, { roughness: 0.35 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  g.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), mat(0xe8ecea));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = H;
  g.add(ceil);
  const wallMat = mat(0xcfd8d4);
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

  // bright clinical lighting
  const key = new THREE.PointLight(0xffffff, 1000, 70);
  key.position.set(0, H - 1, 0);
  g.add(key);
  const fill = new THREE.PointLight(0xd8ffe8, 400, 45);
  fill.position.set(-10, H - 1, -6);
  g.add(fill);

  // 2 stocked shelf aisles (walkable aisles >= 3 wide)
  g.add(shelfAisle(-7));
  g.add(shelfAisle(7));
  g.add(makeTextPlane("AISLE 1", 4.4, 0.9, "#1fae55", -7, 3.6, -4.2));
  g.add(makeTextPlane("AISLE 2", 4.4, 0.9, "#1fae55", 7, 3.6, -4.2));

  // pharmacy counter at the back
  const counterPosition: Vec3T = [0, 0, -6];
  g.add(box(9, 1.15, 2.0, 0xe8ecea, 0, 0.575, -9));
  g.add(box(9.4, 0.18, 2.4, 0x1fae55, 0, 1.24, -9));
  g.add(box(0.9, 1.1, 0.5, 0x2a2e35, -3, 1.9, -9)); // register
  g.add(makeCrossSign(1.6, 1.6, 0, 3.6, -10.15));
  g.add(makeTextPlane("PHARMACY COUNTER", 6, 1, "#1fae55", 0, 2.6, -7.9));

  // waiting chairs along the right wall
  for (let i = 0; i < 3; i++) {
    g.add(waitingChair(W / 2 - 1.8, 2 + i * 2.2, -Math.PI / 2));
  }
  g.add(makeTextPlane("WAITING", 4, 0.9, "#1fae55", W / 2 - 0.4, 3.2, 4));

  g.add(makeTextPlane("MEDIORBIT", 10, 1.4, "#1fae55", 0, 6.4, D / 2 - 0.4));
  g.add(makeTextPlane("◀ EXIT", 4, 1, "#ff5544", 0, 3.4, D / 2 - 0.3));

  return {
    group: g,
    counterPosition,
    dispose() {
      g.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
      });
    },
  };
}
