/**
 * CITY LIFE — parked cars + street furniture across every district (Kenney CC0).
 *
 * Extends the coffee-district pilot to the whole city: varied parked cars
 * (sedan, SUV, taxi, van, truck), lamps, trees, planters, cones, barriers,
 * dumpsters, and procedural crosswalks. All placements use `mountAsset`,
 * so the group is valid immediately and GLBs pop in as they load.
 *
 * Integrator adds `buildCityLife()` to the outdoor world group
 * (wired in `buildAllExteriors`). Placements stay clear of door triggers
 * (radius 4) and facade footprints.
 */
import * as THREE from "three";
import { mountAsset } from "@/city/modules/assets/loadAsset";

interface Placement {
  key: string;
  x: number;
  z: number;
  ry?: number;
  scale?: number;
}

/* Parked cars — scale 4 => ~10 long, ~6 wide. Alternating facing per curb. */
const CARS: Placement[] = [
  // bank district (facade [120, -60], street toward center)
  { key: "vehicles/taxi", x: 96, z: -38, ry: 0, scale: 4 },
  { key: "vehicles/sedan", x: 108, z: -38, ry: 0, scale: 4 },
  { key: "vehicles/suv", x: 122, z: -38, ry: Math.PI, scale: 4 },
  // mall district (facade [150, -20])
  { key: "vehicles/van", x: 150, z: 8, ry: Math.PI / 2, scale: 4 },
  { key: "vehicles/truck", x: 150, z: 22, ry: Math.PI / 2, scale: 4 },
  { key: "vehicles/sedan", x: 128, z: 2, ry: 0, scale: 4 },
  // cinema district (facade [40, 150])
  { key: "vehicles/sedan", x: 16, z: 128, ry: Math.PI / 2, scale: 4 },
  { key: "vehicles/taxi", x: 16, z: 142, ry: Math.PI / 2, scale: 4 },
  { key: "vehicles/suv", x: 64, z: 128, ry: -Math.PI / 2, scale: 4 },
  // gym district (facade [-78, 156])
  { key: "vehicles/van", x: -54, z: 134, ry: Math.PI / 2, scale: 4 },
  { key: "vehicles/sedan", x: -102, z: 134, ry: -Math.PI / 2, scale: 4 },
  // hotel district (facade [-120, 60])
  { key: "vehicles/taxi", x: -98, z: 38, ry: 0, scale: 4 },
  { key: "vehicles/sedan", x: -112, z: 38, ry: 0, scale: 4 },
  { key: "vehicles/suv", x: -142, z: 38, ry: Math.PI, scale: 4 },
  // pharmacy district (facade [78, -156])
  { key: "vehicles/sedan", x: 56, z: -134, ry: Math.PI / 2, scale: 4 },
  { key: "vehicles/van", x: 100, z: -134, ry: -Math.PI / 2, scale: 4 },
  // police district (facade [-40, -150]) — extra cruisers
  { key: "vehicles/police", x: -56, z: -136, ry: -Math.PI / 2, scale: 4 },
  { key: "vehicles/police", x: -8, z: -136, ry: Math.PI / 2, scale: 4 },
  // barber district (facade [156, 78])
  { key: "vehicles/sedan", x: 134, z: 56, ry: 0, scale: 4 },
  { key: "vehicles/truck", x: 134, z: 100, ry: Math.PI, scale: 4 },
];

/* Street lamps along the sidewalks (native 0.7 tall -> scale 10 = 7 units). */
const LAMPS: Placement[] = [
  { key: "props/street/lamp-curved", x: 92, z: -48, scale: 10 },
  { key: "props/street/lamp-curved", x: 116, z: -48, ry: Math.PI, scale: 10 },
  { key: "props/street/lamp-curved", x: 140, z: -48, scale: 10 },
  { key: "props/street/lamp-square", x: 150, z: -2, ry: Math.PI / 2, scale: 10 },
  { key: "props/street/lamp-square", x: 150, z: 30, ry: -Math.PI / 2, scale: 10 },
  { key: "props/street/lamp-curved", x: 28, z: 138, ry: Math.PI / 2, scale: 10 },
  { key: "props/street/lamp-curved", x: 52, z: 138, ry: -Math.PI / 2, scale: 10 },
  { key: "props/street/lamp-curved", x: -66, z: 144, ry: Math.PI / 2, scale: 10 },
  { key: "props/street/lamp-curved", x: -90, z: 144, ry: -Math.PI / 2, scale: 10 },
  { key: "props/street/lamp-curved", x: -108, z: 48, scale: 10 },
  { key: "props/street/lamp-curved", x: -132, z: 48, ry: Math.PI, scale: 10 },
  { key: "props/street/lamp-square", x: 66, z: -144, ry: Math.PI / 2, scale: 10 },
  { key: "props/street/lamp-square", x: 90, z: -144, ry: -Math.PI / 2, scale: 10 },
  { key: "props/street/lamp-curved", x: -28, z: -140, scale: 10 },
  { key: "props/street/lamp-curved", x: -52, z: -140, ry: Math.PI, scale: 10 },
  { key: "props/street/lamp-curved", x: 144, z: 66, ry: Math.PI / 2, scale: 10 },
  { key: "props/street/lamp-curved", x: 144, z: 90, ry: -Math.PI / 2, scale: 10 },
];

