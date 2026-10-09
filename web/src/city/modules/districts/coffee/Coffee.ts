/**
 * 14. MOONBEAM COFFEE — enterable coffee shop.
 *
 * - Exterior: storefront facade at COFFEE_FACADE_CENTER (reserved city lot —
 *   see FACADE_PLOTS) with glass front + crescent-moon sign.
 * - Interior: espresso counter (interact point), pastry display case, cafe
 *   tables with chairs, menu board, warm lighting.
 */
import * as THREE from "three";
import type { DoorTrigger, Vec3T } from "../types";
import { mountAsset } from "@/city/modules/assets/loadAsset";

export const COFFEE_INTERIOR_ID = "coffee";
/** Outdoor facade footprint center — the reserved city lot (see FACADE_PLOTS). */
export const COFFEE_FACADE_CENTER: Vec3T = [-156, 0, -68];
export const COFFEE_DOOR: DoorTrigger = {
  id: "door:coffee",
  label: "Moonbeam Coffee",
  position: [-156, 0, -53],
  radius: 4,
  prompt: "Enter Moonbeam Coffee",
  interiorId: COFFEE_INTERIOR_ID,
  interiorSpawn: [0, 0, 10],
  exitPosition: [-156, 0, -54],
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

/** Crescent moon sign plane (drawn on canvas — no emoji). */
function makeMoonSign(w: number, h: number, x: number, y: number, z: number) {
  const c = document.createElement("canvas");
  c.width = 256; c.height = 256;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#0a0c10";
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = "#ffd166";
  ctx.beginPath();
  ctx.arc(128, 128, 80, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#0a0c10";
  ctx.beginPath();
  ctx.arc(168, 100, 66, 0, Math.PI * 2);
  ctx.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
  m.position.set(x, y, z);
  return m;
}

/* --------------------------------- exterior --------------------------------- */

/** Coffee storefront. Integrator adds to the outdoor world group. */
export function buildCoffeeExterior(): THREE.Group {
  const g = new THREE.Group();
  const W = 36, H = 9, D = 24;

  // Procedural body — fallback until the GLB strip loads.
  const body = new THREE.Group();
  body.userData.proceduralBody = true;
  body.add(box(W, H, D, 0x8a7a66, 0, H / 2, 0));
  // glass storefront
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(W * 0.9, H * 0.62),
    new THREE.MeshStandardMaterial({ color: 0xffe9b0, transparent: true, opacity: 0.5, roughness: 0.2, emissive: 0xffd9a0, emissiveIntensity: 0.4 }),
  );
  glass.position.set(0, H * 0.42, D / 2 + 0.1);
  body.add(glass);
  // warm cream awning stripes
  for (let i = 0; i < 9; i++) {
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(W * 0.1, 0.18, 2.4),
      mat(i % 2 === 0 ? 0xd8a02e : 0xf5efe0),
    );
    stripe.position.set(-W * 0.45 + i * W * 0.1 + W * 0.05, H * 0.78, D / 2 + 1.2);
    stripe.rotation.x = 0.25;
    body.add(stripe);
  }
  g.add(body);
  // Real GLB commercial strip (Kenney CC0) — swaps the procedural body when loaded.
  mountAsset(g, "buildings/commercial/shop-a", { position: [-10, 0, 0], scale: 10 });
  mountAsset(g, "buildings/commercial/shop-e", { position: [7, 0, 0], scale: 10 });
  // sign
  g.add(box(W * 0.72, 1.8, 0.6, 0x101418, 0, H - 1.4, D / 2 + 0.4));
  g.add(makeTextPlane("MOONBEAM COFFEE", W * 0.56, 1.5, "#ffd166", 0.8, H - 1.4, D / 2 + 0.75));
  g.add(makeMoonSign(1.6, 1.6, -W * 0.32, H - 1.4, D / 2 + 0.75));
  // door glow marker
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(3.6, 4.4),
    new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.3, side: THREE.DoubleSide }),
  );
  glow.position.set(0, 2.2, D / 2 + 0.2);
  g.add(glow);

  g.position.set(...COFFEE_FACADE_CENTER);
  return g;
}

/* --------------------------------- interior --------------------------------- */

export interface CoffeeInterior {
  group: THREE.Group;
  /** Espresso counter position (integrator proximity-opens <CoffeeUI>). */
  counterPosition: Vec3T;
  dispose(): void;
}

function cafeTable(x: number, z: number): THREE.Group {
  const t = new THREE.Group();
  const top = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.12, 16), mat(0x6b4e32, { roughness: 0.5 }));
  top.position.y = 1.0;
  top.castShadow = true;
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 1.0, 10), mat(0x2a2e35, { metalness: 0.7 }));
  leg.position.y = 0.5;
  t.add(top, leg);
  for (const sx of [-1, 1]) {
    const chair = new THREE.Group();
    chair.add(box(0.85, 0.15, 0.85, 0x3a2e20, 0, 0.62, 0));
    chair.add(box(0.85, 1.05, 0.14, 0x3a2e20, 0, 1.15, -0.4));
    chair.position.set(sx * 1.7, 0, 0);
    chair.rotation.y = sx > 0 ? -Math.PI / 2 : Math.PI / 2;
    t.add(chair);
  }
  t.position.set(x, 0, z);
  return t;
}

