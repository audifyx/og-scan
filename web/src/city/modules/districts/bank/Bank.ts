/**
 * 17. ORBITX NATIONAL BANK — enterable bank.
 *
 * - Exterior: neoclassical facade with columns + "ORBITX NATIONAL BANK" sign,
 *   ATM kiosk out front.
 * - Interior: marble lobby, teller counters, vault door (interact point),
 *   queue rails, chandeliers.
 */
import * as THREE from "three";
import type { DoorTrigger, Vec3T } from "../types";
import { mountAsset } from "@/city/modules/assets/loadAsset";

export const BANK_INTERIOR_ID = "bank";
/** Outdoor facade footprint center — reserved city lot. */
export const BANK_FACADE_CENTER: Vec3T = [120, 0, -60];
export const BANK_DOOR: DoorTrigger = {
  id: "door:bank",
  label: "OrbitX National Bank",
  position: [120, 0, -45],
  radius: 4,
  prompt: "Enter OrbitX National Bank",
  interiorId: BANK_INTERIOR_ID,
  interiorSpawn: [0, 0, 10],
  exitPosition: [120, 0, -46],
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

/** Bank facade. Integrator adds to the outdoor world group. */
export function buildBankExterior(): THREE.Group {
  const g = new THREE.Group();
  const W = 44, H = 12, D = 30;

  // Procedural body — plain stone mass, swapped for real GLB towers when loaded.
  const body = new THREE.Group();
  body.userData.proceduralBody = true;
  body.add(box(W, H, D, 0xd8d4c8, 0, H / 2, 0));
  g.add(body);
  // Real GLB tower mass rising behind the columned portico (Kenney CC0).
  mountAsset(g, "buildings/commercial/tower-a", { position: [-15, 0, -10], scale: 15 });
  mountAsset(g, "buildings/commercial/tower-b", { position: [15, 0, -10], scale: 15 });
  // pediment (signature — kept)
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.1, W * 0.62, 3, 4), mat(0xc8c4b8));
  ped.rotation.y = Math.PI / 4;
  ped.position.set(0, H + 1.5, 0);
  ped.castShadow = true;
  g.add(ped);
  // columns
  for (let i = 0; i < 6; i++) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.0, H * 0.8, 12), mat(0xe8e4d8));
    col.position.set(-W / 2 + 4 + i * ((W - 8) / 5), H * 0.4, D / 2 + 1.2);
    col.castShadow = true;
    col.receiveShadow = true;
    g.add(col);
  }
  // glass doors
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(8, 5.5),
    new THREE.MeshStandardMaterial({ color: 0xb8d8ff, transparent: true, opacity: 0.5, roughness: 0.2, emissive: 0x88aacc, emissiveIntensity: 0.35 }),
  );
  glass.position.set(0, 2.9, D / 2 + 0.1);
  g.add(glass);
  // sign
  g.add(box(W * 0.8, 1.8, 0.6, 0x0c1a2a, 0, H - 1.2, D / 2 + 0.4));
  g.add(makeTextPlane("ORBITX NATIONAL BANK", W * 0.74, 1.5, "#ffd75e", 0, H - 1.2, D / 2 + 0.75));
  // ATM kiosk
  g.add(box(3, 4.4, 2.4, 0x1a2a3a, W / 2 - 5, 2.2, D / 2 + 2.5));
  const atmScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(1.8, 1.2),
    new THREE.MeshBasicMaterial({ color: 0x22e5ff }),
  );
  atmScreen.position.set(W / 2 - 5, 3.0, D / 2 + 3.75);
  g.add(atmScreen);
  g.add(makeTextPlane("ATM", 2.4, 0.8, "#22e5ff", W / 2 - 5, 4.2, D / 2 + 3.75));
  // door glow marker
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(4, 5.6),
    new THREE.MeshBasicMaterial({ color: 0xffd75e, transparent: true, opacity: 0.3, side: THREE.DoubleSide }),
  );
  glow.position.set(0, 2.8, D / 2 + 0.2);
  g.add(glow);

  g.position.set(...BANK_FACADE_CENTER);
  return g;
}

/* --------------------------------- interior --------------------------------- */

export interface BankInterior {
  group: THREE.Group;
  /** Vault door position (integrator proximity-opens <BankUI>). */
  vaultPosition: Vec3T;
  dispose(): void;
}

