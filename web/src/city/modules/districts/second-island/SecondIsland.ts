/**
 * 9. SECOND ISLAND — pluggable zone across the bridge.
 *
 * The island is a SEPARATE scene group that the integrator drops into the
 * outdoor world at world coordinates (core owns the ocean, sky, weather, and
 * day/night — we own the island ground + dressing + the bridge seam spec).
 *
 * Pluggability: island builders are registered per biome via
 * `registerIslandBuilder`. The default set covers the four biomes in
 * `IslandZoneSpec`; a future team can override any of them without touching
 * this file.
 *
 * World-seam contract (see MODULE.md "Bridge / world-seam interface"):
 *  - Island groups are positioned at absolute world coords; the bridge deck
 *    connects mainland point B_FROM to island point B_TO at BRIDGE.deckY.
 *  - The integrator owns car/ped collision on the bridge deck (add a box
 *    collider spanning the deck) and gates teleporting onto the bridge.
 *  - BRIDGE.deckY must stay above the core's water plane (y = 0).
 */
import * as THREE from "three";
import type { IslandZoneSpec, Vec3T } from "../types";

/** Bridge seam descriptor — the contract between mainland and island. */
export interface BridgeSeamSpec {
  id: string;
  name: string;
  /** Mainland-side deck start (world coords, y ignored — use deckY). */
  from: Vec3T;
  /** Island-side deck end (world coords). */
  to: Vec3T;
  /** Deck driving surface height. Must be > 0 (core water plane). */
  deckY: number;
  /** Lane count (driving width = lanes * 3.5m). */
  lanes: number;
}

/** The one bridge the city ships with. */
export const BRIDGE: BridgeSeamSpec = {
  id: "bridge:harbor",
  name: "Harbor Bridge",
  from: [-20, 0, 440],
  to: [-20, 0, 590],
  deckY: 6,
  lanes: 2,
};

/**
 * Approach ramps (world coords, axis-aligned along z):
 * mainland ramp climbs y 0 → deckY, island ramp descends deckY → ISLAND_SURFACE_Y.
 */
export const BRIDGE_RAMP_MAIN = { z0: 404, z1: 440, y0: 0, y1: 6 };
export const BRIDGE_RAMP_ISLAND = { z0: 590, z1: 606, y0: 6, y1: 4 };
/** Island ground surface height (baseTerrain cylinder top). */
export const ISLAND_SURFACE_Y = 4;

/** Default island — the neon docks expansion across the strait. */
export const ISLAND_ZONES: IslandZoneSpec[] = [
  {
    id: "island:neon-docks",
    name: "Neon Docks",
    biome: "neon-docks",
    center: [-20, 0, 740],
    radius: 150,
    tagline: "Container port turned neon playground. The bridge was worth it.",
  },
];

/* --------------------------------- registry --------------------------------- */

export type IslandBuilder = (zone: IslandZoneSpec) => THREE.Group;

const builders = new Map<IslandZoneSpec["biome"], IslandBuilder>();

export function registerIslandBuilder(biome: IslandZoneSpec["biome"], builder: IslandBuilder): void {
  builders.set(biome, builder);
}

/* ---------------------------------- helpers ---------------------------------- */

function mat(color: number, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.1, ...opts });
}
function box(w: number, h: number, d: number, color: number, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
let seed = 1337;
function rnd() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }

/** Base terrain disc every biome starts from. */
function baseTerrain(zone: IslandZoneSpec, groundColor: number, rimColor: number): THREE.Group {
  const g = new THREE.Group();
  const r = zone.radius;
  const ground = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.04, 4, 48), mat(groundColor));
  ground.position.y = 2; ground.receiveShadow = true;
  g.add(ground);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(r * 0.99, 2.2, 8, 48), mat(rimColor));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 1.2;
  g.add(rim);
  // beach ring
  const beach = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.02, r * 1.06, 1.2, 48), mat(0xd8c49a));
  beach.position.y = 0.6;
  g.add(beach);
  return g;
}

function palmTree(x: number, z: number, s = 1): THREE.Group {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3 * s, 0.45 * s, 6 * s, 8), mat(0x7a5a38));
  trunk.position.y = 3 * s; trunk.rotation.z = 0.08;
  trunk.castShadow = true;
  g.add(trunk);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const frond = new THREE.Mesh(new THREE.ConeGeometry(0.7 * s, 3.2 * s, 6), mat(0x2e7a3a));
    frond.position.set(Math.cos(a) * 1.4 * s, 6.2 * s, Math.sin(a) * 1.4 * s);
    frond.rotation.set(Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1);
    g.add(frond);
  }
  g.position.set(x, 4, z);
  return g;
}

