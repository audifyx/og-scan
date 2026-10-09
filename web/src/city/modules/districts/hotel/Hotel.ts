/**
 * 18. SATOSHI SUITES HOTEL — enterable hotel.
 *
 * - Exterior: tall tower facade with "SATOSHI SUITES" sign + revolving door.
 * - Interior: lobby with reception desk (interact point), lounge sofas,
 *   chandelier, elevator doors, potted palms.
 */
import * as THREE from "three";
import type { DoorTrigger, Vec3T } from "../types";
import { mountAsset } from "@/city/modules/assets/loadAsset";

export const HOTEL_INTERIOR_ID = "hotel";
/** Outdoor facade footprint center — reserved city lot. */
export const HOTEL_FACADE_CENTER: Vec3T = [-120, 0, 60];
export const HOTEL_DOOR: DoorTrigger = {
  id: "door:hotel",
  label: "Satoshi Suites",
  position: [-120, 0, 75],
  radius: 4,
  prompt: "Enter Satoshi Suites",
  interiorId: HOTEL_INTERIOR_ID,
  interiorSpawn: [0, 0, 10],
  exitPosition: [-120, 0, 74],
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

/** Hotel facade. Integrator adds to the outdoor world group. */
export function buildHotelExterior(): THREE.Group {
  const g = new THREE.Group();
  const W = 36, H = 34, D = 26;

  // Procedural body — plain tower mass, swapped for real GLB towers when loaded.
  const body = new THREE.Group();
  body.userData.proceduralBody = true;
  body.add(box(W, H, D, 0x8a94a8, 0, H / 2, 0));
  for (let f = 0; f < 7; f++) {
    const band = new THREE.Mesh(
      new THREE.PlaneGeometry(W * 0.94, 1.6),
      new THREE.MeshStandardMaterial({ color: 0xbfe0ff, roughness: 0.15, metalness: 0.3, emissive: 0x88aacc, emissiveIntensity: 0.25 }),
    );
    band.position.set(0, 5 + f * 4, D / 2 + 0.1);
    body.add(band);
  }
  // rooftop crown
  body.add(box(W * 0.5, 2.4, D * 0.5, 0x6a7490, 0, H + 1.2, 0));
  g.add(body);
  // Real GLB tower stack — genuine height, not a box (Kenney CC0).
  mountAsset(g, "buildings/commercial/tower-a", { position: [-6, 0, -4], scale: 16 });
  mountAsset(g, "buildings/commercial/tower-b", { position: [16, 0, -6], scale: 11 });
  // porte-cochère canopy (signature — kept)
  g.add(box(16, 0.5, 8, 0x2a2e36, 0, 5.2, D / 2 + 4));
  for (const sx of [-7, 7]) {
    g.add(box(0.6, 5.2, 0.6, 0xd8dee6, sx, 2.6, D / 2 + 7));
  }
  // revolving door hint
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 4.4, 12, 1, false, 0, Math.PI), mat(0x3a4a5a, { transparent: true, opacity: 0.6 }));
  drum.position.set(0, 2.2, D / 2 + 0.3);
  g.add(drum);
  // sign
  g.add(box(W * 0.7, 2.0, 0.6, 0x101418, 0, H - 2, D / 2 + 0.4));
  g.add(makeTextPlane("SATOSHI SUITES", W * 0.62, 1.7, "#ffd75e", 0, H - 2, D / 2 + 0.75));
  // door glow marker
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(4.6, 4.8),
    new THREE.MeshBasicMaterial({ color: 0xffd75e, transparent: true, opacity: 0.3, side: THREE.DoubleSide }),
  );
  glow.position.set(0, 2.4, D / 2 + 0.2);
  g.add(glow);

  g.position.set(...HOTEL_FACADE_CENTER);
  return g;
}

/* --------------------------------- interior --------------------------------- */

export interface HotelInterior {
  group: THREE.Group;
  /** Reception desk position (integrator proximity-opens <HotelUI>). */
  receptionPosition: Vec3T;
  dispose(): void;
}

function sofa(x: number, z: number, ry = 0, color = 0x7a2a3a): THREE.Group {
  const s = new THREE.Group();
  s.add(box(3.4, 0.7, 1.4, color, 0, 0.55, 0)); // seat
  s.add(box(3.4, 1.1, 0.35, color, 0, 1.1, -0.55)); // back
  s.add(box(0.35, 1.1, 1.4, color, -1.55, 0.9, 0)); // arms
  s.add(box(0.35, 1.1, 1.4, color, 1.55, 0.9, 0));
  s.position.set(x, 0, z);
  s.rotation.y = ry;
  return s;
}