export function buildCoffeeInterior(): CoffeeInterior {
  const g = new THREE.Group();
  const W = 36, D = 24, H = 8;

  // warm wood floor
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), mat(0x7a5c3e, { roughness: 0.5 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  g.add(floor);
  // dark wood planks inlay
  for (let ix = 0; ix < 9; ix++) {
    const plank = new THREE.Mesh(new THREE.PlaneGeometry(1.6, D - 2), mat(0x5c4430, { roughness: 0.55 }));
    plank.rotation.x = -Math.PI / 2;
    plank.position.set(-W / 2 + 2 + ix * 4, 0.015, 0);
    g.add(plank);
  }
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), mat(0x16120e));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = H;
  g.add(ceil);
  const wallMat = mat(0x4a3d30);
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

  // warm lighting
  const key = new THREE.PointLight(0xffc880, 900, 60);
  key.position.set(0, H - 1, 0);
  g.add(key);
  const warm = new THREE.PointLight(0xff9a4a, 300, 35);
  warm.position.set(8, H - 1, -6);
  g.add(warm);
  // hanging pendant bulbs over the tables
  for (const [x, z] of [[-8, 2], [8, 2]] as const) {
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 6), mat(0x111111));
    cord.position.set(x, H - 0.8, z);
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xffb050, emissiveIntensity: 2 }),
    );
    bulb.position.set(x, H - 1.8, z);
    g.add(cord, bulb);
  }

  // espresso counter at the back
  const counterPosition: Vec3T = [0, 0, -6];
  g.add(box(9, 1.15, 2.2, 0x4a3626, 0, 0.575, -8));
  g.add(box(9.4, 0.18, 2.6, 0x2a1e14, 0, 1.24, -8));
  // espresso machine
  g.add(box(2.6, 1.5, 1.6, 0xb8bec8, -2.4, 2.1, -8));
  g.add(box(2.6, 0.5, 1.2, 0x2a2e35, -2.4, 3.05, -8));
  for (const dx of [-0.6, 0.6]) {
    g.add(box(0.28, 0.35, 0.28, 0x111318, -2.4 + dx, 1.45, -7.4)); // group heads
  }
  g.add(box(1.2, 0.1, 0.9, 0x2a2e35, -2.4, 1.4, -7.5)); // drip tray
  // cup stack
  for (let i = 0; i < 3; i++) {
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.14, 0.22, 10), mat(0xf5efe0, { roughness: 0.4 }));
    cup.position.set(1.6, 1.45 + i * 0.24, -8);
    g.add(cup);
  }
  g.add(makeTextPlane("ORDER HERE", 5, 1, "#ffd166", 0, 3.2, -6.9));

  // pastry display case
  const caseBase = box(5, 1.0, 1.6, 0x4a3626, 7.5, 0.5, -8);
  g.add(caseBase);
  const caseGlass = new THREE.Mesh(
    new THREE.BoxGeometry(5, 1.1, 1.6),
    new THREE.MeshStandardMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.35, roughness: 0.15 }),
  );
  caseGlass.position.set(7.5, 1.65, -8);
  g.add(caseGlass);
  const pastryColors = [0xd8a02e, 0xc98a5a, 0xe8c87a, 0xb87848];
  for (let k = 0; k < 4; k++) {
    const pastry = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.35, 0.7), mat(pastryColors[k], { roughness: 0.6 }));
    pastry.position.set(5.8 + k * 1.15, 1.2, -8);
    g.add(pastry);
  }

  // menu board on the back wall
  g.add(box(8, 4.4, 0.2, 0x1a140e, -8, 4.6, -D / 2 + 0.15));
  g.add(makeTextPlane("ESPRESSO  LATTE  CAPPUCCINO", 7.4, 1.1, "#ffd166", -8, 5.8, -D / 2 + 0.28));
  g.add(makeTextPlane("MOCHA  COLD BREW  PASTRIES", 7.4, 1.1, "#ffd166", -8, 4.4, -D / 2 + 0.28));
  g.add(makeMoonSign(1.8, 1.8, 8, 5.6, -D / 2 + 0.28));

  // cafe tables
  g.add(cafeTable(-8, 3));
  g.add(cafeTable(8, 3));
  g.add(cafeTable(-8, -2));
  g.add(cafeTable(8, -2));

  g.add(makeTextPlane("MOONBEAM COFFEE", 10, 1.4, "#ffd166", 0, 6.4, D / 2 - 0.4));
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
