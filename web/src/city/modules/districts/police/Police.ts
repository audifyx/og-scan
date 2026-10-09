/**
 * 20. ORBITX POLICE DEPARTMENT — enterable police station.
 *
 * - Exterior: blue-brick facade with "ORBITX PD" sign + parked cruiser.
 * - Interior: front desk (interact point: pay fines), holding cells,
 *   evidence board, wanted posters.
 */
import * as THREE from "three";
import type { DoorTrigger, Vec3T } from "../types";
import { mountAsset } from "@/city/modules/assets/loadAsset";

export const POLICE_INTERIOR_ID = "police";
/** Outdoor facade footprint center — reserved city lot. */
export const POLICE_FACADE_CENTER: Vec3T = [-40, 0, -150];
export const POLICE_DOOR: DoorTrigger = {
  id: "door:police",
  label: "OrbitX Police Dept",
  position: [-40, 0, -135],
  radius: 4,
  prompt: "Enter OrbitX Police Dept",
  interiorId: POLICE_INTERIOR_ID,
  interiorSpawn: [0, 0, 10],
  exitPosition: [-40, 0, -136],
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

/** Police facade. Integrator adds to the outdoor world group. */
export function buildPoliceExterior(): THREE.Group {
  const g = new THREE.Group();
  const W = 40, H = 10, D = 28;

  // Procedural body — blue-brick mass, swapped for a real GLB station when loaded.
  const body = new THREE.Group();
  body.userData.proceduralBody = true;
  body.add(box(W, H, D, 0x3a4a6a, 0, H / 2, 0));
  g.add(body);
  // Real GLB station house (Kenney CC0).
  mountAsset(g, "buildings/commercial/shop-h", { position: [0, 0, -4], scale: 13 });
  // white trim band (signature — kept)
  g.add(box(W + 0.4, 1.0, D + 0.4, 0xe8ecf2, 0, H - 0.5, 0));
  // badge emblem (gold shield-ish octagon)
  const badge = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 0.4, 8), mat(0xd8b84a, { metalness: 0.8, roughness: 0.3 }));
  badge.rotation.x = Math.PI / 2;
  badge.position.set(0, H - 3.4, D / 2 + 0.3);
  g.add(badge);
  // glass entrance
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(7, 5),
    new THREE.MeshStandardMaterial({ color: 0xb8d8ff, transparent: true, opacity: 0.5, roughness: 0.2, emissive: 0x88aacc, emissiveIntensity: 0.35 }),
  );
  glass.position.set(0, 2.6, D / 2 + 0.1);
  g.add(glass);
  // sign
  g.add(box(W * 0.6, 1.8, 0.6, 0x0c1420, 0, H - 1.2, D / 2 + 0.4));
  g.add(makeTextPlane("ORBITX PD", W * 0.52, 1.5, "#8ab8ff", 0, H - 1.2, D / 2 + 0.75));
  // Real police cruiser (Kenney CC0) — parked out front, daytime static.
  const cruiser = new THREE.Group();
  cruiser.position.set(12, 0, D / 2 + 6);
  cruiser.rotation.y = -0.15;
  mountAsset(cruiser, "vehicles/police", { scale: 4 });
  g.add(cruiser);
  // door glow marker
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(4, 5.2),
    new THREE.MeshBasicMaterial({ color: 0x8ab8ff, transparent: true, opacity: 0.3, side: THREE.DoubleSide }),
  );
  glow.position.set(0, 2.6, D / 2 + 0.2);
  g.add(glow);

  g.position.set(...POLICE_FACADE_CENTER);
  return g;
}

/* --------------------------------- interior --------------------------------- */

export interface PoliceInterior {
  group: THREE.Group;
  /** Front desk position (integrator proximity-opens <PoliceUI>: pay fines). */
  deskPosition: Vec3T;
  dispose(): void;
}

