import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { furnishDistrict } from "./furnish";

/**
 * OrbitX City — downtown district (3x3 expansion around the core block).
 *
 * The core block occupies roughly x∈[-31,31], z∈[-36,33]. This district adds
 * a ring around it: collector roads at x=±36 / z=±36, ring roads at x=±60 /
 * z=±60, and 12 new buildings (parody storefronts with walkable interiors,
 * a bank, hotel, gas station, laundromat, office tower, and an open plaza).
 *
 * Building shells are placed by CityWorld.placeBuildingDef (GLB from
 * /city/buildings/<name>.glb, procedural fallback otherwise) because the
 * district defs are spread into the world's BUILDINGS array — that wires
 * POI detection, POI labels, minimap, scan-pulse reveal, interior camera
 * pull-in, and the "+5 CITY" entry toast for free.
 *
 * mountDistrict() handles everything else via the world's public surface:
 * district ground/roads, plaza + fountain, parking lots, street props, and
 * interior furnishing (furnish.ts).
 *
 * Footprints below are ESTIMATED (no DIMENSIONS.md from the GLB lane yet —
 * sibling agent is still building the 12 GLBs). The procedural fallbacks use
 * these same numbers, so gameplay/colliders stay correct either way.
 * Recalibrate hx/hz/door when the GLBs land.
 */

/** Structural twin of CityWorld's BuildingDef (local so this module compiles standalone). */
export interface DistrictBuildingDef {
  name: string;
  x: number; z: number; rotY: number;
  hx: number; hz: number; height: number;
  door?: { from: number; to: number }; // door gap on local +z face (local x range)
  label: string;
  poi?: boolean;
  open?: boolean; // open-air (plaza): no walls/colliders, ground built by mountDistrict
}

/** Minimal public surface mountDistrict needs from the world. */
export interface DistrictWorldHost {
  readonly sceneRef: THREE.Scene;
  readonly collidersRef: { minX: number; maxX: number; minZ: number; maxZ: number }[];
  /** Register an emissive lamp material for the world's flicker pass. */
  addLampMat(m: THREE.MeshStandardMaterial): void;
}

/** Rect collider helper (local helper — the world exposes dots only via closures). */
export interface DistrictColliderSink {
  dot(x: number, z: number, r: number): void;
  rect(x0: number, z0: number, x1: number, z1: number): void;
}

export const DISTRICT_BUILDINGS: DistrictBuildingDef[] = [
  // north strip (z=-47), doors face +z toward the collector road
  { name: "mcorbits",    x: -25, z: -47, rotY: 0,            hx: 6,   hz: 5,   height: 6.5, door: { from: -1.6, to: 1.6 }, label: "McOrbit's", poi: true },
  { name: "burgerkhan",  x: 0,   z: -47, rotY: 0,            hx: 6,   hz: 5,   height: 6.5, door: { from: -1.6, to: 1.6 }, label: "Burger Khan", poi: true },
  { name: "wendas",      x: 25,  z: -47, rotY: 0,            hx: 5.5, hz: 4.8, height: 6,   door: { from: -1.5, to: 1.5 }, label: "Wenda's", poi: true },
  // east strip (x=47), doors face -x (rotY=-PI/2 maps local +z → world -x)
  { name: "wallorbit",   x: 47,  z: -20, rotY: -Math.PI / 2, hx: 9,  hz: 7,   height: 8,   door: { from: -2.4, to: 2.4 }, label: "WallOrbit", poi: true },
  { name: "bank",        x: 47,  z: 5,   rotY: -Math.PI / 2, hx: 6,  hz: 5,   height: 7.5, door: { from: -1.4, to: 1.4 }, label: "OrbitX Bank", poi: true },
  { name: "hotel",       x: 47,  z: 28,  rotY: -Math.PI / 2, hx: 7,  hz: 6,   height: 22,  door: { from: -2, to: 2 },     label: "Grand Orbit Hotel", poi: true },
  // south strip (z=47), doors face -z
  { name: "pizzashack",  x: -25, z: 47,  rotY: Math.PI,      hx: 5,   hz: 4.5, height: 5.5, door: { from: -1.4, to: 1.4 }, label: "Pizza Orbit", poi: true },
  { name: "plaza",       x: 0,   z: 47,  rotY: 0,            hx: 12,  hz: 8,   height: 0,   label: "Fountain Plaza", poi: true, open: true },
  { name: "laundromat",  x: 25,  z: 47,  rotY: Math.PI,      hx: 5.5, hz: 4.8, height: 5.5, door: { from: -1.5, to: 1.5 }, label: "Spin Cycle", poi: true },
  // west strip (x=-47), doors face +x (rotY=PI/2 maps local +z → world +x)
  { name: "gasstation",  x: -47, z: -20, rotY: Math.PI / 2,  hx: 6.5, hz: 5.5, height: 5,   door: { from: -1.2, to: 1.2 }, label: "Orbit Gas", poi: true },
  { name: "coffeeshop",  x: -47, z: 5,   rotY: Math.PI / 2,  hx: 5,   hz: 4.5, height: 6,   door: { from: -1.4, to: 1.4 }, label: "Moonbux", poi: true },
  { name: "officetower2",x: -47, z: 30,  rotY: Math.PI / 2,  hx: 7,   hz: 7,   height: 34,  label: "OrbitX Tower 2", poi: true },
];