/* Trees + planters softening every block. */
const NATURE: Placement[] = [
  { key: "props/nature/tree-large", x: 88, z: -52, scale: 8 },
  { key: "props/nature/tree-small", x: 104, z: -52, scale: 8 },
  { key: "props/nature/tree-large", x: 136, z: -52, scale: 8 },
  { key: "props/nature/tree-small", x: 146, z: 14, scale: 8 },
  { key: "props/nature/tree-large", x: 154, z: 40, scale: 8 },
  { key: "props/nature/planter", x: 150, z: -8, scale: 6 },
  { key: "props/nature/tree-large", x: 24, z: 134, scale: 8 },
  { key: "props/nature/tree-small", x: 56, z: 134, scale: 8 },
  { key: "props/nature/planter", x: 40, z: 134, scale: 6 },
  { key: "props/nature/tree-large", x: -62, z: 140, scale: 8 },
  { key: "props/nature/tree-small", x: -94, z: 140, scale: 8 },
  { key: "props/nature/tree-large", x: -104, z: 44, scale: 8 },
  { key: "props/nature/tree-small", x: -136, z: 44, scale: 8 },
  { key: "props/nature/planter", x: -120, z: 44, scale: 6 },
  { key: "props/nature/tree-large", x: 62, z: -140, scale: 8 },
  { key: "props/nature/tree-small", x: 94, z: -140, scale: 8 },
  { key: "props/nature/tree-large", x: -24, z: -136, scale: 8 },
  { key: "props/nature/tree-small", x: -60, z: -144, scale: 8 },
  { key: "props/nature/tree-large", x: 140, z: 62, scale: 8 },
  { key: "props/nature/tree-small", x: 140, z: 94, scale: 8 },
];

/* Work-zone + service props: cones, barriers, dumpsters. */
const SERVICE: Placement[] = [
  { key: "props/street/cone", x: 130, z: 12, scale: 6 },
  { key: "props/street/cone", x: 134, z: 16, scale: 6 },
  { key: "props/street/cone", x: 130, z: 20, scale: 6 },
  { key: "props/street/barrier", x: 126, z: 26, ry: 0.4, scale: 6 },
  { key: "props/street/dumpster", x: 168, z: -34, ry: -0.3, scale: 6 },
  { key: "props/street/dumpster", x: -138, z: 72, ry: 0.5, scale: 6 },
  { key: "props/street/cone", x: -48, z: -128, scale: 6 },
  { key: "props/street/cone", x: -44, z: -128, scale: 6 },
  { key: "props/street/barrier", x: -32, z: -128, ry: -0.3, scale: 6 },
];

/** Procedural crosswalk stripes across a street. */
function crosswalk(x: number, z: number, ry: number, lanes = 5): THREE.Group {
  const cw = new THREE.Group();
  const stripeMat = new THREE.MeshStandardMaterial({ color: 0xf2f4f6, roughness: 0.9 });
  for (let i = 0; i < lanes; i++) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 8), stripeMat);
    s.rotation.x = -Math.PI / 2;
    s.position.set((i - (lanes - 1) / 2) * 2.2, 0.05, 0);
    s.receiveShadow = true;
    cw.add(s);
  }
  cw.position.set(x, 0, z);
  cw.rotation.y = ry;
  return cw;
}

/** Build the city-life group. Safe to call before assets finish loading. */
export function buildCityLife(): THREE.Group {
  const g = new THREE.Group();
  for (const p of [...CARS, ...LAMPS, ...NATURE, ...SERVICE]) {
    const holder = new THREE.Group();
    holder.position.set(p.x, 0, p.z);
    mountAsset(holder, p.key, { rotationY: p.ry ?? 0, scale: p.scale ?? 1 });
    g.add(holder);
  }
  // Crosswalks near the busiest fronts.
  g.add(crosswalk(120, -34, 0)); // bank
  g.add(crosswalk(150, 14, Math.PI / 2)); // mall
  g.add(crosswalk(40, 134, 0)); // cinema
  g.add(crosswalk(-78, 140, 0)); // gym
  g.add(crosswalk(-120, 44, 0)); // hotel
  return g;
}
