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

function Crosswalks({ block }: { block: WorldBlockConfig }) {
  const streets = getWorldStreets(block.cityId);
  const crossings = useMemo(() => {
    const horizontal = streets.filter((s) => s.o === "h");
    const vertical = streets.filter((s) => s.o === "v");
    return horizontal.flatMap((h) =>
      vertical
        .filter((v) => v.at >= h.from && v.at <= h.to && h.at >= v.from && h.at <= v.to)
        .map((v) => ({ x: v.at, z: h.at, hw: h.w, vw: v.w })),
    );
  }, [streets]);

  return (
    <group>
      {crossings.map((crossing, i) => (
        <group key={`${crossing.x}-${crossing.z}`}>
          {[-1, 1].flatMap((direction) =>
            [-1.2, -0.4, 0.4, 1.2].map((offset) => (
              <mesh
                key={`${direction}-${offset}`}
                rotation={[-Math.PI / 2, 0, 0]}
                position={[
                  direction * (crossing.vw / 2 - 0.5),
                  0.072 + i * 0.001,
                  crossing.z + offset,
                ]}
              >
                <planeGeometry args={[0.42, 0.48]} />
                <meshStandardMaterial color="#d8d0b8" transparent opacity={0.42} roughness={0.92} />
              </mesh>
            )),
          )}
          {[-1, 1].flatMap((direction) =>
            [-1.2, -0.4, 0.4, 1.2].map((offset) => (
              <mesh
                key={`h-${direction}-${offset}`}
                rotation={[-Math.PI / 2, 0, 0]}
                position={[
                  crossing.x + offset,
                  0.073 + i * 0.001,
                  direction * (crossing.hw / 2 - 0.5) + crossing.z,
                ]}
              >
                <planeGeometry args={[0.48, 0.42]} />
                <meshStandardMaterial color="#d8d0b8" transparent opacity={0.42} roughness={0.92} />
              </mesh>
            )),
          )}
        </group>
      ))}
    </group>
  );
}

function StreetFurniture({ block }: { block: WorldBlockConfig }) {
  return (
    <group>
      {block.zones.slice(0, 10).map((zone, i) => {
        const x = zone.position.x + (i % 2 === 0 ? 2.1 : -2.1);
        const z = zone.position.z + (i % 3 === 0 ? 1.2 : -1.2);
        if (collidesAt(x, z, 0.5, block)) return null;
        return (
          <group key={`street-furniture-${zone.id}`} position={[x, 0, z]} rotation-y={(i % 4) * (Math.PI / 2)}>
            <mesh position={[0, 0.42, 0]} castShadow receiveShadow>
              <boxGeometry args={[1.65, 0.1, 0.48]} />
              <meshStandardMaterial color="#5a5145" metalness={0.12} roughness={0.78} />
            </mesh>
            <mesh position={[0, 0.76, -0.18]} castShadow>
              <boxGeometry args={[1.65, 0.55, 0.09]} />
              <meshStandardMaterial color="#4a433a" metalness={0.1} roughness={0.8} />
            </mesh>
            {[-0.65, 0.65].map((leg) => (
              <mesh key={leg} position={[leg, 0.2, 0]} castShadow>
                <boxGeometry args={[0.08, 0.42, 0.42]} />
                <meshStandardMaterial color="#272d32" metalness={0.65} roughness={0.42} />
              </mesh>
            ))}
          </group>
        );
      })}
    </group>
  );
}

/** Street furniture: lamps, crossings, benches, and quiet zone markers. */
export function StreetProps({ block = NYC_DEMO_BLOCK }: { block?: WorldBlockConfig }) {
  return (
    <group>
      <LampField block={block} />
      <Crosswalks block={block} />
      <StreetFurniture block={block} />
      {block.zones.slice(0, 6).map((zone) => (
        <ZoneMarker key={zone.id} x={zone.position.x} z={zone.position.z} />
      ))}
    </group>
  );
}
