/**
 * 6. OBSERVATORY — stargaze; stars map to constellation NFTs.
 *
 * A hilltop dome with a slit opening. Inside: a telescope + a star dome
 * ceiling. `STAR_FIELD` is a deterministic star field; `CONSTELLATIONS`
 * links star indices into named constellations, each mapped to an NFT
 * concept (`nft.collection` / `nft.trait`) for the future mint integration.
 *
 * "Discovering" a constellation = tracing all its stars with the telescope
 * view (integrator reports looked-at star indices via `trackGaze`). Discovery
 * persists to localStorage; the NFT mint call itself is a documented
 * integration point (see MODULE.md) and is NOT implemented here.
 */
import * as THREE from "three";
import type { Constellation, DoorTrigger, Vec3T } from "../types";

export const OBSERVATORY_INTERIOR_ID = "observatory";
/** Outdoor facade footprint center — the reserved city lot (see FACADE_PLOTS). */
export const OBSERVATORY_FACADE_CENTER: Vec3T = [-95, 0, -78];
export const OBSERVATORY_DOOR: DoorTrigger = {
  id: "door:observatory",
  label: "OrbitX Observatory",
  position: [-95, 0, -63],
  radius: 5,
  prompt: "Enter Observatory",
  interiorId: OBSERVATORY_INTERIOR_ID,
  interiorSpawn: [0, 0, 8],
  exitPosition: [-95, 0, -64],
};

/* ------------------------------ star field data ----------------------------- */

/** Deterministic pseudo-random star field on a dome (unit hemisphere). */
export function generateStarField(count: number, seed = 4242): Vec3T[] {
  const stars: Vec3T[] = [];
  let s = seed;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  for (let i = 0; i < count; i++) {
    const theta = rnd() * Math.PI * 2;
    const y = 0.12 + rnd() * 0.88;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    stars.push([Math.cos(theta) * r, y, Math.sin(theta) * r]);
  }
  return stars;
}

export const STAR_FIELD = generateStarField(900);

export const CONSTELLATIONS: Constellation[] = [
  {
    id: "orbi",
    name: "Orbi the Trader",
    symbol: "ORBI",
    stars: [12, 87, 203, 341, 455, 512, 688],
    rarity: "legendary",
    lore: "The first chart ever drawn. Seven candles that never wicked down.",
    nft: { collection: "orbitx-constellations", trait: "Orbi the Trader · Legendary" },
  },
  {
    id: "bull",
    name: "The Eternal Bull",
    symbol: "BULL",
    stars: [44, 129, 276, 390, 501, 733],
    rarity: "epic",
    lore: "Charges across the night sky every cycle. Never ask when it rests.",
    nft: { collection: "orbitx-constellations", trait: "Eternal Bull · Epic" },
  },
  {
    id: "whale",
    name: "The Whale",
    symbol: "WHALE",
    stars: [23, 158, 302, 419, 610, 777, 845],
    rarity: "rare",
    lore: "Moves markets with a flick of its tail. Watch the order book.",
    nft: { collection: "orbitx-constellations", trait: "Whale · Rare" },
  },
  {
    id: "degen",
    name: "Degen's Lantern",
    symbol: "DGEN",
    stars: [66, 198, 333, 567],
    rarity: "common",
    lore: "A small light for late-night charts. Burns brightest at 3am.",
    nft: { collection: "orbitx-constellations", trait: "Degen's Lantern · Common" },
  },
  {
    id: "sniper",
    name: "The Sniper",
    symbol: "SNPR",
    stars: [91, 245, 402, 589, 701, 812],
    rarity: "epic",
    lore: "One shot, one entry. Never chases, never misses twice.",
    nft: { collection: "orbitx-constellations", trait: "Sniper · Epic" },
  },
];

/* ------------------------------- discovery ---------------------------------- */

const DISCOVERY_KEY = "orbitxcity:constellations:v1";

export function loadDiscovered(): string[] {
  try {
    const raw = localStorage.getItem(DISCOVERY_KEY);
    if (raw) return JSON.parse(raw) as string[];
  } catch { /* noop */ }
  return [];
}

function saveDiscovered(ids: string[]) {
  try { localStorage.setItem(DISCOVERY_KEY, JSON.stringify(ids)); } catch { /* noop */ }
}

/**
 * Track which star indices the telescope is aimed at. Returns newly
 * discovered constellations (all member stars gazed at least once).
 */
export function trackGaze(gazedStarIndices: number[]): Constellation[] {
  const discovered = new Set(loadDiscovered());
  const gazed = new Set(gazedStarIndices);
  const newly: Constellation[] = [];
  for (const c of CONSTELLATIONS) {
    if (discovered.has(c.id)) continue;
    if (c.stars.every((s) => gazed.has(s))) {
      discovered.add(c.id);
      newly.push(c);
    }
  }
  if (newly.length) saveDiscovered([...discovered]);
  return newly;
}

