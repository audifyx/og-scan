/**
 * 13. SHARP CUTS — enterable barber shop.
 *
 * - Exterior: storefront facade at BARBER_FACADE_CENTER (reserved city lot —
 *   see FACADE_PLOTS) with glass front + red/white awning + "SHARP CUTS" sign.
 * - Interior: 3 barber chairs with chrome bases, big mirrors, striped barber
 *   poles, waiting bench, checkered floor inlay (chair = interact point).
 */
import * as THREE from "three";
import type { DoorTrigger, Vec3T } from "../types";

export const BARBER_INTERIOR_ID = "barber";
/** Outdoor facade footprint center — the reserved city lot (see FACADE_PLOTS). */
export const BARBER_FACADE_CENTER: Vec3T = [156, 0, 78];
export const BARBER_DOOR: DoorTrigger = {
  id: "door:barber",
  label: "Sharp Cuts",
  position: [156, 0, 93],
  radius: 4,
  prompt: "Enter Sharp Cuts",
  interiorId: BARBER_INTERIOR_ID,
  interiorSpawn: [0, 0, 10],
  exitPosition: [156, 0, 92],
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

/* --------------------------------- exterior --------------------------------- */

/** Barber storefront. Integrator adds to the outdoor world group. */
export function buildBarberExterior(): THREE.Group {
  const g = new THREE.Group();
  const W = 36, H = 9, D = 24;

  g.add(box(W, H, D, 0x9a8f80, 0, H / 2, 0));
  // glass storefront
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(W * 0.9, H * 0.62),
    new THREE.MeshStandardMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.5, roughness: 0.2, emissive: 0xa0c8e8, emissiveIntensity: 0.3 }),
  );
  glass.position.set(0, H * 0.42, D / 2 + 0.1);
  g.add(glass);
  // red/white awning stripes
  for (let i = 0; i < 9; i++) {
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(W * 0.1, 0.18, 2.4),
      mat(i % 2 === 0 ? 0xc23b3b : 0xf0f0f0),
    );
    stripe.position.set(-W * 0.45 + i * W * 0.1 + W * 0.05, H * 0.78, D / 2 + 1.2);
    stripe.rotation.x = 0.25;
    g.add(stripe);
  }
  // sign
  g.add(box(W * 0.72, 1.8, 0.6, 0x101418, 0, H - 1.4, D / 2 + 0.4));
  g.add(makeTextPlane("SHARP CUTS", W * 0.64, 1.5, "#ff6b6b", 0, H - 1.4, D / 2 + 0.75));
  // barber pole by the door
  const pole = barberPole();
  pole.position.set(4.5, 0, D / 2 + 0.6);
  g.add(pole);
  // door glow marker
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(3.6, 4.4),
    new THREE.MeshBasicMaterial({ color: 0xff6b6b, transparent: true, opacity: 0.3, side: THREE.DoubleSide }),
  );
  glow.position.set(0, 2.2, D / 2 + 0.2);
  g.add(glow);

  g.position.set(...BARBER_FACADE_CENTER);
  return g;
}

/** Classic striped barber pole: stacked red/white/blue segments + chrome caps. */
function barberPole(): THREE.Group {
  const p = new THREE.Group();
  const chrome = mat(0xd8dee6, { metalness: 0.9, roughness: 0.25 });
  const capT = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.25, 12), chrome);
  capT.position.y = 3.6;
  const capB = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.25, 12), chrome);
  capB.position.y = 0.9;
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.0, 8), chrome);
  post.position.y = 0.45;
  p.add(capT, capB, post);
  const stripeColors = [0xc23b3b, 0xf0f0f0, 0x2a6bc2];
  for (let i = 0; i < 7; i++) {
    const seg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.34, 0.34, 12),
      mat(stripeColors[i % 3], { roughness: 0.4 }),
    );
    seg.position.y = 1.15 + i * 0.34;
    seg.castShadow = true;
    p.add(seg);
  }
  return p;
}

/* --------------------------------- interior --------------------------------- */

export interface BarberInterior {
  group: THREE.Group;
  /** Barber chair position (integrator proximity-opens <BarberUI>). */
  chairPosition: Vec3T;
  dispose(): void;
}

