import { useMemo } from "react";
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

    const headGeo = new THREE.BoxGeometry(0.55, 0.14, 0.28);
    const headMat = new THREE.MeshStandardMaterial({
      color: "#d8d2c0",
      emissive: "#c4b896",
      emissiveIntensity: 0.45,
      metalness: 0.35,
      roughness: 0.4,
    });
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

function ZoneMarker({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.1, 0]} receiveShadow>
        <cylinderGeometry args={[0.85, 0.95, 0.18, 24]} />
        <meshStandardMaterial color="#5a6168" metalness={0.2} roughness={0.75} />
      </mesh>
      <mesh position={[0, 1.4, 0]}>
        <cylinderGeometry args={[0.06, 0.08, 2.6, 8]} />
        <meshStandardMaterial color="#3a4046" metalness={0.55} roughness={0.4} />
      </mesh>
      <mesh position={[0, 2.85, 0]}>
        <sphereGeometry args={[0.16, 12, 12]} />
        <meshStandardMaterial color="#e8e2d2" emissive="#cfc6b0" emissiveIntensity={0.35} metalness={0.15} roughness={0.35} />
      </mesh>
    </group>
  );
}

/** Street furniture: instanced lamps + quiet zone markers. */
export function StreetProps({ block = NYC_DEMO_BLOCK }: { block?: WorldBlockConfig }) {
  return (
    <group>
      <LampField block={block} />
      {block.zones.slice(0, 6).map((zone) => (
        <ZoneMarker key={zone.id} x={zone.position.x} z={zone.position.z} />
      ))}
    </group>
  );
}
