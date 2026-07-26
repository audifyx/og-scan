import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { NYC_DEMO_BLOCK } from "@/lib/orbitxcity/demoBlock";
import { collidesAt } from "@/lib/orbitxcity/collision";
import type { WorldBlockConfig } from "@/lib/orbitxcity/types";
import { getWorldStreets } from "@/lib/orbitxcity/worlds";

const LAMP_SPACING = 16;

/** Instanced street lamps generated along every street segment. */
function LampField({ block }: { block: WorldBlockConfig }) {
  const streets = getWorldStreets(block.cityId);
  const { poles, heads } = useMemo(() => {
    const spots: Array<[number, number]> = [];
    for (const s of streets) {
      const off = s.w / 2 + 1;
      for (let t = s.from + 6; t <= s.to - 4; t += LAMP_SPACING) {
        const a: [number, number] = s.o === "h" ? [t, s.at + off] : [s.at + off, t];
        const b: [number, number] = s.o === "h" ? [t + LAMP_SPACING / 2, s.at - off] : [s.at - off, t + LAMP_SPACING / 2];
        for (const p of [a, b]) {
          if (!collidesAt(p[0], p[1], 0.4, block)) spots.push(p);
        }
      }
    }

    const poleGeo = new THREE.CylinderGeometry(0.07, 0.1, 4.8, 8);
    const poleMat = new THREE.MeshStandardMaterial({ color: "#1a2232", metalness: 0.75, roughness: 0.3 });
    const polesMesh = new THREE.InstancedMesh(poleGeo, poleMat, spots.length);

    const headGeo = new THREE.BoxGeometry(0.5, 0.16, 0.24);
    const headMat = new THREE.MeshBasicMaterial({ color: "#cfe8ff", toneMapped: false });
    const headsMesh = new THREE.InstancedMesh(headGeo, headMat, spots.length);

    const m = new THREE.Matrix4();
    spots.forEach(([x, z], i) => {
      m.setPosition(x, 2.4, z);
      polesMesh.setMatrixAt(i, m);
      m.setPosition(x, 4.85, z);
      headsMesh.setMatrixAt(i, m);
    });
    polesMesh.instanceMatrix.needsUpdate = true;
    headsMesh.instanceMatrix.needsUpdate = true;
    return { poles: polesMesh, heads: headsMesh };
  }, [block, streets]);

  return (
    <group>
      <primitive object={poles} />
      <primitive object={heads} />
    </group>
  );
}

function HoloPillar({ x, z, color }: { x: number; z: number; color: string }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.rotation.y = clock.elapsedTime * 0.6;
    const mat = ref.current.material as THREE.MeshBasicMaterial;
    mat.opacity = 0.12 + Math.sin(clock.elapsedTime * 2.2) * 0.05;
  });
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.12, 0]}>
        <cylinderGeometry args={[0.7, 0.8, 0.24, 24]} />
        <meshStandardMaterial color="#0c1220" metalness={0.6} roughness={0.35} />
      </mesh>
      <mesh ref={ref} position={[0, 1.9, 0]}>
        <cylinderGeometry args={[0.5, 0.5, 3.4, 6, 1, true]} />
        <meshBasicMaterial color={color} transparent opacity={0.15} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** Street furniture: instanced lamps + plaza holo pillars. */
export function StreetProps({ block = NYC_DEMO_BLOCK }: { block?: WorldBlockConfig }) {
  return (
    <group>
      <LampField block={block} />
      {block.zones.slice(0, 6).map((zone, index) => {
        const building = zone.buildingId ? block.buildings.find((b) => b.id === zone.buildingId) : undefined;
        return (
          <HoloPillar
            key={zone.id}
            x={zone.position.x}
            z={zone.position.z}
            color={building?.accent ?? ["#3de7ff", "#17ff4d", "#f5c542", "#ff4d9a", "#a78bfa", "#7fffd4"][index % 6]}
          />
        );
      })}
    </group>
  );
}