function holdingCell(x: number, z: number): THREE.Group {
  const cell = new THREE.Group();
  const W = 5, H = 3.4, D = 4;
  // back + side walls
  cell.add(box(W, H, 0.3, 0x8a94a8, 0, H / 2, -D / 2));
  cell.add(box(0.3, H, D, 0x8a94a8, -W / 2, H / 2, 0));
  cell.add(box(0.3, H, D, 0x8a94a8, W / 2, H / 2, 0));
  // bars across the front
  for (let i = 0; i < 6; i++) {
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, H, 8), mat(0x3a3f46, { metalness: 0.7 }));
    bar.position.set(-W / 2 + 0.5 + i * ((W - 1) / 5), H / 2, D / 2);
    cell.add(bar);
  }
  // bunk
  cell.add(box(3.4, 0.25, 1.4, 0x5a6a7a, 0, 0.7, -D / 2 + 1.2));
  cell.position.set(x, 0, z);
  return cell;
}

export function buildPoliceInterior(): PoliceInterior {
  const g = new THREE.Group();
  const W = 40, D = 28, H = 8;

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), mat(0x9aa2b0, { roughness: 0.6 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  g.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), mat(0xe8ecf2));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = H;
  g.add(ceil);
  const wallMat = mat(0xd8dee8);
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
  // blue accent stripe
  g.add(box(W, 0.8, 0.1, 0x2a4a8a, 0, 5.6, -D / 2 + 0.1));

  // bright daytime light
  const key = new THREE.PointLight(0xf0f4ff, 750, 75);
  key.position.set(0, H - 1, 0);
  g.add(key);

  // front desk (interact point: pay fines)
  const deskPosition: Vec3T = [0, 0, -8];
  g.add(box(7, 1.25, 2.2, 0x2a3a5a, 0, 0.62, -8));
  g.add(box(7.4, 0.15, 2.5, 0x8ab8ff, 0, 1.32, -8));
  g.add(makeTextPlane("FRONT DESK — PAY FINES", 6.4, 1.0, "#8ab8ff", 0, 3.6, -9.2));

  // evidence board
  g.add(box(7, 4.4, 0.25, 0x6a5a4a, -12, 3.4, -D / 2 + 0.3));
  for (let i = 0; i < 6; i++) {
    const note = new THREE.Mesh(
      new THREE.PlaneGeometry(0.9, 1.1),
      new THREE.MeshStandardMaterial({ color: [0xfff2cc, 0xffcccc, 0xccffcc][i % 3], roughness: 0.9 }),
    );
    note.position.set(-14.2 + (i % 3) * 2.2, 3.8 - Math.floor(i / 3) * 1.6, -D / 2 + 0.45);
    g.add(note);
  }
  // red string lines between notes
  for (let i = 0; i < 4; i++) {
    const str = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.4, 4), mat(0xd83a3a));
    str.rotation.z = 0.5 + i * 0.3;
    str.position.set(-13 + i * 1.2, 3.4, -D / 2 + 0.5);
    g.add(str);
  }

  // wanted posters
  for (const [x, label] of [[8, "WANTED: RUG PULLER"], [13.5, "WANTED: HONEYPOT"]] as const) {
    g.add(box(3.4, 4.4, 0.15, 0xe8e4d8, x, 3.6, -D / 2 + 0.2));
    g.add(makeTextPlane(label, 3.0, 0.7, "#a02a2a", x, 4.9, -D / 2 + 0.32));
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.9, 12), mat(0x8a94a8));
    face.position.set(x, 3.2, -D / 2 + 0.32);
    g.add(face);
  }

  // holding cells along the right wall
  g.add(holdingCell(W / 2 - 4.5, -6));
  g.add(holdingCell(W / 2 - 4.5, 2));

  g.add(makeTextPlane("ORBITX POLICE DEPT", 11, 1.5, "#2a4a8a", 0, 6.8, -D / 2 + 0.4));
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