function pineTree(x: number, z: number, s = 1): THREE.Group {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25 * s, 0.3 * s, 1.6 * s, 6), mat(0x5a4028));
  trunk.position.y = 0.8 * s;
  g.add(trunk);
  for (let i = 0; i < 3; i++) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry((2.2 - i * 0.6) * s, 2.4 * s, 8), mat(0x2a5a3a));
    cone.position.y = (1.8 + i * 1.5) * s;
    cone.castShadow = true;
    g.add(cone);
  }
  g.position.set(x, 4, z);
  return g;
}

function scatter(zone: IslandZoneSpec, count: number, margin: number): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < count; i++) {
    const a = rnd() * Math.PI * 2;
    const r = rnd() * (zone.radius - margin);
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return pts;
}

/* ------------------------------- biome builders ----------------------------- */

function buildTropical(zone: IslandZoneSpec): THREE.Group {
  const g = baseTerrain(zone, 0x9ab86a, 0x6a8a4a);
  for (const [x, z] of scatter(zone, 26, 25)) g.add(palmTree(x, z, 0.8 + rnd() * 0.6));
  // tiki bar hut
  const [hx, hz] = [20, -30];
  g.add(box(8, 3, 6, 0x8a6b45, hx, 5.5, hz));
  const roof = new THREE.Mesh(new THREE.ConeGeometry(7, 3, 4), mat(0x6b4a2e));
  roof.position.set(hx, 8.5, hz); roof.rotation.y = Math.PI / 4;
  g.add(roof);
  const signC = document.createElement("canvas");
  signC.width = 512; signC.height = 96;
  const sctx = signC.getContext("2d")!;
  sctx.fillStyle = "#101010"; sctx.fillRect(0, 0, 512, 96);
  sctx.fillStyle = "#22ff88"; sctx.font = "bold 52px Arial"; sctx.textAlign = "center"; sctx.textBaseline = "middle";
  sctx.fillText("TIKI · PAPER CITY ONLY", 256, 50);
  const stex = new THREE.CanvasTexture(signC);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.3), new THREE.MeshBasicMaterial({ map: stex }));
  sign.position.set(hx, 7.6, hz + 3.2);
  g.add(sign);
  g.position.set(zone.center[0], 0, zone.center[2]);
  return g;
}

function buildVolcanic(zone: IslandZoneSpec): THREE.Group {
  const g = baseTerrain(zone, 0x2e2a28, 0x4a2424);
  // cone
  const cone = new THREE.Mesh(new THREE.ConeGeometry(38, 34, 24), mat(0x3a3432, { roughness: 0.95 }));
  cone.position.y = 4 + 17; cone.castShadow = true;
  g.add(cone);
  const crater = new THREE.Mesh(
    new THREE.CircleGeometry(9, 20),
    new THREE.MeshBasicMaterial({ color: 0xff5a1a })
  );
  crater.rotation.x = -Math.PI / 2;
  crater.position.y = 38.2;
  g.add(crater);
  const glow = new THREE.PointLight(0xff5a1a, 3000, 120);
  glow.position.y = 40;
  g.add(glow);
  // lava vents
  for (const [x, z] of scatter(zone, 7, 50)) {
    const vent = new THREE.Mesh(new THREE.CircleGeometry(2.2, 12), new THREE.MeshBasicMaterial({ color: 0xff7a2a }));
    vent.rotation.x = -Math.PI / 2;
    vent.position.set(x, 4.05, z);
    g.add(vent);
  }
  // obsidian rocks
  for (const [x, z] of scatter(zone, 18, 45)) {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1.5 + rnd() * 2), mat(0x1e1a18));
    rock.position.set(x, 4.6, z);
    rock.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
    rock.castShadow = true;
    g.add(rock);
  }
  g.position.set(zone.center[0], 0, zone.center[2]);
  return g;
}

function neonSign(text: string, w: number, color: string): THREE.Mesh {
  const c = document.createElement("canvas");
  c.width = 1024; c.height = 128;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#0a0a0a"; ctx.fillRect(0, 0, 1024, 128);
  ctx.fillStyle = color; ctx.font = "bold 72px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(text, 512, 68);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.125), new THREE.MeshBasicMaterial({ map: tex }));
}

