/**
 * 21. WALLORBIT MEGA MALL — enterable mall (parody anchor brand).
 *
 * - Exterior: sprawling low-rise facade with "WALLORBIT MEGA MALL" sign,
 *   skylight strips, fountain plaza out front.
 * - Interior: two-level atrium, storefront row (interact point: anchor store),
 *   escalators, food-court tables, skylight glow.
 */
import * as THREE from "three";
import type { DoorTrigger, Vec3T } from "../types";
import { mountAsset } from "@/city/modules/assets/loadAsset";

export const MALL_INTERIOR_ID = "mall";
/** Outdoor facade footprint center — reserved city lot. */
export const MALL_FACADE_CENTER: Vec3T = [150, 0, -20];
export const MALL_DOOR: DoorTrigger = {
  id: "door:mall",
  label: "WallOrbit Mega Mall",
  position: [150, 0, -5],
  radius: 5,
  prompt: "Enter WallOrbit Mega Mall",
  interiorId: MALL_INTERIOR_ID,
  interiorSpawn: [0, 0, 12],
  exitPosition: [150, 0, -6],
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

/** Mall facade. Integrator adds to the outdoor world group. */
export function buildMallExterior(): THREE.Group {
  const g = new THREE.Group();
  const W = 56, H = 11, D = 34;

  // Procedural body — sprawling mass, swapped for a real GLB shopping row when loaded.
  const body = new THREE.Group();
  body.userData.proceduralBody = true;
  body.add(box(W, H, D, 0xd8cfc0, 0, H / 2, 0));
  g.add(body);
  // Real GLB shopping row + anchor tower (Kenney CC0) — reads from a block away.
  mountAsset(g, "buildings/commercial/shop-b", { position: [-21, 0, 0], scale: 12 });
  mountAsset(g, "buildings/commercial/shop-c", { position: [-7, 0, 0], scale: 12 });
  mountAsset(g, "buildings/commercial/shop-d", { position: [7, 0, 0], scale: 12 });
  mountAsset(g, "buildings/commercial/shop-n", { position: [21, 0, 0], scale: 12 });
  mountAsset(g, "buildings/commercial/tower-a", { position: [34, 0, -10], scale: 13 });
  // skylight strips on the roof (signature — kept)
  for (let i = 0; i < 4; i++) {
    const sky = new THREE.Mesh(
      new THREE.PlaneGeometry(W * 0.16, D * 0.7),
      new THREE.MeshStandardMaterial({ color: 0xbfe0ff, roughness: 0.15, metalness: 0.2, emissive: 0x88aacc, emissiveIntensity: 0.3 }),
    );
    sky.rotation.x = -Math.PI / 2;
    sky.position.set(-W / 2 + 7 + i * ((W - 14) / 3), H + 0.06, 0);
    g.add(sky);
  }
  // main entrance recess with glass
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 7),
    new THREE.MeshStandardMaterial({ color: 0xb8d8ff, transparent: true, opacity: 0.5, roughness: 0.2, emissive: 0x88aacc, emissiveIntensity: 0.35 }),
  );
  glass.position.set(0, 3.6, D / 2 + 0.1);
  g.add(glass);
  // orange brand band
  g.add(box(W, 1.6, 0.5, 0xe87a1e, 0, H - 0.8, D / 2 + 0.2));
  // sign
  g.add(box(W * 0.6, 2.0, 0.7, 0x101418, 0, H + 1.6, D / 2 + 0.3));
  g.add(makeTextPlane("WALLORBIT MEGA MALL", W * 0.54, 1.7, "#ff9a3a", 0, H + 1.6, D / 2 + 0.7));
  // fountain plaza out front
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 5, 1.2, 16), mat(0x8a94a8));
  basin.position.set(0, 0.6, D / 2 + 10);
  basin.castShadow = true;
  g.add(basin);
  const water = new THREE.Mesh(
    new THREE.CylinderGeometry(4.1, 4.1, 0.3, 16),
    new THREE.MeshStandardMaterial({ color: 0x4aa8e8, transparent: true, opacity: 0.75, roughness: 0.1 }),
  );
  water.position.set(0, 1.25, D / 2 + 10);
  g.add(water);
  const jet = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 3.2, 10), mat(0xd8dee6));
  jet.position.set(0, 2.8, D / 2 + 10);
  g.add(jet);
  // door glow marker
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(6, 7.2),
    new THREE.MeshBasicMaterial({ color: 0xff9a3a, transparent: true, opacity: 0.3, side: THREE.DoubleSide }),
  );
  glow.position.set(0, 3.6, D / 2 + 0.2);
  g.add(glow);

  g.position.set(...MALL_FACADE_CENTER);
  return g;
}

/* --------------------------------- interior --------------------------------- */

export interface MallInterior {
  group: THREE.Group;
  /** Anchor store position (integrator proximity-opens <MallUI>). */
  anchorPosition: Vec3T;
  dispose(): void;
}

