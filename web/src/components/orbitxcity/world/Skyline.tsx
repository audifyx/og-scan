import { useMemo } from "react";
import * as THREE from "three";
import { Text } from "@react-three/drei";
import { mulberry32 } from "@/lib/orbitxcity/collision";
import { NYC_DEMO_BLOCK } from "@/lib/orbitxcity/demoBlock";
import type { WorldBlockConfig } from "@/lib/orbitxcity/types";

const TOWER_COUNT = 56;

/** Distant tower ring — fog-softened silhouettes, no neon caps. */
export function Skyline({ block = NYC_DEMO_BLOCK }: { block?: WorldBlockConfig }) {
  const towers = useMemo(() => {
    const rand = mulberry32(0x0b17c17);
    const towerGeo = new THREE.BoxGeometry(1, 1, 1);
    const towerMat = new THREE.MeshStandardMaterial({ color: "#3a424a", metalness: 0.22, roughness: 0.78 });
    const towersMesh = new THREE.InstancedMesh(towerGeo, towerMat, TOWER_COUNT);

    const m = new THREE.Matrix4();
    const color = new THREE.Color();
    for (let i = 0; i < TOWER_COUNT; i++) {
      const angle = (i / TOWER_COUNT) * Math.PI * 2 + rand() * 0.14;
      const radius = 72 + rand() * 36;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const w = 3 + rand() * 5;
      const h = 9 + rand() * 22;
      const d = 3 + rand() * 5;

      m.compose(new THREE.Vector3(x, h / 2, z), new THREE.Quaternion(), new THREE.Vector3(w, h, d));
      towersMesh.setMatrixAt(i, m);
      color.setRGB(0.22 + rand() * 0.08, 0.25 + rand() * 0.08, 0.28 + rand() * 0.08);
      towersMesh.setColorAt(i, color);
    }
    towersMesh.instanceMatrix.needsUpdate = true;
    if (towersMesh.instanceColor) towersMesh.instanceColor.needsUpdate = true;
    towersMesh.castShadow = true;
    return towersMesh;
  }, []);

  const subtitle =
    block.cityId === "miami"
      ? "MIAMI · COASTAL COMMUNITY"
      : block.cityId === "la"
        ? "LA · CREATOR STRIP"
        : "NYC · FINANCIAL DISTRICT";

  return (
    <group>
      <primitive object={towers} />

      <Text
        position={[0, 24, -86]}
        fontSize={3.8}
        color="#eef2f4"
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.06}
        outlineWidth={0.08}
        outlineColor="#2a3238"
        fillOpacity={0.55}
      >
        ORBITX CITY
      </Text>
      <Text
        position={[0, 20.5, 88]}
        rotation-y={Math.PI}
        fontSize={2.4}
        color="#d8dee2"
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.08}
        outlineWidth={0.06}
        outlineColor="#2a3238"
        fillOpacity={0.5}
      >
        {subtitle}
      </Text>
    </group>
  );
}