/** Fixed island structures (local coords) — also the source for islandColliders(). */
const ISLAND_STRUCTURES: { cx: number; cz: number; hw: number; hd: number }[] = [
  { cx: 0, cz: -40, hw: 15, hd: 9 },    // dock warehouse
  { cx: 60, cz: -20, hw: 12, hd: 8 },   // neon arcade
  { cx: -70, cz: 30, hw: 9, hd: 6 },    // diner
  { cx: -40, cz: -70, hw: 8, hd: 6 },   // dock office A
  { cx: 30, cz: 70, hw: 7, hd: 5 },     // dock office B
  { cx: 80, cz: 60, hw: 22, hd: 8 },    // fuel tank farm
  { cx: -60, cz: 20, hw: 26, hd: 20 },  // container yard
];

function buildNeonDocks(zone: IslandZoneSpec): THREE.Group {
  const g = baseTerrain(zone, 0x3a3f45, 0x2a2e33);
  const S = ISLAND_SURFACE_Y; // local ground height
  const containerColors = [0xc23b3b, 0x2a6bc2, 0x2e9e5a, 0xd8a02e, 0x7a3bc2];

  // ring road around the island
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(96, 110, 48),
    mat(0x1c1f24, { roughness: 0.95 }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = S + 0.06;
  ring.receiveShadow = true;
  g.add(ring);
  // ring-road lamps
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const x = Math.cos(a) * 103, z = Math.sin(a) * 103;
    g.add(box(0.35, 9, 0.35, 0x2a2e33, x, S + 4.5, z));
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffe9b0 }));
    bulb.position.set(x, S + 9.2, z);
    g.add(bulb);
  }

  // container yard — fixed grid (deterministic, collider-friendly)
  for (let gx = 0; gx < 4; gx++) {
    for (let gz = 0; gz < 3; gz++) {
      const x = -80 + gx * 13;
      const z = 5 + gz * 12;
      const h = 1 + ((gx + gz) % 3);
      for (let i = 0; i < h; i++) {
        g.add(box(6, 2.6, 2.6, containerColors[(gx * 3 + gz + i) % containerColors.length], x, S + 1.3 + i * 2.7, z));
      }
    }
  }

  // piers (north edge, facing the mainland)
  for (const px of [-50, 0, 50]) {
    g.add(box(10, 1, 30, 0x6b5a44, px, S - 0.5, zone.radius - 25));
    for (let i = 0; i < 4; i++) g.add(box(0.6, 4, 0.6, 0x4a3d2e, px - 4, S - 2, zone.radius - 38 + i * 9));
  }
  // ferry boat moored at the middle pier
  const ferry = new THREE.Group();
  const fhull = new THREE.Mesh(new THREE.BoxGeometry(8, 3, 22), mat(0xe8e8e8));
  fhull.position.y = 1;
  ferry.add(fhull);
  const fcabin = new THREE.Mesh(new THREE.BoxGeometry(6, 3.4, 12), mat(0x2a6bc2));
  fcabin.position.y = 4;
  ferry.add(fcabin);
  ferry.position.set(0, -0.5, zone.radius - 8);
  g.add(ferry);
  const ferrySign = neonSign("FERRY · HARBOR", 14, "#22e5ff");
  ferrySign.position.set(0, S + 8, zone.radius - 22);
  g.add(ferrySign);

  // neon sign poles
  const neonColors = [0xff2a7a, 0x22e5ff, 0xb8ff2a, 0xff8a2a];
  for (let i = 0; i < 8; i++) {
    const [x, z] = scatter(zone, 1, 60)[0];
    g.add(box(0.4, 12, 0.4, 0x22262b, x, S + 6, z));
    const tube = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 10, 10),
      new THREE.MeshBasicMaterial({ color: neonColors[i % neonColors.length] })
    );
    tube.position.set(x, S + 12.4, z);
    g.add(tube);
    const light = new THREE.PointLight(neonColors[i % neonColors.length], 500, 34);
    light.position.set(x, S + 11, z);
    g.add(light);
  }

  // dock warehouse
  g.add(box(30, 9, 18, 0x4a5058, 0, S + 4.5, -40));
  const whSign = neonSign("NEON DOCKS", 20, "#22e5ff");
  whSign.position.set(0, S + 7, -30.8);
  g.add(whSign);

  // neon arcade
  g.add(box(24, 10, 16, 0x1e1428, 60, S + 5, -20));
  const arcadeSign = neonSign("★ ARCADE ★", 18, "#ff2a7a");
  arcadeSign.position.set(60, S + 8, -11.8);
  g.add(arcadeSign);
  const arcadeGlow = new THREE.PointLight(0xff2a7a, 800, 40);
  arcadeGlow.position.set(60, S + 9, -8);
  g.add(arcadeGlow);

  // diner
  g.add(box(18, 7, 12, 0xd8d0c0, -70, S + 3.5, 30));
  const dinerSign = neonSign("24H DINER", 14, "#ffb02a");
  dinerSign.position.set(-70, S + 6.4, 36.2);
  g.add(dinerSign);

  // dock offices
  g.add(box(16, 8, 12, 0x3a4a5a, -40, S + 4, -70));
  g.add(box(14, 6, 10, 0x4a3a5a, 30, S + 3, 70));
  const offSign = neonSign("HARBOR OPS", 12, "#b8ff2a");
  offSign.position.set(-40, S + 7, -63.8);
  g.add(offSign);

  // fuel tank farm
  for (let i = 0; i < 3; i++) {
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 10, 18), mat(0x8a8f96, { metalness: 0.5 }));
    tank.position.set(66 + i * 14, S + 5, 60);
    tank.castShadow = true;
    g.add(tank);
  }
  const tankSign = neonSign("FUEL", 8, "#ff8a2a");
  tankSign.position.set(80, S + 11.5, 53.8);
  g.add(tankSign);

  // palms along the beach ring
  for (const [x, z] of scatter(zone, 18, 12)) {
    const r = Math.hypot(x, z);
    if (r < zone.radius - 22) continue; // keep the interior clear
    g.add(palmTree(x, z, 0.8 + rnd() * 0.5));
  }

  g.position.set(zone.center[0], 0, zone.center[2]);
  return g;
}

