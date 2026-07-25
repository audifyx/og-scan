import { useMemo } from "react";
import * as THREE from "three";
import { Text } from "@react-three/drei";
import { mulberry32 } from "@/lib/orbitxcity/collision";

const TOWER_COUNT = 44;
const ACCENTS = ["#17ff4d", "#3de7ff", "#ff4d9a", "#f5c542", "#a78bfa"];

/** Distant instanced tower ring — silhouettes the block like a real metropolis. */
export function Skyline() {
  const { towers, caps } = useMemo(() => {
    const rand = mulberry32(0x0b17c17);
    const towerGeo = new THREE.BoxGeometry(1, 1, 1);
    const towerMat = new THREE.MeshStandardMaterial({ color: "#0a1220", metalness: 0.5, roughness: 0.6 });
    const towersMesh = new THREE.InstancedMesh(towerGeo, towerMat, TOWER_COUNT);

    const capGeo = new THREE.BoxGeometry(1, 1, 1);
    const capMat = new THREE.MeshBasicMaterial({ toneMapped: false });
    const capsMesh = new THREE.InstancedMesh(capGeo, capMat, TOWER_COUNT);

    const m = new THREE.Matrix4();
    const color = new THREE.Color();
    for (let i = 0; i < TOWER_COUNT; i++) {
      const angle = (i / TOWER_COUNT) * Math.PI * 2 + rand() * 0.14;
      const radius = 42 + rand() * 30;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const w = 3 + rand() * 5;
      const h = 9 + rand() * 22;
      const d = 3 + rand() * 5;

      m.compose(new THREE.Vector3(x, h / 2, z), new THREE.Quaternion(), new THREE.Vector3(w, h, d));
      towersMesh.setMatrixAt(i, m);

      m.compose(new THREE.Vector3(x, h + 0.25, z), new THREE.Quaternion(), new THREE.Vector3(w * 0.86, 0.5, d * 0.86));
      capsMesh.setMatrixAt(i, m);
      color.set(ACCENTS[Math.floor(rand() * ACCENTS.length)]).multiplyScalar(0.9);
      capsMesh.setColorAt(i, color);
    }
    towersMesh.instanceMatrix.needsUpdate = true;
    capsMesh.instanceMatrix.needsUpdate = true;
    if (capsMesh.instanceColor) capsMesh.instanceColor.needsUpdate = true;
    return { towers: towersMesh, caps: capsMesh };
  }, []);

  return (
    <group>
      <primitive object={towers} />
      <primitive object={caps} />

      {/* Skyline hero signs — bloom picks these up */}
      <Text
        position={[0, 24, -54]}
        fontSize={5.2}
        color="#17ff4d"
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.08}
        material-toneMapped={false}
        outlineWidth={0.12}
        outlineColor="#04140a"
      >
        ORBITX CITY
      </Text>
      <Text
        position={[0, 20, 56]}
        rotation-y={Math.PI}
        fontSize={4}
        color="#3de7ff"
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.1}
        material-toneMapped={false}
        outlineWidth={0.1}
        outlineColor="#03131a"
      >
        NYC · FINANCIAL DISTRICT
      </Text>
    </group>
  );
}