function palm(x: number, z: number): THREE.Group {
  const p = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 3.2, 8), mat(0x6a4a2a));
  trunk.position.y = 1.6;
  trunk.castShadow = true;
  p.add(trunk);
  for (let i = 0; i < 6; i++) {
    const frond = new THREE.Mesh(new THREE.ConeGeometry(0.5, 2.2, 6), mat(0x2a8a4a, { roughness: 0.8 }));
    const a = (i / 6) * Math.PI * 2;
    frond.position.set(Math.cos(a) * 0.9, 3.6, Math.sin(a) * 0.9);
    frond.rotation.z = Math.cos(a) * 1.1;
    frond.rotation.x = -Math.sin(a) * 1.1;
    p.add(frond);
  }
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.45, 0.8, 10), mat(0x8a5a3a));
  pot.position.y = 0.4;
  p.add(pot);
  p.position.set(x, 0, z);
  return p;
}

export function buildHotelInterior(): HotelInterior {
  const g = new THREE.Group();
  const W = 36, D = 26, H = 8;

  // warm wood floor
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), mat(0x8a6a4a, { roughness: 0.5 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  g.add(floor);
  // red carpet runner
  const carpet = new THREE.Mesh(new THREE.PlaneGeometry(4, D - 4), mat(0x8a1f2e, { roughness: 0.9 }));
  carpet.rotation.x = -Math.PI / 2;
  carpet.position.set(0, 0.02, 0);
  g.add(carpet);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), mat(0xf0e8d8));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = H;
  g.add(ceil);
  const wallMat = mat(0xe8dcc0);
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

  // bright daytime lobby (sun pinned at noon — no night lighting)
  const key = new THREE.PointLight(0xfff2dd, 750, 75);
  key.position.set(0, H - 1, 0);
  g.add(key);

  // grand chandelier
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 2.4, 8), mat(0x8a7a4a, { metalness: 0.7 }));
  stem.position.set(0, H - 1.2, 0);
  g.add(stem);
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.2 + i * 0.7, 0.14, 8, 20), mat(0xd8b84a, { metalness: 0.85, roughness: 0.3 }));
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, H - 2.6 - i * 0.5, 0);
    g.add(ring);
  }

  // reception desk (interact point)
  const receptionPosition: Vec3T = [0, 0, -9];
  g.add(box(8, 1.3, 2.2, 0x5a3a2a, 0, 0.65, -9));
  g.add(box(8.4, 0.18, 2.6, 0xd8b84a, 0, 1.4, -9));
  const bell = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xd8b84a, { metalness: 0.9 }));
  bell.position.set(2.5, 1.5, -9);
  g.add(bell);
  g.add(makeTextPlane("RECEPTION", 6, 1.1, "#8a6a1a", 0, 4.4, -10.2));

  // lounge sofas + coffee tables
  g.add(sofa(-11, 2, Math.PI / 2));
  g.add(sofa(11, 2, -Math.PI / 2));
  g.add(box(1.6, 0.5, 2.6, 0x4a3a2a, -11, 0.25, 5.5));
  g.add(box(1.6, 0.5, 2.6, 0x4a3a2a, 11, 0.25, 5.5));

  // elevator doors on the left wall
  for (const z of [-4, 2]) {
    g.add(box(0.3, 4.2, 3.2, 0x9aa2b0, -W / 2 + 0.4, 2.1, z));
    g.add(box(0.35, 4.2, 0.12, 0x3a3f46, -W / 2 + 0.4, 2.1, z));
  }
  g.add(makeTextPlane("ELEVATORS", 5, 1, "#5a6a7a", -W / 2 + 0.8, 5.2, -1));

  // potted palms
  g.add(palm(-15, -10));
  g.add(palm(15, -10));
  g.add(palm(-15, 10));
  g.add(palm(15, 10));

  g.add(makeTextPlane("SATOSHI SUITES", 12, 1.6, "#8a6a1a", 0, 6.6, -D / 2 + 0.4));
  g.add(makeTextPlane("◀ EXIT", 4, 1, "#ff5544", 0, 3.4, D / 2 - 0.3));

  return {
    group: g,
    receptionPosition,
    dispose() {
      g.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
      });
    },
  };
}
