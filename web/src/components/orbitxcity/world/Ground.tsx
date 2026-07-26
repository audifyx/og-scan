import { useMemo } from "react";
import { MeshReflectorMaterial } from "@react-three/drei";
import { NYC_DEMO_BLOCK } from "@/lib/orbitxcity/demoBlock";
import { getWorldSize, getWorldStreets } from "@/lib/orbitxcity/worlds";
import type { WorldBlockConfig } from "@/lib/orbitxcity/types";
import { useCity } from "@/pages/orbitxcity/CityProvider";
import { mulberry32 } from "@/lib/orbitxcity/collision";

/** Street network + weathered asphalt + soft grass shoulders. */
export function Ground({ block = NYC_DEMO_BLOCK }: { block?: WorldBlockConfig }) {
  const { quality } = useCity();
  const streets = getWorldStreets(block.cityId);
  const worldSize = getWorldSize(block);

  const grassPatches = useMemo(() => {
    const rand = mulberry32(0x61a55);
    const patches: Array<{ x: number; z: number; r: number; rot: number }> = [];
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2 + rand() * 0.2;
      const dist = worldSize * 0.28 + rand() * worldSize * 0.12;
      patches.push({
        x: Math.cos(a) * dist,
        z: Math.sin(a) * dist,
        r: 4 + rand() * 7,
        rot: rand() * Math.PI,
      });
    }
    return patches;
  }, [worldSize]);

  return (
    <group>
      {/* Base ground — muted earth / concrete tone */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[worldSize * 1.15, worldSize * 1.15]} />
        <meshStandardMaterial color="#4a5346" roughness={0.95} metalness={0.02} />
      </mesh>

      {/* City pad asphalt */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[worldSize, worldSize]} />
        {quality === "high" ? (
          <MeshReflectorMaterial
            blur={[320, 120]}
            resolution={512}
            mixBlur={1}
            mixStrength={0.55}
            roughness={0.92}
            depthScale={0.35}
            minDepthThreshold={0.6}
            maxDepthThreshold={1.6}
            color="#2a2e32"
            metalness={0.18}
            mirror={0.08}
          />
        ) : (
          <meshStandardMaterial color="#2c3034" metalness={0.12} roughness={0.9} />
        )}
      </mesh>

      {/* Soft grass clearings at the rim — reads like the reference hills */}
      {grassPatches.map((p, i) => (
        <mesh
          key={`grass-${i}`}
          rotation={[-Math.PI / 2, 0, p.rot]}
          position={[p.x, 0.03, p.z]}
          receiveShadow
        >
          <circleGeometry args={[p.r, 24]} />
          <meshStandardMaterial color={i % 2 === 0 ? "#3d5c3a" : "#456846"} roughness={0.98} metalness={0} />
        </mesh>
      ))}

      {streets.map((s, i) => {
        const len = s.to - s.from;
        const mid = (s.from + s.to) / 2;
        const horizontal = s.o === "h";
        const pos: [number, number, number] = horizontal ? [mid, 0.03 + i * 0.002, s.at] : [s.at, 0.03 + i * 0.002, mid];
        const planeSize: [number, number] = horizontal ? [len, s.w] : [s.w, len];
        return (
          <group key={`street-${i}`}>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={pos} receiveShadow>
              <planeGeometry args={planeSize} />
              <meshStandardMaterial color="#1e2226" metalness={0.15} roughness={0.88} />
            </mesh>
            <mesh
              rotation={[-Math.PI / 2, 0, 0]}
              position={horizontal ? [mid, 0.045 + i * 0.002, s.at] : [s.at, 0.045 + i * 0.002, mid]}
            >
              <planeGeometry args={horizontal ? [len - 2, 0.08] : [0.08, len - 2]} />
              <meshStandardMaterial color="#c9c3a8" transparent opacity={0.35} roughness={0.8} />
            </mesh>
            {/* Weathered stone curbs — no neon tubes */}
            {[-1, 1].map((side) => {
              const off = s.at + side * (s.w / 2 + 0.22);
              return (
                <mesh
                  key={side}
                  position={horizontal ? [mid, 0.05, off] : [off, 0.05, mid]}
                  castShadow
                  receiveShadow
                >
                  <boxGeometry args={horizontal ? [len, 0.1, 0.28] : [0.28, 0.1, len]} />
                  <meshStandardMaterial color="#6a7178" metalness={0.08} roughness={0.86} />
                </mesh>
              );
            })}
          </group>
        );
      })}
    </group>
  );
}