function tellerCounter(x: number, z: number): THREE.Group {
  const t = new THREE.Group();
  t.add(box(4.4, 1.2, 1.2, 0x6a4a2a, 0, 0.6, 0)); // wood counter
  t.add(box(4.4, 0.15, 1.4, 0xd8d4c8, 0, 1.28, 0)); // marble top
  // teller window glass
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(4.0, 1.6),
    new THREE.MeshStandardMaterial({ color: 0xb8d8ff, transparent: true, opacity: 0.35, roughness: 0.15 }),
  );
  glass.position.set(0, 2.2, 0);
  t.add(glass);
  t.position.set(x, 0, z);
  return t;
}

export function buildBankInterior(): BankInterior {
  const g = new THREE.Group();
  const W = 44, D = 30, H = 9;

  // marble floor with checker inlay
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), mat(0xe0dcd0, { roughness: 0.35 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  g.add(floor);
  for (let ix = 0; ix < 11; ix++) {
    for (let iz = 0; iz < 7; iz++) {
      if ((ix + iz) % 2 !== 0) continue;
      const tile = new THREE.Mesh(
        new THREE.PlaneGeometry(3.6, 3.6),
        new THREE.MeshStandardMaterial({ color: 0x2a3a4a, roughness: 0.4 }),
      );
      tile.rotation.x = -Math.PI / 2;
      tile.position.set(-W / 2 + 2 + ix * 4, 0.015, -D / 2 + 2 + iz * 4);
      g.add(tile);
    }
  }
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), mat(0xf0ece0));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = H;
  g.add(ceil);
  const wallMat = mat(0xd8d4c8);
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

  // bright daytime lobby light (sun pinned at noon — no night lighting)
  const key = new THREE.PointLight(0xfff2dd, 800, 80);
  key.position.set(0, H - 1, 0);
  g.add(key);

  // chandeliers
  for (const x of [-10, 10]) {
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2, 8), mat(0x8a7a4a, { metalness: 0.7 }));
    stem.position.set(x, H - 1, 0);
    g.add(stem);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.18, 10, 20), mat(0xd8b84a, { metalness: 0.8, roughness: 0.3 }));
    ring.rotation.x = Math.PI / 2;
    ring.position.set(x, H - 2.2, 0);
    g.add(ring);
  }

  // teller counters along the back
  g.add(tellerCounter(-12, -9));
  g.add(tellerCounter(0, -9));
  g.add(tellerCounter(12, -9));
  // queue rails
  for (const x of [-14, -6, 6, 14]) {
    g.add(box(0.15, 1.0, 0.15, 0x8a7a4a, x, 0.5, -4));
    g.add(box(0.15, 1.0, 0.15, 0x8a7a4a, x, 0.5, -2));
  }
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 8, 8), mat(0xd8b84a, { metalness: 0.8 }));
  rail.rotation.z = Math.PI / 2;
  rail.position.set(-10, 1.0, -3);
  g.add(rail);
  const rail2 = rail.clone();
  rail2.position.x = 10;
  g.add(rail2);

  // vault door (interact point) on the right wall
  const vaultPosition: Vec3T = [W / 2 - 1, 0, -6];
  const vaultDoor = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 0.5, 24), mat(0x4a5560, { metalness: 0.85, roughness: 0.35 }));
  vaultDoor.rotation.z = Math.PI / 2;
  vaultDoor.position.set(W / 2 - 0.4, 3.2, -6);
  vaultDoor.castShadow = true;
  g.add(vaultDoor);
  const vaultHub = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.12, 8, 16), mat(0xd8b84a, { metalness: 0.8 }));
  vaultHub.position.set(W / 2 - 0.7, 3.2, -6);
  vaultHub.rotation.y = Math.PI / 2;
  g.add(vaultHub);
  g.add(makeTextPlane("VAULT", 6, 1.2, "#ffd75e", W / 2 - 0.9, 6.4, -6));

  g.add(makeTextPlane("ORBITX NATIONAL BANK", 14, 1.8, "#8a7a2a", 0, 7.0, -D / 2 + 0.4));
  g.add(makeTextPlane("◀ EXIT", 4, 1, "#ff5544", 0, 3.4, D / 2 - 0.3));

  return {
    group: g,
    vaultPosition,
    dispose() {
      g.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
      });
    },
  };
}
