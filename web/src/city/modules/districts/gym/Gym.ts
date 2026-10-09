/**
 * 16. IRON ORBIT GYM — enterable gym.
 *
 * - Exterior: industrial facade at GYM_FACADE_CENTER (reserved city lot —
 *   see FACADE_PLOTS) with glass front + "IRON ORBIT GYM" sign.
 * - Interior: treadmills, weight benches, plate rack (interact point),
 *   mirrors, rubber floor, dark industrial lighting.
 */
import * as THREE from "three";
import type { DoorTrigger, Vec3T } from "../types";
import { mountAsset } from "@/city/modules/assets/loadAsset";

export const GYM_INTERIOR_ID = "gym";
/** Outdoor facade footprint center — the reserved city lot (see FACADE_PLOTS). */
export const GYM_FACADE_CENTER: Vec3T = [-78, 0, 156];
export const GYM_DOOR: DoorTrigger = {
  id: "door:gym",
  label: "Iron Orbit Gym",
  position: [-78, 0, 171],
  radius: 4,
  prompt: "Enter Iron Orbit Gym",
  interiorId: GYM_INTERIOR_ID,
  interiorSpawn: [0, 0, 10],
  exitPosition: [-78, 0, 170],
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

/** Gym facade. Integrator adds to the outdoor world group. */
export function buildGymExterior(): THREE.Group {
  const g = new THREE.Group();
  const W = 40, H = 10, D = 28;

  // Procedural body — fallback until the GLB strip loads.
  const body = new THREE.Group();
  body.userData.proceduralBody = true;
  body.add(box(W, H, D, 0x3a3f46, 0, H / 2, 0));
  // glass storefront
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(W * 0.9, H * 0.6),
    new THREE.MeshStandardMaterial({ color: 0xb8d8ff, transparent: true, opacity: 0.5, roughness: 0.2, emissive: 0x88aacc, emissiveIntensity: 0.35 }),
  );
  glass.position.set(0, H * 0.42, D / 2 + 0.1);
  body.add(glass);
  // dark steel awning
  const awning = box(W * 0.9, 0.25, 3, 0x1a1d22, 0, H * 0.74, D / 2 + 1.4);
  awning.rotation.x = 0.2;
  body.add(awning);
  g.add(body);
  // Real GLB commercial strip (Kenney CC0) — swaps the procedural body when loaded.
  mountAsset(g, "buildings/commercial/shop-g", { position: [-11, 0, 0], scale: 8 });
  mountAsset(g, "buildings/commercial/shop-h", { position: [8, 0, 0], scale: 8 });
  // sign
  g.add(box(W * 0.72, 1.8, 0.6, 0x0c0e12, 0, H - 1.4, D / 2 + 0.4));
  g.add(makeTextPlane("IRON ORBIT GYM", W * 0.64, 1.5, "#ff8c42", 0, H - 1.4, D / 2 + 0.75));
  // dumbbell plate stacks flanking the door
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const plate = new THREE.Mesh(
        new THREE.CylinderGeometry(0.55 - i * 0.1, 0.55 - i * 0.1, 0.18, 14),
        mat(0x22262c, { metalness: 0.6, roughness: 0.4 }),
      );
      plate.position.set(sx * 4.5, 0.25 + i * 0.2, D / 2 + 0.8);
      plate.castShadow = true;
      g.add(plate);
    }
  }
  // door glow marker
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(3.6, 4.6),
    new THREE.MeshBasicMaterial({ color: 0xff8c42, transparent: true, opacity: 0.3, side: THREE.DoubleSide }),
  );
  glow.position.set(0, 2.3, D / 2 + 0.2);
  g.add(glow);

  g.position.set(...GYM_FACADE_CENTER);
  return g;
}

/* --------------------------------- interior --------------------------------- */

export interface GymInterior {
  group: THREE.Group;
  /** Weight rack position (integrator proximity-opens <GymUI>). */
  rackPosition: Vec3T;
  dispose(): void;
}

function treadmill(x: number, z: number): THREE.Group {
  const t = new THREE.Group();
  t.add(box(0.9, 0.3, 2.4, 0x22262c, 0, 0.35, 0)); // belt deck
  t.add(box(0.7, 0.08, 2.0, 0x111318, 0, 0.52, 0)); // belt surface
  for (const sx of [-0.55, 0.55]) {
    const post = box(0.12, 1.7, 0.12, 0x3a3f46, sx, 1.1, 1.15);
    post.rotation.x = -0.15;
    t.add(post);
  }
  t.add(box(1.3, 0.55, 0.25, 0x3a3f46, 0, 1.95, 1.3)); // console
  t.add(box(0.9, 0.3, 0.06, 0x22e5ff, 0, 1.95, 1.42)); // console screen glow
  t.position.set(x, 0, z);
  return t;
}

function weightBench(x: number, z: number, ry = 0): THREE.Group {
  const b = new THREE.Group();
  b.add(box(0.7, 0.18, 2.2, 0x8a1f1f, 0, 0.85, 0)); // pad
  for (const dz of [-0.8, 0.8]) {
    b.add(box(0.12, 0.75, 0.12, 0x3a3f46, 0, 0.4, dz)); // legs
  }
  b.position.set(x, 0, z);
  b.rotation.y = ry;
  return b;
}

