/**
 * 19. MOON REEL CINEMA — enterable cinema.
 *
 * - Exterior: art-deco facade with marquee canopy + "MOON REEL CINEMA" sign,
 *   poster cases out front.
 * - Interior: lobby with concession stand (interact point), ticket booth,
 *   theater doors, red carpet, star ceiling.
 */
import * as THREE from "three";
import type { DoorTrigger, Vec3T } from "../types";
import { mountAsset } from "@/city/modules/assets/loadAsset";

export const CINEMA_INTERIOR_ID = "cinema";
/** Outdoor facade footprint center — reserved city lot. */
export const CINEMA_FACADE_CENTER: Vec3T = [40, 0, 150];
export const CINEMA_DOOR: DoorTrigger = {
  id: "door:cinema",
  label: "Moon Reel Cinema",
  position: [40, 0, 165],
  radius: 4,
  prompt: "Enter Moon Reel Cinema",
  interiorId: CINEMA_INTERIOR_ID,
  interiorSpawn: [0, 0, 10],
  exitPosition: [40, 0, 164],
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

/** Cinema facade. Integrator adds to the outdoor world group. */
export function buildCinemaExterior(): THREE.Group {
  const g = new THREE.Group();
  const W = 40, H = 14, D = 28;

  // Procedural body — art-deco stepped mass, swapped for real GLB shops when loaded.
  const body = new THREE.Group();
  body.userData.proceduralBody = true;
  body.add(box(W, H, D, 0x2a2e3a, 0, H / 2, 0));
  body.add(box(W * 0.7, 3, D * 0.7, 0x3a3f4e, 0, H + 1.5, 0));
  g.add(body);
  // Real GLB theater hall behind the marquee front (Kenney CC0).
  mountAsset(g, "buildings/commercial/shop-f", { position: [-9, 0, -4], scale: 12 });
  mountAsset(g, "buildings/commercial/shop-g", { position: [9, 0, -4], scale: 12 });
  // vertical fin (signature — kept, pops above the roofline)
  g.add(box(2.4, H + 6, 2.4, 0xd8b84a, 0, (H + 6) / 2, D / 2 + 0.6));
  // marquee canopy
  g.add(box(W * 0.85, 0.5, 7, 0x8a1f2e, 0, 6.2, D / 2 + 3.5));
  const marqueeFace = makeTextPlane("NOW SHOWING: TO THE MOON", W * 0.7, 1.4, "#ffd75e", 0, 5.2, D / 2 + 7.05);
  g.add(marqueeFace);
  // poster cases
  for (const sx of [-1, 1]) {
    g.add(box(4.4, 6.4, 0.5, 0x14161a, sx * 12, 3.2, D / 2 + 0.35));
    const poster = new THREE.Mesh(
      new THREE.PlaneGeometry(3.8, 5.8),
      new THREE.MeshStandardMaterial({ color: sx < 0 ? 0x1a3a6a : 0x6a1a3a, emissive: sx < 0 ? 0x0a2a5a : 0x5a0a2a, emissiveIntensity: 0.5 }),
    );
    poster.position.set(sx * 12, 3.2, D / 2 + 0.65);
    g.add(poster);
  }
  // sign
  g.add(box(W * 0.72, 1.8, 0.6, 0x0c0e12, 0, H - 1.4, D / 2 + 0.4));
  g.add(makeTextPlane("MOON REEL CINEMA", W * 0.64, 1.5, "#ffd75e", 0, H - 1.4, D / 2 + 0.75));
  // door glow marker
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(5, 5.6),
    new THREE.MeshBasicMaterial({ color: 0xffd75e, transparent: true, opacity: 0.3, side: THREE.DoubleSide }),
  );
  glow.position.set(0, 2.8, D / 2 + 0.2);
  g.add(glow);

  g.position.set(...CINEMA_FACADE_CENTER);
  return g;
}

/* --------------------------------- interior --------------------------------- */

export interface CinemaInterior {
  group: THREE.Group;
  /** Concession stand position (integrator proximity-opens <CinemaUI>). */
  concessionPosition: Vec3T;
  dispose(): void;
}