function barberChair(x: number, z: number, ry = 0): THREE.Group {
  const c = new THREE.Group();
  const chrome = mat(0xd8dee6, { metalness: 0.9, roughness: 0.25 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 0.4, 14), chrome);
  base.position.y = 0.2;
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.6, 10), chrome);
  column.position.y = 0.7;
  c.add(base, column);
  c.add(box(1.7, 0.35, 1.7, 0x8a1f1f, 0, 1.15, 0)); // seat
  const back = box(1.7, 1.7, 0.32, 0x8a1f1f, 0, 2.0, -0.85); // backrest
  back.rotation.x = -0.12;
  c.add(back);
  c.add(box(0.18, 0.55, 1.3, 0xd8dee6, -0.9, 1.5, 0)); // armrests
  c.add(box(0.18, 0.55, 1.3, 0xd8dee6, 0.9, 1.5, 0));
  const rest = box(1.5, 0.18, 0.5, 0xd8dee6, 0, 0.75, 1.0); // footrest
  rest.rotation.x = 0.3;
  c.add(rest);
  c.position.set(x, 0, z);
  c.rotation.y = ry;
  return c;
}

export function buildBarberInterior(): BarberInterior {
  const g = new THREE.Group();
  const W = 36, D = 24, H = 8;

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), mat(0xe8e4da, { roughness: 0.4 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  g.add(floor);
  // checkered floor inlay
  for (let ix = 0; ix < 9; ix++) {
    for (let iz = 0; iz < 6; iz++) {
      if ((ix + iz) % 2 !== 0) continue;
      const tile = new THREE.Mesh(
        new THREE.PlaneGeometry(2, 2),
        new THREE.MeshStandardMaterial({ color: 0x22262c, roughness: 0.5 }),
      );
      tile.rotation.x = -Math.PI / 2;
      tile.position.set(-W / 2 + 2 + ix * 4, 0.02, -D / 2 + 2 + iz * 4);
      g.add(tile);
    }
  }
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), mat(0x14161a));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = H;
  g.add(ceil);
  const wallMat = mat(0x4a4440);
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

  const key = new THREE.PointLight(0xfff2d0, 800, 60);
  key.position.set(0, H - 1, 0);
  g.add(key);
  const accent = new THREE.PointLight(0xff6b6b, 200, 30);
  accent.position.set(-10, H - 1, -6);
  g.add(accent);

  // 3 barber chairs facing the mirrors on the back wall
  const chairXs = [-10, 0, 10];
  for (const x of chairXs) {
    g.add(barberChair(x, -2, Math.PI));
    // big mirror above/behind each chair
    const mirror = new THREE.Mesh(
      new THREE.PlaneGeometry(3.2, 3.6),
      new THREE.MeshStandardMaterial({ color: 0xcfe8ff, metalness: 1, roughness: 0.12 }),
    );
    mirror.position.set(x, 4.2, -D / 2 + 0.15);
    g.add(mirror);
    g.add(box(3.6, 4.0, 0.15, 0x2a2e35, x, 4.2, -D / 2 + 0.02));
  }

  // barber poles flanking the entrance
  const poleL = barberPole();
  poleL.position.set(-W / 2 + 1.2, 0, D / 2 - 1.5);
  const poleR = barberPole();
  poleR.position.set(W / 2 - 1.2, 0, D / 2 - 1.5);
  g.add(poleL, poleR);

  // waiting bench along the right wall
  g.add(box(1.4, 0.5, 7, 0x3a2e20, W / 2 - 1.4, 0.65, 2));
  g.add(box(1.4, 0.25, 7, 0x1e1812, W / 2 - 1.4, 0.95, 2));
  g.add(box(0.25, 1.6, 7, 0x3a2e20, W / 2 - 0.7, 1.5, 2));

  // back-wall product shelf
  g.add(box(10, 0.25, 1.2, 0x5a5348, 0, 2.4, -D / 2 + 0.9));
  const shelfColors = [0xc23b3b, 0x2a6bc2, 0x2e9e5a, 0xd8a02e, 0x7a3bc2, 0xf0f0f0];
  for (let k = 0; k < 6; k++) {
    const prod = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.8 + (k % 3) * 0.3, 0.9),
      mat(shelfColors[k % shelfColors.length]),
    );
    prod.position.set(-3.8 + k * 1.5, 2.95 + ((k % 3) * 0.3) / 2, -D / 2 + 0.9);
    prod.castShadow = true;
    g.add(prod);
  }

  const chairPosition: Vec3T = [0, 0, -2];
  g.add(makeTextPlane("SHARP CUTS", 10, 1.4, "#ff6b6b", 0, 6.2, -D / 2 + 0.4));
  g.add(makeTextPlane("◀ EXIT", 4, 1, "#ff5544", 0, 3.4, D / 2 - 0.3));

  return {
    group: g,
    chairPosition,
    dispose() {
      g.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
      });
    },
  };
}
