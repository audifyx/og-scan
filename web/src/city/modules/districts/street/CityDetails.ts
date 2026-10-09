/**
 * CITY DETAILS — the small things that sell it: rooftop-style water towers,
 * utility boxes, and ORBITX banner poles along the plaza and main avenues.
 *
 * Fully procedural (cheap geometry), placed clear of GLB footprints and door
 * triggers. Daytime only.
 *
 * Integrator adds `buildCityDetails()` to the outdoor world group
 * (wired in `buildAllExteriors`).
 */
import * as THREE from "three";

function mat(color: number, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.2, ...opts });
}

function makeTextPlane(text: string, w: number, h: number, color: string) {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 256;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#101623";
  ctx.fillRect(0, 0, 512, 256);
  ctx.fillStyle = color;
  ctx.font = "bold 64px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 256, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
}

/** Classic wooden water tower on legs. */
function waterTower(x: number, z: number, s = 1): THREE.Group {
  const t = new THREE.Group();
  const legMat = mat(0x6a4a2a);
  for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 6, 8), legMat);
    leg.position.set(lx * 1.6, 3, lz * 1.6);
    leg.castShadow = true;
    t.add(leg);
  }
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.6, 3.6, 14), mat(0x8a6a4a, { roughness: 0.85 }));
  tank.position.y = 7.8;
  tank.castShadow = true;
  t.add(tank);
  // tank bands
  for (const by of [6.6, 7.8, 9.0]) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(2.55, 0.09, 8, 20), mat(0x3a3f46, { metalness: 0.6 }));
    band.rotation.x = Math.PI / 2;
    band.position.y = by;
    t.add(band);
  }
  const roof = new THREE.Mesh(new THREE.ConeGeometry(2.9, 1.8, 14), mat(0x5a3a2a, { roughness: 0.85 }));
  roof.position.y = 10.5;
  roof.castShadow = true;
  t.add(roof);
  t.position.set(x, 0, z);
  t.scale.setScalar(s);
  return t;
}

/** Ground utility / AC box cluster. */
function utilityBoxes(x: number, z: number, ry = 0): THREE.Group {
  const u = new THREE.Group();
  const boxes: Array<[number, number, number, number, number, number]> = [
    [2.2, 1.6, 1.4, 0, 0.8, 0],
    [1.6, 1.2, 1.2, 2.2, 0.6, 0.4],
    [1.2, 2.0, 1.0, -1.8, 1.0, -0.6],
  ];
  for (const [w, h, d, bx, by, bz] of boxes) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(0x9aa2ae, { metalness: 0.4, roughness: 0.5 }));
    b.position.set(bx, by, bz);
    b.castShadow = true;
    b.receiveShadow = true;
    u.add(b);
    // fan grill on top
    const grill = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.08, 12), mat(0x2a2e36));
    grill.position.set(bx, by + h / 2 + 0.04, bz);
    u.add(grill);
  }
  u.position.set(x, 0, z);
  u.rotation.y = ry;
  return u;
}

/** Tall banner pole with an ORBITX flag. */
function bannerPole(x: number, z: number, label: string): THREE.Group {
  const p = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 11, 8), mat(0xd8dee6, { metalness: 0.7, roughness: 0.3 }));
  pole.position.y = 5.5;
  pole.castShadow = true;
  p.add(pole);
  const finial = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), mat(0xffd75e, { metalness: 0.8, roughness: 0.3 }));
  finial.position.y = 11.2;
  p.add(finial);
  const flag = makeTextPlane(label, 4.4, 2.2, "#ffd75e");
  flag.position.set(2.35, 9.4, 0);
  p.add(flag);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 4.6, 6), mat(0xd8dee6, { metalness: 0.7 }));
  arm.rotation.z = Math.PI / 2;
  arm.position.set(2.3, 10.55, 0);
  p.add(arm);
  p.position.set(x, 0, z);
  return p;
}

/** Build the details group. */
export function buildCityDetails(): THREE.Group {
  const g = new THREE.Group();

  // water towers — skyline character
  g.add(waterTower(186, -44, 1.1)); // behind the mall
  g.add(waterTower(-146, 84, 1.0)); // by the hotel
  g.add(waterTower(102, -132, 0.9)); // pharmacy block

  // utility boxes tucked behind buildings
  g.add(utilityBoxes(96, -84, 0.4)); // bank rear
  g.add(utilityBoxes(-16, -172, -0.3)); // police rear
  g.add(utilityBoxes(18, 172, 0.2)); // cinema rear

  // ORBITX banner poles ringing the plaza
  const labels = ["ORBITX", "CITY", "ORBITX", "TRADE", "ORBITX", "LAUNCH", "ORBITX", "EARN"];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    g.add(bannerPole(Math.cos(a) * 40, Math.sin(a) * 40, labels[i]));
  }
  // banner avenues: bank row + cinema row
  for (let i = 0; i < 4; i++) {
    g.add(bannerPole(88 + i * 22, -56, i % 2 ? "ORBITX" : "BANK"));
    g.add(bannerPole(16 + i * 16, 126, i % 2 ? "CINEMA" : "ORBITX"));
  }

  return g;
}