function weightRack(x: number, z: number): THREE.Group {
  const r = new THREE.Group();
  // frame posts
  for (const [dx, dz] of [[-1.2, -0.7], [1.2, -0.7], [-1.2, 0.7], [1.2, 0.7]] as const) {
    r.add(box(0.22, 2.6, 0.22, 0x3a3f46, dx, 1.3, dz));
  }
  r.add(box(2.6, 0.22, 0.22, 0x3a3f46, 0, 2.6, -0.7));
  r.add(box(2.6, 0.22, 0.22, 0x3a3f46, 0, 2.6, 0.7));
  // plate pegs with plates
  const plateColors = [0xc23b3b, 0x2a6bc2, 0xd8a02e];
  for (let s = 0; s < 3; s++) {
    const peg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.0, 8), mat(0xd8dee6, { metalness: 0.8 }));
    peg.rotation.z = Math.PI / 2;
    peg.position.set(-0.9, 0.6 + s * 0.55, 0.7);
    r.add(peg);
    for (let k = 0; k < 2 + s; k++) {
      const plate = new THREE.Mesh(
        new THREE.CylinderGeometry(0.42 - s * 0.06, 0.42 - s * 0.06, 0.14, 14),
        mat(plateColors[s], { roughness: 0.5 }),
      );
      plate.rotation.z = Math.PI / 2;
      plate.position.set(-0.35 - k * 0.16, 0.6 + s * 0.55, 0.7);
      plate.castShadow = true;
      r.add(plate);
    }
  }
  // barbell resting on the frame
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.4, 8), mat(0xd8dee6, { metalness: 0.85 }));
  bar.rotation.z = Math.PI / 2;
  bar.position.set(0, 2.75, -0.7);
  r.add(bar);
  r.position.set(x, 0, z);
  return r;
}

export function buildGymInterior(): GymInterior {
  const g = new THREE.Group();
  const W = 40, D = 28, H = 8;

  // rubber floor
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), mat(0x1c1f24, { roughness: 0.9 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  g.add(floor);
  // orange rubber-tile inlay around the lifting zone
  for (let ix = 0; ix < 5; ix++) {
    for (let iz = 0; iz < 3; iz++) {
      const tile = new THREE.Mesh(
        new THREE.PlaneGeometry(2.4, 2.4),
        new THREE.MeshStandardMaterial({ color: 0xb85a1e, roughness: 0.85 }),
      );
      tile.rotation.x = -Math.PI / 2;
      tile.position.set(-6 + ix * 3, 0.015, -10 + iz * 3);
      g.add(tile);
    }
  }
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), mat(0x101216));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = H;
  g.add(ceil);
  const wallMat = mat(0x2e3339);
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

  // dark industrial lighting
  const key = new THREE.PointLight(0xd8e8ff, 700, 70);
  key.position.set(0, H - 1, 0);
  g.add(key);
  const orange = new THREE.PointLight(0xff8c42, 250, 35);
  orange.position.set(0, H - 1, -9);
  g.add(orange);

  // treadmills along the left side
  g.add(treadmill(-13, 4));
  g.add(treadmill(-13, -1));
  // weight benches in the middle
  g.add(weightBench(6, 3, Math.PI / 2));
  g.add(weightBench(6, -2, Math.PI / 2));
  // plate rack zone (interact point)
  const rackPosition: Vec3T = [-2, 0, -9];
  g.add(weightRack(-2, -9));

  // mirrors on the back wall
  for (const x of [-8, 0, 8]) {
    const mirror = new THREE.Mesh(
      new THREE.PlaneGeometry(5, 3.4),
      new THREE.MeshStandardMaterial({ color: 0xcfe8ff, metalness: 1, roughness: 0.12 }),
    );
    mirror.position.set(x, 4.0, -D / 2 + 0.15);
    g.add(mirror);
    g.add(box(5.4, 3.8, 0.15, 0x14161a, x, 4.0, -D / 2 + 0.02));
  }

  // dumbbell row along the right wall
  for (let i = 0; i < 4; i++) {
    const db = new THREE.Group();
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.7, 8), mat(0xd8dee6, { metalness: 0.8 }));
    handle.rotation.z = Math.PI / 2;
    db.add(handle);
    for (const sx of [-0.32, 0.32]) {
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.2 + i * 0.03, 10, 10), mat(0x22262c, { roughness: 0.5 }));
      head.position.x = sx;
      db.add(head);
    }
    db.position.set(W / 2 - 1.6, 0.9, -4 + i * 1.6);
    g.add(db);
  }
  g.add(box(1.0, 0.8, 7.5, 0x3a3f46, W / 2 - 1.6, 0.4, 0.8)); // dumbbell rack

  g.add(makeTextPlane("IRON ORBIT", 10, 1.6, "#ff8c42", 0, 6.2, -D / 2 + 0.4));
  g.add(makeTextPlane("◀ EXIT", 4, 1, "#ff5544", 0, 3.4, D / 2 - 0.3));

  return {
    group: g,
    rackPosition,
    dispose() {
      g.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
      });
    },
  };
}