function storefront(x: number, z: number, name: string, color: number): THREE.Group {
  const s = new THREE.Group();
  s.add(box(7, 4.6, 0.6, 0xe8e4d8, 0, 2.3, 0)); // frame
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(6.2, 3.4),
    new THREE.MeshStandardMaterial({ color: 0xb8d8ff, transparent: true, opacity: 0.45, roughness: 0.2, emissive: 0x88aacc, emissiveIntensity: 0.3 }),
  );
  glass.position.set(0, 2.2, 0.35);
  s.add(glass);
  s.add(makeTextPlane(name, 6.4, 1.0, "#e87a1e", 0, 4.9, 0.4));
  // display pedestals behind glass
  for (let i = 0; i < 3; i++) {
    s.add(box(1.1, 1.0 + (i % 2) * 0.5, 1.1, color, -2 + i * 2, 0.5 + ((i % 2) * 0.25), -0.8));
  }
  s.position.set(x, 0, z);
  return s;
}

export function buildMallInterior(): MallInterior {
  const g = new THREE.Group();
  const W = 56, D = 34, H = 10;

  // polished tile floor
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), mat(0xe8e2d4, { roughness: 0.3 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  g.add(floor);
  // orange wayfinding strip
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(2.2, D - 4), mat(0xe87a1e, { roughness: 0.6 }));
  strip.rotation.x = -Math.PI / 2;
  strip.position.set(0, 0.02, 0);
  g.add(strip);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), mat(0xf4f0e6));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = H;
  g.add(ceil);
  // skylight glow strips (daytime)
  for (let i = 0; i < 3; i++) {
    const sky = new THREE.Mesh(
      new THREE.PlaneGeometry(6, D * 0.8),
      new THREE.MeshBasicMaterial({ color: 0xd8ecff }),
    );
    sky.rotation.x = Math.PI / 2;
    sky.position.set(-16 + i * 16, H - 0.1, 0);
    g.add(sky);
  }
  const wallMat = mat(0xe8e2d4);
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

  // bright atrium light
  const key = new THREE.PointLight(0xfff4e0, 900, 90);
  key.position.set(0, H - 1, 0);
  g.add(key);

  // storefront rows (left + right walls)
  const stores: Array<[number, number, string, number]> = [
    [-W / 2 + 0.6, -8, "SNEAKER ORBIT", 0xd83a5a],
    [-W / 2 + 0.6, 0, "TECH NOVA", 0x2a6bd8],
    [-W / 2 + 0.6, 8, "WALLORBIT", 0xe87a1e],
    [W / 2 - 0.6, -8, "COIN COUTURE", 0x8a3ad8],
    [W / 2 - 0.6, 0, "GADGET GALAXY", 0x2a8a6a],
    [W / 2 - 0.6, 8, "PET PLANET", 0xd8a02e],
  ];
  for (const [x, z, name, color] of stores) {
    const s = storefront(0, 0, name, color);
    s.position.set(x, 0, z);
    s.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2;
    g.add(s);
  }

  // anchor store at the far end (interact point)
  const anchorPosition: Vec3T = [0, 0, -D / 2 + 4];
  g.add(box(16, 6, 1.2, 0xe87a1e, 0, 3, -D / 2 + 0.8));
  g.add(makeTextPlane("WALLORBIT ANCHOR", 14, 1.8, "#ffffff", 0, 5.2, -D / 2 + 1.6));

  // escalators (static)
  for (const sx of [-6, 6]) {
    const esc = box(2.2, 0.5, 10, 0x8a94a8, sx, 1.6, 8);
    esc.rotation.x = -0.35;
    g.add(esc);
    g.add(box(0.15, 1.2, 10, 0xd8dee6, sx - 1.1, 2.6, 8));
    g.add(box(0.15, 1.2, 10, 0xd8dee6, sx + 1.1, 2.6, 8));
  }

  // food-court tables
  for (const [x, z] of [[-10, 10], [0, 11], [10, 10]] as const) {
    const top = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.12, 14), mat(0xf4f0e6));
    top.position.set(x, 1.0, z);
    top.castShadow = true;
    g.add(top);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.0, 8), mat(0x8a94a8));
    leg.position.set(x, 0.5, z);
    g.add(leg);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      g.add(box(0.5, 0.9, 0.5, 0xe87a1e, x + Math.cos(a) * 1.9, 0.45, z + Math.sin(a) * 1.9));
    }
  }

  g.add(makeTextPlane("WALLORBIT MEGA MALL", 16, 1.8, "#e87a1e", 0, 8.2, -D / 2 + 0.4));
  g.add(makeTextPlane("◀ EXIT", 4, 1, "#ff5544", 0, 3.4, D / 2 - 0.3));

  return {
    group: g,
    anchorPosition,
    dispose() {
      g.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
      });
    },
  };
}
