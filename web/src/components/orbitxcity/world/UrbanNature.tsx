import { useMemo } from "react";
import * as THREE from "three";
import type { WorldBlockConfig } from "@/lib/orbitxcity/types";
import { hashSeed, mulberry32 } from "@/lib/orbitxcity/collision";

type NatureTheme = {
  grass: string;
  leaf: string;
  leafAlt: string;
  trunk: string;
};

function themeFor(cityId: WorldBlockConfig["cityId"]): NatureTheme {
  switch (cityId) {
    case "miami":
      return { grass: "#496b43", leaf: "#2f6d51", leafAlt: "#4d8a62", trunk: "#513b28" };
    case "la":
      return { grass: "#617346", leaf: "#4e6b3e", leafAlt: "#789258", trunk: "#58432f" };
    case "boston":
      return { grass: "#465d3e", leaf: "#314d34", leafAlt: "#607a4e", trunk: "#3e3024" };
    default:
      return { grass: "#3e583a", leaf: "#2c4a31", leafAlt: "#4d6840", trunk: "#3d3025" };
  }
}

/** Instanced trees, shrubs, and planter beds around every city district. */
export function UrbanNature({ block, lite = false }: { block: WorldBlockConfig; lite?: boolean }) {
  const theme = themeFor(block.cityId);
  const { trunks, crowns, shrubs, planters } = useMemo(() => {
    const rand = mulberry32(hashSeed(`${block.cityId}-urban-nature`));
    const count = lite ? 18 : 48;
    const treeSpots: Array<{ x: number; z: number; scale: number }> = [];
    const { minX, maxX, minZ, maxZ } = block.bounds;
    for (let i = 0; i < count; i++) {
      const edge = i % 4;
      const inset = 4 + rand() * 8;
      const x = edge < 2 ? minX + inset + rand() * (maxX - minX - inset * 2) : edge === 2 ? minX + inset : maxX - inset;
      const z = edge < 2 ? (edge === 0 ? minZ + inset : maxZ - inset) : minZ + inset + rand() * (maxZ - minZ - inset * 2);
      treeSpots.push({ x, z, scale: 0.75 + rand() * 0.8 });
    }

    const trunkGeo = new THREE.CylinderGeometry(0.1, 0.2, 2.2, 7);
    const trunkMat = new THREE.MeshStandardMaterial({ color: theme.trunk, roughness: 0.92, metalness: 0.02 });
    const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, treeSpots.length);
    const crownGeo = new THREE.IcosahedronGeometry(1.05, 1);
    const crownMat = new THREE.MeshStandardMaterial({ color: theme.leaf, roughness: 0.94, metalness: 0, flatShading: true });
    const crownMesh = new THREE.InstancedMesh(crownGeo, crownMat, treeSpots.length * 2);
    const shrubGeo = new THREE.SphereGeometry(0.5, 8, 6);
    const shrubMat = new THREE.MeshStandardMaterial({ color: theme.leafAlt, roughness: 0.98, metalness: 0, flatShading: true });
    const shrubMesh = new THREE.InstancedMesh(shrubGeo, shrubMat, block.zones.length * 2);
    const planterGeo = new THREE.BoxGeometry(1.8, 0.42, 0.72);
    const planterMat = new THREE.MeshStandardMaterial({ color: "#5b6261", roughness: 0.78, metalness: 0.22 });
    const planterMesh = new THREE.InstancedMesh(planterGeo, planterMat, block.zones.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();

    treeSpots.forEach((spot, i) => {
      m.compose(new THREE.Vector3(spot.x, 1.1 * spot.scale, spot.z), q, new THREE.Vector3(spot.scale, spot.scale, spot.scale));
      trunkMesh.setMatrixAt(i, m);
      m.compose(new THREE.Vector3(spot.x, 2.6 * spot.scale, spot.z), q, new THREE.Vector3(spot.scale, spot.scale * 0.9, spot.scale));
      crownMesh.setMatrixAt(i * 2, m);
      m.compose(new THREE.Vector3(spot.x + 0.36, 3.35 * spot.scale, spot.z - 0.16), q, new THREE.Vector3(spot.scale * 0.68, spot.scale * 0.7, spot.scale * 0.68));
      crownMesh.setMatrixAt(i * 2 + 1, m);
    });
    block.zones.forEach((zone, i) => {
      const a = i * 1.7;
      const x = zone.position.x + Math.cos(a) * (zone.radius + 1.6);
      const z = zone.position.z + Math.sin(a) * (zone.radius + 1.6);
      m.compose(new THREE.Vector3(x, 0.23, z), q.setFromEuler(new THREE.Euler(0, a, 0)), new THREE.Vector3(1, 1, 1));
      planterMesh.setMatrixAt(i, m);
      [-0.42, 0.42].forEach((offset, part) => {
        m.compose(new THREE.Vector3(x + Math.cos(a) * offset, 0.62, z + Math.sin(a) * offset), q, new THREE.Vector3(1, 0.75, 1));
        shrubMesh.setMatrixAt(i * 2 + part, m);
      });
    });

    [trunkMesh, crownMesh, shrubMesh, planterMesh].forEach((mesh) => {
      mesh.instanceMatrix.needsUpdate = true;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    });
    return { trunks: trunkMesh, crowns: crownMesh, shrubs: shrubMesh, planters: planterMesh };
  }, [block, lite, theme.leaf, theme.leafAlt, theme.trunk]);

  return (
    <group>
      <primitive object={trunks} />
      <primitive object={crowns} />
      <primitive object={shrubs} />
      <primitive object={planters} />
    </group>
  );
}