/**
 * Absolute-world AABB colliders for the island's fixed structures.
 * The integrator adds these to its collision set so the island is drivable.
 */
export function islandColliders(zone: IslandZoneSpec): { minX: number; maxX: number; minZ: number; maxZ: number }[] {
  const [cx, , cz] = zone.center;
  return ISLAND_STRUCTURES.map((s) => ({
    minX: cx + s.cx - s.hw,
    maxX: cx + s.cx + s.hw,
    minZ: cz + s.cz - s.hd,
    maxZ: cz + s.cz + s.hd,
  }));
}

function buildArctic(zone: IslandZoneSpec): THREE.Group {
  const g = baseTerrain(zone, 0xe8eef4, 0xb8c8d8);
  for (const [x, z] of scatter(zone, 30, 25)) g.add(pineTree(x, z, 0.9 + rnd() * 0.8));
  // frozen lake
  const lake = new THREE.Mesh(
    new THREE.CircleGeometry(24, 28),
    new THREE.MeshStandardMaterial({ color: 0x9fd4e8, roughness: 0.15, metalness: 0.4 })
  );
  lake.rotation.x = -Math.PI / 2;
  lake.position.set(-30, 4.06, 30);
  g.add(lake);
  // ice spikes
  for (const [x, z] of scatter(zone, 10, 50)) {
    const spike = new THREE.Mesh(new THREE.ConeGeometry(1.2, 4 + rnd() * 4, 6), mat(0xcfe8f4, { roughness: 0.25 }));
    spike.position.set(x, 6, z);
    g.add(spike);
  }
  // research hut
  g.add(box(10, 4, 8, 0xd84a2a, 35, 6, -20));
  g.position.set(zone.center[0], 0, zone.center[2]);
  return g;
}

registerIslandBuilder("tropical", buildTropical);
registerIslandBuilder("volcanic", buildVolcanic);
registerIslandBuilder("neon-docks", buildNeonDocks);
registerIslandBuilder("arctic", buildArctic);

/* ---------------------------------- bridge ---------------------------------- */

