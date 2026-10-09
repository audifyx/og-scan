/**
 * PLAZA CENTERPIECE — the signature landmark at the heart of OrbitX City [0, 0].
 *
 * A grand circular plaza: paved disc, tiered fountain with an OrbitX monument
 * obelisk (branded on all four sides), ringed by planters, trees, and lamps.
 * Daytime only — no night lighting per project rule.
 *
 * Integrator adds `buildPlazaCenterpiece()` to the outdoor world group
 * (wired in `buildAllExteriors`).
 */
import * as THREE from "three";
import { mountAsset } from "@/city/modules/assets/loadAsset";

function mat(color: number, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.15, ...opts });
}

function makeTextPlane(text: string, w: number, h: number, color: string, x: number, y: number, z: number, ry = 0) {
  const c = document.createElement("canvas");
  c.width = 1024; c.height = 256;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#0a0e14";
  ctx.fillRect(0, 0, 1024, 256);
  ctx.fillStyle = color;
  ctx.font = "bold 96px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 512, 132);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex }));
  m.position.set(x, y, z);
  m.rotation.y = ry;
  return m;
}

export function buildPlazaCenterpiece(): THREE.Group {
  const g = new THREE.Group();

  // paved plaza disc
  const disc = new THREE.Mesh(new THREE.CircleGeometry(34, 48), mat(0xcfc8b8, { roughness: 0.9 }));
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 0.02;
  disc.receiveShadow = true;
  g.add(disc);
  // inner inlay ring
  const ring = new THREE.Mesh(new THREE.RingGeometry(24, 26, 48), mat(0x8a7a5a, { roughness: 0.9 }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.04;
  ring.receiveShadow = true;
  g.add(ring);

  // tiered fountain basin
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(9, 10, 2, 24), mat(0x9aa2b2));
  basin.position.y = 1;
  basin.castShadow = true;
  basin.receiveShadow = true;
  g.add(basin);
  const water = new THREE.Mesh(
    new THREE.CylinderGeometry(8.4, 8.4, 0.5, 24),
    new THREE.MeshStandardMaterial({ color: 0x4aa8e8, transparent: true, opacity: 0.75, roughness: 0.1 }),
  );
  water.position.y = 2.1;
  g.add(water);
  // upper tier
  const tier2 = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 5, 1.4, 20), mat(0x9aa2b2));
  tier2.position.y = 3;
  tier2.castShadow = true;
  g.add(tier2);
  const water2 = new THREE.Mesh(
    new THREE.CylinderGeometry(4.1, 4.1, 0.4, 20),
    new THREE.MeshStandardMaterial({ color: 0x4aa8e8, transparent: true, opacity: 0.75, roughness: 0.1 }),
  );
  water2.position.y = 3.85;
  g.add(water2);

  // OrbitX monument obelisk rising from the fountain
  const obelisk = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 2.2, 22, 4), mat(0x1a2230, { metalness: 0.6, roughness: 0.35 }));
  obelisk.rotation.y = Math.PI / 4;
  obelisk.position.y = 13;
  obelisk.castShadow = true;
  g.add(obelisk);
  const cap = new THREE.Mesh(new THREE.OctahedronGeometry(1.6), new THREE.MeshStandardMaterial({ color: 0xffd75e, metalness: 0.9, roughness: 0.2, emissive: 0xaa7711, emissiveIntensity: 0.4 }));
  cap.position.y = 25;
  cap.castShadow = true;
  g.add(cap);
  // branded faces on the obelisk base
  for (let i = 0; i < 4; i++) {
    const ry = (i * Math.PI) / 2;
    const r = 2.6;
    g.add(makeTextPlane("ORBITX CITY", 7, 1.75, "#ffd75e", Math.sin(ry) * r, 6.5, Math.cos(ry) * r, ry));
  }

  // ring of planters + trees around the plaza
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const px = Math.cos(a) * 29;
    const pz = Math.sin(a) * 29;
    const holder = new THREE.Group();
    holder.position.set(px, 0, pz);
    mountAsset(holder, i % 2 === 0 ? "props/nature/tree-large" : "props/nature/planter", { scale: 8 });
    g.add(holder);
  }
  // lamps at the four plaza corners
  for (const [lx, lz] of [[-24, -24], [24, -24], [-24, 24], [24, 24]] as const) {
    const holder = new THREE.Group();
    holder.position.set(lx, 0, lz);
    mountAsset(holder, "props/street/lamp-curved", { rotationY: Math.atan2(-lx, -lz), scale: 10 });
    g.add(holder);
  }

  return g;
}
