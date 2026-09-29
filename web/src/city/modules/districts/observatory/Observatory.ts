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

  // telescope
  const tele = new THREE.Group();
  const tube = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.65, 4.4, 14),
    new THREE.MeshStandardMaterial({ color: 0xb8c0cc, metalness: 0.85, roughness: 0.3 })
  );
  tube.rotation.x = Math.PI / 2.6;
  tube.position.y = 1.6;
  tele.add(tube);
  const mount = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.5, 1.6, 10),
    new THREE.MeshStandardMaterial({ color: 0x3a4048, metalness: 0.6, roughness: 0.5 })
  );
  mount.position.y = 0.8;
  tele.add(mount);
  tele.position.set(0, 0, 0);
  g.add(tele);

  const dim = new THREE.PointLight(0x334455, 200, 30);
  dim.position.set(0, 6, 0);
  g.add(dim);

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