export function discoveryProgress(gazedStarIndices: number[]): { constellation: Constellation; found: number; total: number; discovered: boolean }[] {
  const discovered = new Set(loadDiscovered());
  const gazed = new Set(gazedStarIndices);
  return CONSTELLATIONS.map((c) => ({
    constellation: c,
    found: c.stars.filter((s) => gazed.has(s)).length,
    total: c.stars.length,
    discovered: discovered.has(c.id),
  }));
}

/* --------------------------------- interior --------------------------------- */

/* ------------------------------ shared helpers ------------------------------ */

function mat(color: number, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.3, ...opts });
}
function box(w: number, h: number, d: number, color: number, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
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

export interface ObservatoryInterior {
  group: THREE.Group;
  /** Dome radius — star field is rendered at this radius. */
  domeRadius: number;
  /** Aim the telescope: returns star indices within the view cone. */
  aimTelescope(yaw: number, pitch: number): number[];
  dispose(): void;
}

export function buildObservatoryInterior(): ObservatoryInterior {
  const g = new THREE.Group();
  const R = 16;

  // floor disc
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(R, 40),
    new THREE.MeshStandardMaterial({ color: 0x14161c, roughness: 0.6 })
  );
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
  g.add(floor);

  // dome with slit opening (thetaLength leaves a gap for the telescope)
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(R, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x232833, side: THREE.BackSide, roughness: 0.9 })
  );
  g.add(dome);

  // star field as points on the dome
  const starGeo = new THREE.BufferGeometry();
  const pos = new Float32Array(STAR_FIELD.length * 3);
  STAR_FIELD.forEach((s, i) => {
    pos[i * 3] = s[0] * (R - 0.5);
    pos[i * 3 + 1] = s[1] * (R - 0.5);
    pos[i * 3 + 2] = s[2] * (R - 0.5);
  });
  starGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const stars = new THREE.Points(
    starGeo,
    new THREE.PointsMaterial({ color: 0xffffff, size: 0.12, sizeAttenuation: true, transparent: true, opacity: 0.95 })
  );
  g.add(stars);

  // constellation lines (dim until discovered)
  const lineMat = new THREE.LineBasicMaterial({ color: 0xf5c518, transparent: true, opacity: 0.55 });
  for (const c of CONSTELLATIONS) {
    const pts = c.stars.map((si) => {
      const s = STAR_FIELD[si % STAR_FIELD.length];
      return new THREE.Vector3(s[0] * (R - 0.6), s[1] * (R - 0.6), s[2] * (R - 0.6));
    });
    const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
    g.add(new THREE.Line(lineGeo, lineMat));
  }

  // central telescope — pier, equatorial mount, long tube angled up through the dome slit
  const tele = new THREE.Group();
  const pier = new THREE.Mesh(
    new THREE.CylinderGeometry(0.9, 1.2, 2.2, 12),
    mat(0x3a4048, { metalness: 0.6 })
  );
  pier.position.y = 1.1; pier.castShadow = true;
  tele.add(pier);
  const head = box(1.6, 0.7, 1.6, 0x2b3138, 0, 2.5, 0);
  tele.add(head);
  const tilt = new THREE.Group();
  tilt.position.y = 2.9;
  tilt.rotation.x = -0.95; // ~54° elevation toward the dome slit (+z)
  tele.add(tilt);
  const tube = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.7, 6.4, 16),
    new THREE.MeshStandardMaterial({ color: 0xb8c0cc, metalness: 0.85, roughness: 0.3 })
  );
  tube.rotation.x = Math.PI / 2; // lie along z inside the tilt group
  tube.position.z = 0.6;
  tube.castShadow = true;
  tilt.add(tube);
  const dew = new THREE.Mesh(
    new THREE.CylinderGeometry(0.68, 0.62, 0.7, 16),
    mat(0x22262c, { metalness: 0.5 })
  );
  dew.rotation.x = Math.PI / 2;
  dew.position.z = 3.9;
  tilt.add(dew);
  const finder = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.14, 1.6, 8),
    mat(0x22262c)
  );
  finder.rotation.x = Math.PI / 2;
  finder.position.set(0.75, 0.4, 0.9);
  tilt.add(finder);
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.09, 1.8, 8),
    mat(0x555c66)
  );
  shaft.position.set(0, -0.9, -1.2);
  shaft.rotation.x = 0.5;
  tilt.add(shaft);
  const weight = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.35, 0.5, 12),
    mat(0x1c1f24)
  );
  weight.rotation.x = Math.PI / 2 + 0.5;
  weight.position.set(0, -1.25, -1.85);
  tilt.add(weight);
  g.add(tele);

  // control desk with star-chart monitors (faces the telescope)
  const desk = new THREE.Group();
  desk.position.set(7.5, 0, 4.5);
  desk.rotation.y = Math.atan2(-7.5, -4.5);
  const dtop = box(3.4, 0.14, 1.4, 0x3a3f47, 0, 1.0, 0);
  desk.add(dtop);
  for (const lx of [-1.4, 1.4]) {
    const leg = box(0.14, 1.0, 1.2, 0x2b3138, lx, 0.5, 0);
    desk.add(leg);
  }
  for (let mi = -1; mi <= 1; mi++) {
    const frame = box(1.0, 0.78, 0.1, 0x14171c, mi * 1.1, 1.55, -0.45);
    desk.add(frame);
    const scr = new THREE.Mesh(
      new THREE.PlaneGeometry(0.88, 0.64),
      new THREE.MeshStandardMaterial({ color: 0x060a12, emissive: 0x2a5a8a, emissiveIntensity: 0.9 })
    );
    scr.position.set(mi * 1.1, 1.55, -0.39);
    scr.rotation.y = Math.PI; // face the operator
    desk.add(scr);
  }
  const kb = box(1.2, 0.06, 0.4, 0x1c1f24, 0, 1.1, 0.35);
  desk.add(kb);
  desk.add(makeTextPlane("TELESCOPE CONTROL", 3.2, 0.5, "#9fd8ff", 0, 0.62, 0.72));
  g.add(desk);

  // observer chairs ringing the telescope
  for (const a of [0.7, 2.8, 4.9]) {
    const chair = new THREE.Group();
    chair.position.set(Math.sin(a) * 5.5, 0, Math.cos(a) * 5.5);
    chair.rotation.y = a; // backrest away from the telescope
    const seat = box(0.9, 0.12, 0.9, 0x4a3b2e, 0, 0.85, 0);
    chair.add(seat);
    const back = box(0.9, 1.0, 0.12, 0x4a3b2e, 0, 1.4, 0.42);
    chair.add(back);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.85, 8), mat(0x22262c));
    post.position.y = 0.42;
    chair.add(post);
    g.add(chair);
  }

  // constellation plaques around the dome wall
  CONSTELLATIONS.forEach((c, i) => {
    const phi = Math.PI + (i - 2) * 0.55; // spread across the back wall
    const px = Math.sin(phi) * 13.6, pz = Math.cos(phi) * 13.6;
    const backing = box(7.8, 1.6, 0.15, 0x2b2118, Math.sin(phi) * 13.75, 3.6, Math.cos(phi) * 13.75);
    backing.rotation.y = phi + Math.PI;
    g.add(backing);
    const plaque = makeTextPlane(`${c.name} · ${c.symbol}`, 7.4, 1.2, "#f5c518", px, 3.6, pz);
    plaque.rotation.y = phi + Math.PI;
    g.add(plaque);
  });

  // OBSERVATORY sign above the entrance
  const osign = makeTextPlane("OBSERVATORY", 10, 1.4, "#9fd8ff", 0, 5.2, 12.8);
  osign.rotation.y = Math.PI; // face the room from the entrance side
  g.add(osign);

  // red night lighting — dim so the star field stays readable
  const night = new THREE.PointLight(0xff2a2a, 120, 28);
  night.position.set(-6, 3.4, 6);
  g.add(night);
  const lampPole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 3.2, 8), mat(0x22262c));
  lampPole.position.set(-6, 1.6, 6);
  g.add(lampPole);
  const lampBulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 10, 10),
    new THREE.MeshStandardMaterial({ color: 0x330a0a, emissive: 0xff2a2a, emissiveIntensity: 2.2 })
  );
  lampBulb.position.set(-6, 3.3, 6);
  g.add(lampBulb);

  return {
    group: g,
    domeRadius: R,
    aimTelescope(yaw: number, pitch: number): number[] {
      // view direction from yaw/pitch
      const dir = new THREE.Vector3(
        Math.cos(pitch) * Math.sin(yaw),
        Math.sin(pitch),
        Math.cos(pitch) * Math.cos(yaw)
      ).normalize();
      const hits: number[] = [];
      STAR_FIELD.forEach((s, i) => {
        const v = new THREE.Vector3(s[0], s[1], s[2]).normalize();
        if (v.dot(dir) > 0.9985) hits.push(i); // ~3° cone
      });
      return hits;
    },
    dispose() {
      g.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
      });
      starGeo.dispose();
    },
  };
}

/** Exterior: hilltop dome on a stone base. */
export function buildObservatoryExterior(): THREE.Group {
  const g = new THREE.Group();
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(9, 10, 6, 20),
    new THREE.MeshStandardMaterial({ color: 0x8a8f96, roughness: 0.85 })
  );
  base.position.y = 3; base.castShadow = true;
  g.add(base);
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(8, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0xdde3ea, roughness: 0.5, metalness: 0.2 })
  );
  dome.position.y = 6; dome.castShadow = true;
  g.add(dome);
  // slit
  const slit = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 7, 0.6),
    new THREE.MeshStandardMaterial({ color: 0x14161c })
  );
  slit.position.set(0, 9.5, 6.4);
  slit.rotation.x = 0.35;
  g.add(slit);
  g.position.set(...OBSERVATORY_FACADE_CENTER);
  return g;
}