const loader = new GLTFLoader();
const propCache = new Map<string, Promise<THREE.Group | null>>();

function loadProp(name: string): Promise<THREE.Group | null> {
  const url = `/city/props/${name}.glb`;
  let p = propCache.get(url);
  if (!p) {
    p = loader.loadAsync(url).then((g) => g.scene).catch(() => null);
    propCache.set(url, p);
  }
  return p;
}

let glowTex: THREE.Texture | null = null;
function getGlowTex(): THREE.Texture {
  if (!glowTex) {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const ctx = c.getContext("2d")!;
    const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.4, "rgba(255,255,255,0.35)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    glowTex = new THREE.CanvasTexture(c);
  }
  return glowTex;
}

function addGlow(scene: THREE.Scene, x: number, y: number, z: number, color: number, scale: number, opacity = 0.5): void {
  const sm = new THREE.SpriteMaterial({
    map: getGlowTex(), color, transparent: true, opacity,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const sp = new THREE.Sprite(sm);
  sp.position.set(x, y, z);
  sp.scale.set(scale, scale, 1);
  scene.add(sp);
}

function boxMesh(w: number, h: number, d: number, color: number, rough = 0.85, metal = 0): THREE.Mesh {
  const g = new THREE.BoxGeometry(w, h, d);
  const m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
  return new THREE.Mesh(g, m);
}

/** Mount the downtown district. Called once from CityWorld.buildBlock(). */
export async function mountDistrict(world: DistrictWorldHost): Promise<void> {
  const scene = world.sceneRef;
  const colliders = world.collidersRef;
  const sink: DistrictColliderSink = {
    dot: (x, z, r) => colliders.push({ minX: x - r, maxX: x + r, minZ: z - r, maxZ: z + r }),
    rect: (x0, z0, x1, z1) => colliders.push({
      minX: Math.min(x0, x1), maxX: Math.max(x0, x1),
      minZ: Math.min(z0, z1), maxZ: Math.max(z0, z1),
    }),
  };

  buildDistrictGround(scene);
  await buildPlaza(scene, sink);
  await buildParkingLots(scene, sink);
  await buildStreetProps(world, sink.dot.bind(sink));
  buildGasPumps(scene, sink.dot.bind(sink));
  buildAlleyProps(scene, sink.dot.bind(sink));
  // furnished interiors for every walkable district building
  await furnishDistrict(world, DISTRICT_BUILDINGS);
}

// ── district ground: ring around the core (core street.glb covers ±35) ──

function groundPlane(x0: number, z0: number, x1: number, z1: number, color: number, y: number, scene: THREE.Scene): void {
  const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0);
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
  const p = new THREE.Mesh(g, m);
  p.rotation.x = -Math.PI / 2;
  p.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
  scene.add(p);
}

function roadPlane(x0: number, z0: number, x1: number, z1: number, y: number, scene: THREE.Scene): void {
  groundPlane(x0, z0, x1, z1, 0x0e1116, y, scene); // wet asphalt
}

function buildDistrictGround(scene: THREE.Scene): void {
  // concrete base ring (avoids the core ±35, which street.glb owns)
  groundPlane(-70, -70, 70, -35, 0x14171e, 0.008, scene); // north
  groundPlane(-70, 35, 70, 70, 0x14171e, 0.008, scene);   // south
  groundPlane(-70, -35, -35, 35, 0x14171e, 0.008, scene); // west
  groundPlane(35, -35, 70, 35, 0x14171e, 0.008, scene);    // east

  // collector roads (x=±36, z=±36, width 6)
  roadPlane(33, -70, 39, 70, 0.014, scene);
  roadPlane(-39, -70, -33, 70, 0.014, scene);
  roadPlane(-70, 33, 70, 39, 0.016, scene);
  roadPlane(-70, -39, 70, -33, 0.016, scene);
  // ring roads (x=±60, z=±60, width 8)
  roadPlane(56, -70, 64, 70, 0.02, scene);
  roadPlane(-64, -70, -56, 70, 0.02, scene);
  roadPlane(-70, 56, 70, 64, 0.022, scene);
  roadPlane(-70, -64, 70, -56, 0.022, scene);

  // sidewalk pads under each building strip (slightly lighter concrete)
  groundPlane(-33, -56, 33, -39, 0x1b1f27, 0.011, scene); // north strip
  groundPlane(-33, 39, 33, 56, 0x1b1f27, 0.011, scene);   // south strip
  groundPlane(39, -33, 56, 33, 0x1b1f27, 0.011, scene);   // east strip
  groundPlane(-56, -33, -39, 33, 0x1b1f27, 0.011, scene); // west strip
}

// ── fountain plaza (0, 47) ──

async function buildPlaza(
  scene: THREE.Scene,
  sink: DistrictColliderSink,
): Promise<void> {
  const cx = 0, cz = 47;
  const dot = sink.dot.bind(sink);
  // paver disc
  const g = new THREE.CircleGeometry(11, 40);
  const m = new THREE.MeshStandardMaterial({ color: 0x232833, roughness: 0.7 });
  const disc = new THREE.Mesh(g, m);
  disc.rotation.x = -Math.PI / 2;
  disc.position.set(cx, 0.024, cz);
  scene.add(disc);
  // fountain: basin + water + column
  const basin = new THREE.Mesh(
    new THREE.CylinderGeometry(2.8, 3.0, 0.8, 24),
    new THREE.MeshStandardMaterial({ color: 0x2c3340, roughness: 0.6 }),
  );
  basin.position.set(cx, 0.4, cz);
  scene.add(basin);
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(2.45, 24),
    new THREE.MeshStandardMaterial({ color: 0x0a2a33, emissive: 0x17e6d4, emissiveIntensity: 0.9, roughness: 0.25 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(cx, 0.82, cz);
  scene.add(water);
  const column = new THREE.Mesh(
    new THREE.CylinderGeometry(0.45, 0.6, 2.0, 12),
    new THREE.MeshStandardMaterial({ color: 0x3d4657, roughness: 0.6 }),
  );
  column.position.set(cx, 1.6, cz);
  scene.add(column);
  addGlow(scene, cx, 2.6, cz, 0x17e6d4, 7, 0.5);
  dot(cx, cz, 3.1); // fountain basin collider

  // benches + planters ring (try GLB props, fall back to procedural)
  {
    const [benchGlb, planterGlb] = await Promise.all([loadProp("bench"), loadProp("planter")]);
    const spots: [number, number, number][] = [
      [-6, 43, 0.5], [6, 43, -0.5], [-6, 51, -0.5], [6, 51, 0.5],
    ];
    for (const [bx, bz, ry] of spots) {
      if (benchGlb) {
        const b = benchGlb.clone(true);
        b.position.set(bx, 0, bz); b.rotation.y = ry;
        scene.add(b);
      } else {
        const seat = boxMesh(2.2, 0.12, 0.6, 0x6b4a2e);
        seat.position.set(bx, 0.55, bz); seat.rotation.y = ry;
        const back = boxMesh(2.2, 0.5, 0.1, 0x5a3d24);
        back.position.set(bx - Math.sin(ry) * 0.3, 0.95, bz - Math.cos(ry) * 0.3); back.rotation.y = ry;
        scene.add(seat, back);
      }
      dot(bx, bz, 1.2);
    }
    const plantSpots: [number, number][] = [[-9, 47], [9, 47], [0, 40], [0, 54]];
    for (const [px2, pz2] of plantSpots) {
      if (planterGlb) {
        const pl = planterGlb.clone(true);
        pl.position.set(px2, 0, pz2);
        scene.add(pl);
      } else {
        const pot = new THREE.Mesh(
          new THREE.CylinderGeometry(0.55, 0.45, 0.7, 10),
          new THREE.MeshStandardMaterial({ color: 0x3a3f4c, roughness: 0.8 }),
        );
        pot.position.set(px2, 0.35, pz2);
        const leaves = new THREE.Mesh(
          new THREE.IcosahedronGeometry(0.9, 0),
          new THREE.MeshStandardMaterial({ color: 0x1f5c2e, roughness: 0.9 }),
        );
        leaves.position.set(px2, 1.35, pz2);
        scene.add(pot, leaves);
      }
      dot(px2, pz2, 0.7);
    }
  }
}

// ── parking lots (NE + SW corners) ──

function buildParkingLots(
  scene: THREE.Scene,
  sink: DistrictColliderSink,
): Promise<void> {
  const lots: [number, number][] = [[46, -46], [-46, 46]]; // [cx, cz]
  return (async () => {
    const [carRed, carTeal, carDark] = await Promise.all([
      loadProp("car_red"), loadProp("car_teal"), loadProp("car_dark"),
    ]);
    const cars = [carRed, carTeal, carDark];
    for (const [cx, cz] of lots) {
      // asphalt pad
      const pad = new THREE.Mesh(
        new THREE.PlaneGeometry(18, 15),
        new THREE.MeshStandardMaterial({ color: 0x101319, roughness: 0.5, metalness: 0.3 }),
      );
      pad.rotation.x = -Math.PI / 2;
      pad.position.set(cx, 0.02, cz);
      scene.add(pad);
      // stall divider lines — one InstancedMesh per lot (6 stalls)
      const lineG = new THREE.BoxGeometry(0.12, 0.02, 4.6);
      const lineM = new THREE.MeshStandardMaterial({ color: 0xd8dce4, roughness: 0.7 });
      const lines = new THREE.InstancedMesh(lineG, lineM, 7);
      const mtx = new THREE.Matrix4();
      for (let i = 0; i < 7; i++) {
        mtx.makeTranslation(cx - 7.5 + i * 2.5, 0.035, cz);
        lines.setMatrixAt(i, mtx);
      }
      lines.instanceMatrix.needsUpdate = true;
      scene.add(lines);
      // a few parked cars (procedural fallback when the GLB is missing)
      const spots: [number, number][] = [[cx - 5, cz - 1], [cx, cz + 1.5], [cx + 5, cz - 1]];
      spots.forEach(([sx, sz], i) => {
        const glb = cars[i % cars.length];
        if (glb) {
          const c = glb.clone(true);
          c.position.set(sx, 0, sz);
          scene.add(c);
        } else {
          const body = boxMesh(4.4, 0.9, 2.0, [0xc23b4e, 0x17e6d4, 0x23262e][i % 3], 0.4, 0.5);
          body.position.set(sx, 0.65, sz);
          const cab = boxMesh(2.2, 0.7, 1.8, 0x14161c, 0.3, 0.6);
          cab.position.set(sx, 1.35, sz);
          scene.add(body, cab);
        }
        collidersPush(sink, sx, sz, 2.4, 1.2);
      });
    }
  })();

  function collidersPush(
    sink: DistrictColliderSink, x: number, z: number, hx: number, hz: number,
  ): void {
    sink.rect(x - hx, z - hz, x + hx, z + hz);
  }
}

// ── street props: lamps, hydrants, trash ──

async function buildStreetProps(
  world: DistrictWorldHost,
  dot: (x: number, z: number, r: number) => void,
): Promise<void> {
  const scene = world.sceneRef;
  const [lampGlb, hydGlb, trashGlb] = await Promise.all([
    loadProp("lamp"), loadProp("hydrant"), loadProp("trashcan"),
  ]);

  const lampSpots: [number, number][] = [
    [52, -30], [52, 30], [-52, -30], [-52, 30],
    [-30, 52], [30, 52], [-30, -52], [30, -52],
  ];
  for (const [x, z] of lampSpots) {
    if (lampGlb) {
      const l = lampGlb.clone(true);
      l.position.set(x, 0, z);
      scene.add(l);
      // find the bulb for glow + flicker registration
      l.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh && /bulb/i.test(mesh.name || "")) {
          const mats = (Array.isArray(mesh.material) ? mesh.material : [mesh.material])
            .filter((mm): mm is THREE.MeshStandardMaterial => !!(mm as THREE.MeshStandardMaterial).isMeshStandardMaterial);
          for (const mt of mats) world.addLampMat(mt);
          const wp = new THREE.Vector3();
          mesh.getWorldPosition(wp);
          addGlow(scene, wp.x, wp.y, wp.z, 0xffc873, 4.2);
        }
      });
    } else {
      // procedural lamp: pole + emissive bulb
      const pole = boxMesh(0.22, 5.2, 0.22, 0x23262e, 0.6, 0.4);
      pole.position.set(x, 2.6, z);
      const bulbMat = new THREE.MeshStandardMaterial({
        color: 0x0a0d14, emissive: 0xffc873, emissiveIntensity: 2.4, roughness: 0.6,
      });
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), bulbMat);
      bulb.position.set(x, 5.4, z);
      scene.add(pole, bulb);
      world.addLampMat(bulbMat);
      addGlow(scene, x, 5.4, z, 0xffc873, 4.2);
    }
    dot(x, z, 0.4);
  }

  const hydSpots: [number, number][] = [[-40, -30], [40, 30], [-40, 30], [40, -30]];
  for (const [x, z] of hydSpots) {
    if (hydGlb) {
      const h = hydGlb.clone(true);
      h.position.set(x, 0, z);
      scene.add(h);
    } else {
      const h = boxMesh(0.5, 0.9, 0.5, 0xb33a2e, 0.7);
      h.position.set(x, 0.45, z);
      scene.add(h);
    }
    dot(x, z, 0.4);
  }

  const trashSpots: [number, number][] = [[-20, -40], [20, -40], [-20, 54], [20, 54]];
  for (const [x, z] of trashSpots) {
    if (trashGlb) {
      const t = trashGlb.clone(true);
      t.position.set(x, 0, z);
      scene.add(t);
    } else {
      const t = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 0.3, 0.9, 10),
        new THREE.MeshStandardMaterial({ color: 0x2a2e38, roughness: 0.8 }),
      );
      t.position.set(x, 0.45, z);
      scene.add(t);
    }
    dot(x, z, 0.4);
  }
}