/** Suspension bridge along the seam's from→to axis. Integrator adds to world. */
export function buildBridge(seam: BridgeSeamSpec = BRIDGE): THREE.Group {
  const g = new THREE.Group();
  const from = new THREE.Vector3(seam.from[0], 0, seam.from[2]);
  const to = new THREE.Vector3(seam.to[0], 0, seam.to[2]);
  const len = from.distanceTo(to);
  const width = seam.lanes * 3.5 + 4;
  const y = seam.deckY;

  // deck
  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(width, 1.2, len),
    mat(0x4a4f55, { roughness: 0.8 })
  );
  deck.position.set(0, y, len / 2);
  deck.castShadow = true; deck.receiveShadow = true;
  g.add(deck);
  // road stripes
  for (let i = 0; i < seam.lanes - 1; i++) {
    const stripe = new THREE.Mesh(
      new THREE.PlaneGeometry(0.25, len - 8),
      new THREE.MeshBasicMaterial({ color: 0xf5c518 })
    );
    stripe.rotation.x = -Math.PI / 2;
    stripe.position.set((i - (seam.lanes - 2) / 2) * 3.5, y + 0.62, len / 2);
    g.add(stripe);
  }
  // railings
  for (const sx of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.1, len), mat(0x2a2e33));
    rail.position.set(sx * (width / 2 - 0.3), y + 1.1, len / 2);
    g.add(rail);
  }
  // towers + suspension cables (sag between the two towers, anchor at deck ends)
  const towerH = 22;
  const towerZ = [len * 0.25, len * 0.75];
  for (const tz of towerZ) {
    for (const sx of [-1, 1]) {
      const tower = new THREE.Mesh(new THREE.BoxGeometry(1.4, towerH, 1.4), mat(0x8a8f96));
      tower.position.set(sx * (width / 2 + 1), y + towerH / 2 - 2, tz);
      tower.castShadow = true;
      g.add(tower);
    }
  }
  const topY = y + towerH - 2;
  const sagY = y + 3;
  for (const sx of [-1, 1]) {
    const pts: THREE.Vector3[] = [];
    const span = (z0: number, z1: number, y0: number, y1: number, sag: number, n: number) => {
      for (let k = 0; k <= n; k++) {
        const kk = k / n;
        pts.push(new THREE.Vector3(
          sx * (width / 2 + 1),
          y0 + (y1 - y0) * kk - Math.sin(kk * Math.PI) * sag,
          z0 + (z1 - z0) * kk
        ));
      }
    };
    span(0, towerZ[0], y + 2, topY, 0, 10);            // anchor → tower 1
    span(towerZ[0], towerZ[1], topY, topY, topY - sagY, 20); // main sag
    span(towerZ[1], len, topY, y + 2, 0, 10);          // tower 2 → anchor
    g.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: 0xd8d8d8 })
    ));
  }
  // support pylons into the water
  for (let k = 0; k <= 6; k++) {
    const pz = (k / 6) * len;
    const pylon = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2, y + 6, 10), mat(0x6a6f76));
    pylon.position.set(0, (y - 6) / 2, pz);
    g.add(pylon);
  }
  // lamps
  for (let k = 0; k <= 8; k++) {
    const lz = (k / 8) * len;
    for (const sx of [-1, 1]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 5, 6), mat(0x2a2e33));
      pole.position.set(sx * (width / 2 - 0.6), y + 2.5, lz);
      g.add(pole);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffe9b0 }));
      bulb.position.set(sx * (width / 2 - 0.6), y + 5.1, lz);
      g.add(bulb);
    }
  }
  const midLight = new THREE.PointLight(0xffe9b0, 1200, len);
  midLight.position.set(0, y + 8, len / 2);
  g.add(midLight);

  // approach ramps — mainland climbs 0 → deckY, island descends deckY → surface.
  // Local +z runs from→to: a ramp rising toward +z needs rotation.x < 0.
  const addRamp = (zA: number, zB: number, yA: number, yB: number) => {
    const run = zB - zA;
    const rise = yB - yA;
    const rampLen = Math.hypot(run, rise);
    const pitch = -Math.atan2(rise, Math.abs(run));
    const ramp = new THREE.Mesh(
      new THREE.BoxGeometry(width, 1.2, rampLen),
      mat(0x4a4f55, { roughness: 0.8 })
    );
    ramp.position.set(0, (yA + yB) / 2 - 0.2, (zA + zB) / 2);
    ramp.rotation.x = pitch;
    ramp.castShadow = true; ramp.receiveShadow = true;
    g.add(ramp);
    for (const sx of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.1, rampLen), mat(0x2a2e33));
      rail.position.set(sx * (width / 2 - 0.3), (yA + yB) / 2 + 0.9, (zA + zB) / 2);
      rail.rotation.x = pitch;
      g.add(rail);
    }
  };
  addRamp(-(BRIDGE_RAMP_MAIN.z1 - BRIDGE_RAMP_MAIN.z0), 0, BRIDGE_RAMP_MAIN.y0, BRIDGE_RAMP_MAIN.y1);
  addRamp(len, len + (BRIDGE_RAMP_ISLAND.z1 - BRIDGE_RAMP_ISLAND.z0), BRIDGE_RAMP_ISLAND.y0, BRIDGE_RAMP_ISLAND.y1);

  // orient: local +z along from→to, origin at `from`
  const dir = to.clone().sub(from);
  const yaw = Math.atan2(dir.x, dir.z);
  g.rotation.y = yaw;
  g.position.set(from.x, 0, from.z);

  return g;
}