function theaterDoor(x: number, z: number, label: string): THREE.Group {
  const d = new THREE.Group();
  d.add(box(3.6, 5.2, 0.4, 0x5a1f2e, 0, 2.6, 0));
  d.add(box(1.1, 2.2, 0.15, 0xd8b84a, -0.8, 2.6, 0.25));
  d.add(box(1.1, 2.2, 0.15, 0xd8b84a, 0.8, 2.6, 0.25));
  d.add(makeTextPlane(label, 3.2, 0.8, "#ffd75e", 0, 5.9, 0.25));
  d.position.set(x, 0, z);
  return d;
}

export function buildCinemaInterior(): CinemaInterior {
  const g = new THREE.Group();
  const W = 40, D = 28, H = 9;

  // red carpet floor
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), mat(0x6a1a2a, { roughness: 0.85 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  g.add(floor);
  // gold aisle runner
  const runner = new THREE.Mesh(new THREE.PlaneGeometry(3.4, D - 4), mat(0xd8b84a, { roughness: 0.7 }));
  runner.rotation.x = -Math.PI / 2;
  runner.position.set(0, 0.02, 0);
  g.add(runner);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), mat(0x14161f));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = H;
  g.add(ceil);
  // star ceiling dots (daytime-safe: subtle emissive, not night lighting)
  for (let i = 0; i < 40; i++) {
    const star = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0xfff2cc }),
    );
    star.position.set((Math.random() - 0.5) * (W - 4), H - 0.15, (Math.random() - 0.5) * (D - 4));
    g.add(star);
  }
  const wallMat = mat(0x3a1f2e);
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

  // warm lobby light
  const key = new THREE.PointLight(0xffe8cc, 700, 70);
  key.position.set(0, H - 1, 0);
  g.add(key);

  // ticket booth
  g.add(box(4, 3.4, 3, 0x2a2e3a, -13, 1.7, 6));
  const boothGlass = new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, 1.6),
    new THREE.MeshStandardMaterial({ color: 0xb8d8ff, transparent: true, opacity: 0.4, roughness: 0.15 }),
  );
  boothGlass.position.set(-13, 2.4, 7.55);
  g.add(boothGlass);
  g.add(makeTextPlane("TICKETS", 3.6, 0.9, "#ffd75e", -13, 4.2, 7.6));

  // concession stand (interact point)
  const concessionPosition: Vec3T = [10, 0, 6];
  g.add(box(7, 1.4, 2.4, 0x8a1f2e, 10, 0.7, 6));
  g.add(box(7.4, 0.18, 2.8, 0xd8b84a, 10, 1.5, 6));
  // popcorn machine
  g.add(box(1.6, 2.4, 1.6, 0xd84a3a, 7.4, 2.7, 6));
  const popGlass = new THREE.Mesh(
    new THREE.PlaneGeometry(1.2, 1.4),
    new THREE.MeshStandardMaterial({ color: 0xffe8a0, transparent: true, opacity: 0.55, emissive: 0xcc8a3a, emissiveIntensity: 0.5 }),
  );
  popGlass.position.set(7.4, 2.9, 6.85);
  g.add(popGlass);
  // soda cups row
  for (let i = 0; i < 4; i++) {
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.4, 8), mat([0xd84a3a, 0x2a6bc2, 0xd8a02e, 0x2a8a4a][i]));
    cup.position.set(10.5 + i * 0.55, 1.8, 6);
    g.add(cup);
  }
  g.add(makeTextPlane("CONCESSIONS", 6, 1.1, "#ffd75e", 10, 4.6, 4.7));

  // theater doors
  g.add(theaterDoor(-8, -D / 2 + 0.4, "THEATER 1"));
  g.add(theaterDoor(8, -D / 2 + 0.4, "THEATER 2"));

  g.add(makeTextPlane("MOON REEL CINEMA", 12, 1.6, "#ffd75e", 0, 7.2, -D / 2 + 0.4));
  g.add(makeTextPlane("◀ EXIT", 4, 1, "#ff5544", 0, 3.4, D / 2 - 0.3));

  return {
    group: g,
    concessionPosition,
    dispose() {
      g.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
      });
    },
  };
}