// ── gas pump islands (in front of Orbit Gas) ──

function buildGasPumps(
  scene: THREE.Scene,
  dot: (x: number, z: number, r: number) => void,
): void {
  // station at (-47,-20) faces +x; pumps sit between the kiosk and the collector road
  const pumps: [number, number][] = [[-40, -24], [-40, -16]];
  for (const [x, z] of pumps) {
    const body = boxMesh(0.8, 1.6, 0.6, 0xc23b4e, 0.5, 0.3);
    body.position.set(x, 0.8, z);
    const screenMat = new THREE.MeshStandardMaterial({
      color: 0x0a0d14, emissive: 0x17e6d4, emissiveIntensity: 1.6, roughness: 0.4,
    });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.35), screenMat);
    screen.position.set(x + 0.41, 1.15, z);
    screen.rotation.y = Math.PI / 2;
    scene.add(body, screen);
    addGlow(scene, x + 0.5, 1.15, z, 0x17e6d4, 2.2, 0.4);
    dot(x, z, 0.7);
  }
  // canopy slab over the pumps
  const canopy = boxMesh(9, 0.3, 10, 0x23262e, 0.7);
  canopy.position.set(-40, 4.4, -20);
  scene.add(canopy);
  for (const [px2, pz2] of [[-43.5, -24.5], [-36.5, -24.5], [-43.5, -15.5], [-36.5, -15.5]] as [number, number][]) {
    const post = boxMesh(0.25, 4.4, 0.25, 0x3a3f4c, 0.6, 0.4);
    post.position.set(px2, 2.2, pz2);
    scene.add(post);
    dot(px2, pz2, 0.3);
  }
}

// ── alley dressing: dumpsters in the gaps between strip buildings ──

function buildAlleyProps(
  scene: THREE.Scene,
  dot: (x: number, z: number, r: number) => void,
): void {
  const dumpsters: [number, number][] = [
    [-12.5, -49], [12.5, -49],       // north strip alleys
    [49, -5.5], [49, 16],            // east strip alleys
    [-12.5, 49], [12.5, 49],         // south strip alleys
    [-49, -5.5], [-49, 17.5],        // west strip alleys
  ];
  for (const [x, z] of dumpsters) {
    const d = boxMesh(1.8, 1.1, 1.0, 0x2a4a3a, 0.8, 0.2);
    d.position.set(x, 0.55, z);
    const lid = boxMesh(1.8, 0.12, 1.0, 0x1e352a, 0.8);
    lid.position.set(x, 1.16, z);
    scene.add(d, lid);
    dot(x, z, 1.1);
  }
}