/** Collider box for the bridge deck — integrator adds to its collision set. */
export function bridgeCollider(seam: BridgeSeamSpec = BRIDGE): {
  minX: number; maxX: number; minZ: number; maxZ: number; topY: number;
} {
  const width = seam.lanes * 3.5 + 4;
  const half = width / 2;
  const minX = Math.min(seam.from[0], seam.to[0]) - half;
  const maxX = Math.max(seam.from[0], seam.to[0]) + half;
  const minZ = Math.min(seam.from[2], seam.to[2]);
  const maxZ = Math.max(seam.from[2], seam.to[2]);
  return { minX, maxX, minZ, maxZ, topY: seam.deckY + 0.6 };
}

export interface DriveBox { minX: number; maxX: number; minZ: number; maxZ: number; topY: number }

/**
 * Full drivable path: stepped collider boxes for the deck AND both approach
 * ramps. The integrator should add ALL of these to its collision set (and
 * use them for the car/ped "on bridge" ground-height check) — `bridgeCollider`
 * alone leaves cars unable to climb onto the deck.
 */
export function bridgeDriveBoxes(seam: BridgeSeamSpec = BRIDGE): DriveBox[] {
  const width = seam.lanes * 3.5 + 4;
  const half = width / 2 + 0.5;
  // The shipped seam runs along +z at fixed x; interpolate parametrically so
  // custom seams still get sane boxes.
  const fx = seam.from[0], fz = seam.from[2];
  const tx = seam.to[0], tz = seam.to[2];
  const at = (t: number): [number, number] => [fx + (tx - fx) * t, fz + (tz - fz) * t];
  const boxes: DriveBox[] = [];
  const push = (t0: number, t1: number, topY: number) => {
    const [x0, z0] = at(t0);
    const [x1, z1] = at(t1);
    boxes.push({
      minX: Math.min(x0, x1) - half,
      maxX: Math.max(x0, x1) + half,
      minZ: Math.min(z0, z1) - half,
      maxZ: Math.max(z0, z1) + half,
      topY,
    });
  };
  const deckLen = Math.hypot(tx - fx, tz - fz);
  const mainRun = BRIDGE_RAMP_MAIN.z1 - BRIDGE_RAMP_MAIN.z0;   // 36
  const islRun = BRIDGE_RAMP_ISLAND.z1 - BRIDGE_RAMP_ISLAND.z0; // 16
  // mainland ramp: t < 0 (before `from`), 3 steps 0 → deckY
  const mainStep = mainRun / deckLen / 3;
  for (let k = 0; k < 3; k++) {
    const topY = seam.deckY * ((k + 1) / 3) + 0.8;
    push(-(3 - k) * mainStep, -(2 - k) * mainStep, topY);
  }
  // deck
  push(0, 1, seam.deckY + 0.8);
  // island ramp: t > 1, 2 steps deckY → ISLAND_SURFACE_Y
  const islStep = islRun / deckLen / 2;
  for (let k = 0; k < 2; k++) {
    const topY = seam.deckY - (seam.deckY - ISLAND_SURFACE_Y) * ((k + 1) / 2) + 0.8;
    push(1 + k * islStep, 1 + (k + 1) * islStep, topY);
  }
  return boxes;
}

/* --------------------------------- assembly --------------------------------- */

export interface IslandScene {
  group: THREE.Group;
  zone: IslandZoneSpec;
  dispose(): void;
}

/** Build an island scene with the registered builder for its biome. */
export function buildIslandScene(zone: IslandZoneSpec): IslandScene {
  const builder = builders.get(zone.biome);
  if (!builder) throw new Error(`No island builder registered for biome "${zone.biome}"`);
  const group = builder(zone);
  return {
    group,
    zone,
    dispose() {
      group.traverse((o) => { const m = o as THREE.Mesh; if (m.geometry) m.geometry.dispose(); });
    },
  };
}

/** All default islands, built with their registered builders. */
export function buildAllIslands(): IslandScene[] {
  return ISLAND_ZONES.map(buildIslandScene);
}
