import { useMemo } from "react";
import { MeshReflectorMaterial } from "@react-three/drei";
import * as THREE from "three";
import { NYC_DEMO_BLOCK } from "@/lib/orbitxcity/demoBlock";
import { getWorldSize, getWorldStreets } from "@/lib/orbitxcity/worlds";
import type { WorldBlockConfig } from "@/lib/orbitxcity/types";
import { useCity } from "@/pages/orbitxcity/CityProvider";

/** Street network + wet asphalt, all derived from the STREETS config. */
export function Ground({ block = NYC_DEMO_BLOCK }: { block?: WorldBlockConfig }) {
  const { quality } = useCity();
  const streets = getWorldStreets(block.cityId);
  const worldSize = getWorldSize(block);

  const grid = useMemo(() => {
    const g = new THREE.GridHelper(worldSize, worldSize / 2, "#17ff4d", "#0f2418");
    g.position.y = 0.02;
    const mats = Array.isArray(g.material) ? g.material : [g.material];
    mats.forEach((m) => {
      m.transparent = true;
      m.opacity = 0.22;
    });
    return g;
  }, [worldSize]);

  return (
    <group>
      {/* Reflective wet asphalt (mirror pass costs a full scene render — skip on lite) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[worldSize, worldSize]} />
        {quality === "high" ? (
          <MeshReflectorMaterial
            blur={[280, 90]}
            resolution={512}
            mixBlur={1}
            mixStrength={1.5}
            roughness={0.8}
            depthScale={0.5}
            minDepthThreshold={0.6}
            maxDepthThreshold={1.6}
            color="#080d15"
            metalness={0.5}
            mirror={0.3}
          />
        ) : (
          <meshStandardMaterial color="#0a1019" metalness={0.5} roughness={0.75} />
        )}
      </mesh>

      {/* Streets, lane markers, and curb neon from config */}
      {streets.map((s, i) => {
        const len = s.to - s.from;
        const mid = (s.from + s.to) / 2;
        const horizontal = s.o === "h";
        const pos: [number, number, number] = horizontal ? [mid, 0.03 + i * 0.002, s.at] : [s.at, 0.03 + i * 0.002, mid];
        const planeSize: [number, number] = horizontal ? [len, s.w] : [s.w, len];
        return (
          <group key={`street-${i}`}>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={pos}>
              <planeGeometry args={planeSize} />
              <meshStandardMaterial color="#0e141c" metalness={0.4} roughness={0.6} transparent opacity={0.9} />
            </mesh>
            {/* Center lane marker */}
            <mesh
              rotation={[-Math.PI / 2, 0, 0]}
              position={horizontal ? [mid, 0.045 + i * 0.002, s.at] : [s.at, 0.045 + i * 0.002, mid]}
            >
              <planeGeometry args={horizontal ? [len - 2, 0.09] : [0.09, len - 2]} />
              <meshBasicMaterial color="#e8f1ff" transparent opacity={0.16} toneMapped={false} />
            </mesh>
            {/* Curb neon strips */}
            {[-1, 1].map((side) => {
              const off = s.at + side * (s.w / 2 + 0.25);
              return (
                <mesh
                  key={side}
                  position={horizontal ? [mid, 0.055, off] : [off, 0.055, mid]}
                >
                  <boxGeometry args={horizontal ? [len, 0.06, 0.11] : [0.11, 0.06, len]} />
                  <meshBasicMaterial color={side === -1 ? s.curbA : s.curbB} transparent opacity={0.9} toneMapped={false} />
                </mesh>
              );
            })}
          </group>
        );
      })}

      <primitive object={grid} />
    </group>
  );
}
