import { useMemo } from "react";
import * as THREE from "three";
import { mulberry32 } from "@/lib/orbitxcity/collision";
import { NYC_DEMO_BLOCK } from "@/lib/orbitxcity/demoBlock";
import type { WorldBlockConfig } from "@/lib/orbitxcity/types";

const TOWER_COUNT_HIGH = 96;
const TOWER_COUNT_LITE = 36;

function cityPalette(cityId: string): { base: [number, number, number]; lit: [number, number, number] } {
  if (cityId === "miami") return { base: [0.18, 0.26, 0.3], lit: [0.55, 0.75, 0.72] };
  if (cityId === "la") return { base: [0.22, 0.2, 0.24], lit: [0.75, 0.55, 0.4] };
  if (cityId === "boston") return { base: [0.2, 0.22, 0.26], lit: [0.55, 0.62, 0.72] };
  return { base: [0.2, 0.23, 0.27], lit: [0.72, 0.68, 0.55] };
}

/** Distant tower ring — denser Midtown silhouettes with warm window tint. */
export function Skyline({ block = NYC_DEMO_BLOCK, lite = false }: { block?: WorldBlockConfig; lite?: boolean }) {
  const towers = useMemo(() => {
    const count = lite ? TOWER_COUNT_LITE : TOWER_COUNT_HIGH;
    const rand = mulberry32(0x0b17c17 ^ block.cityId.length * 17);
    const palette = cityPalette(block.cityId);
    const towerGeo = new THREE.BoxGeometry(1, 1, 1);
    const towerMat = new THREE.MeshStandardMaterial({
      color: "#3a424a",
      metalness: 0.28,
      roughness: 0.72,
      emissive: "#f0d7a0",
      emissiveIntensity: lite ? 0.18 : 0.28,
    });
    const towersMesh = new THREE.InstancedMesh(towerGeo, towerMat, count);

    const m = new THREE.Matrix4();
    const color = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + rand() * 0.12;
      const ring = i % 3;
      const radius = (ring === 0 ? 68 : ring === 1 ? 88 : 108) + rand() * 18;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const w = 2.4 + rand() * (ring === 0 ? 6 : 4.5);
      const h = (ring === 0 ? 18 : ring === 1 ? 28 : 14) + rand() * (ring === 1 ? 36 : 22);
      const d = 2.4 + rand() * (ring === 0 ? 6 : 4.5);

      m.compose(new THREE.Vector3(x, h / 2, z), new THREE.Quaternion(), new THREE.Vector3(w, h, d));
      towersMesh.setMatrixAt(i, m);

      const lit = rand() > 0.45;
      if (lit) {
        color.setRGB(
          palette.base[0] + palette.lit[0] * 0.35,
          palette.base[1] + palette.lit[1] * 0.35,
          palette.base[2] + palette.lit[2] * 0.35,
        );
      } else {
        color.setRGB(
          palette.base[0] + rand() * 0.06,
          palette.base[1] + rand() * 0.06,
          palette.base[2] + rand() * 0.06,
        );
      }
      towersMesh.setColorAt(i, color);
    }
    towersMesh.instanceMatrix.needsUpdate = true;
    if (towersMesh.instanceColor) towersMesh.instanceColor.needsUpdate = true;
    towersMesh.castShadow = false;
    towersMesh.receiveShadow = false;
    towersMesh.frustumCulled = true;
    return towersMesh;
  }, [block.cityId, lite]);

  return <primitive object={towers} />;
}
