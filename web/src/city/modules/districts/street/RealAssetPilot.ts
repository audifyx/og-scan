/**
 * REAL ASSET PILOT — parked cars + GLB street furniture (Kenney CC0).
 *
 * Pilot area: the coffee district (Moonbeam Coffee facade at [-156, 0, -68],
 * street along z ≈ -46) plus one police cruiser by the station.
 *
 * Integrator adds `buildRealAssetPilot()` to the outdoor world group
 * (wired in `buildAllExteriors`). All placements use `mountAsset`, so the
 * group is valid immediately and GLBs pop in as they load.
 */
import * as THREE from "three";
import { mountAsset } from "@/city/modules/assets/loadAsset";

interface Placement {
  key: string;
  x: number;
  z: number;
  ry?: number;
  scale?: number;
  y?: number;
}

/* Parked cars along the coffee-district street. Sedan is 2.5 long natively;
 * scale 4 -> ~10 long, ~6 wide. Alternating facing for a lived-in curb. */
const PARKED_CARS: Placement[] = [
  { key: "vehicles/sedan", x: -184, z: -46, ry: 0, scale: 4 },
  { key: "vehicles/suv", x: -171, z: -46, ry: 0, scale: 4 },
  { key: "vehicles/taxi", x: -141, z: -46, ry: Math.PI, scale: 4 },
  { key: "vehicles/van", x: -128, z: -46, ry: Math.PI, scale: 4 },
  { key: "vehicles/sedan", x: -115, z: -46, ry: 0, scale: 4 },
];

/* One cruiser outside the police station (facade [-40, 0, -150]). */
const POLICE_CRUISER: Placement = { key: "vehicles/police", x: -24, z: -136, ry: Math.PI / 2, scale: 4 };

/* Street lamps (native 0.7 tall -> scale 10 = 7 units) along the sidewalk. */
const LAMPS: Placement[] = [
  { key: "props/street/lamp-curved", x: -192, z: -58, scale: 10 },
  { key: "props/street/lamp-curved", x: -164, z: -58, ry: Math.PI, scale: 10 },
  { key: "props/street/lamp-curved", x: -136, z: -58, scale: 10 },
  { key: "props/street/lamp-curved", x: -108, z: -58, ry: Math.PI, scale: 10 },
];

/* Trees + planters softening the block. */
const NATURE: Placement[] = [
  { key: "props/nature/tree-large", x: -188, z: -63, scale: 8 },
  { key: "props/nature/tree-small", x: -172, z: -63, scale: 8 },
  { key: "props/nature/tree-large", x: -148, z: -63, scale: 8 },
  { key: "props/nature/tree-small", x: -132, z: -63, scale: 8 },
  { key: "props/nature/tree-large", x: -112, z: -63, scale: 8 },
  { key: "props/nature/planter", x: -166, z: -57, scale: 6 },
  { key: "props/nature/planter", x: -146, z: -57, scale: 6 },
];

/** Build the pilot group. Safe to call before assets finish loading. */
export function buildRealAssetPilot(): THREE.Group {
  const g = new THREE.Group();
  const all: Placement[] = [...PARKED_CARS, POLICE_CRUISER, ...LAMPS, ...NATURE];
  for (const p of all) {
    const holder = new THREE.Group();
    holder.position.set(p.x, p.y ?? 0, p.z);
    mountAsset(holder, p.key, { rotationY: p.ry ?? 0, scale: p.scale ?? 1 });
    g.add(holder);
  }
  return g;
}
