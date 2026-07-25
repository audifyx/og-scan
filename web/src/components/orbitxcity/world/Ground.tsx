import { useMemo } from "react";
import { MeshReflectorMaterial } from "@react-three/drei";
import * as THREE from "three";

/** Wet neon streets: real-time reflections + grid + lane glow. */
export function Ground() {
  const grid = useMemo(() => {
    const size = 64;
    const divisions = 32;
    const g = new THREE.GridHelper(size, divisions, "#17ff4d", "#123020");
    g.position.y = 0.02;
    const mats = Array.isArray(g.material) ? g.material : [g.material];
    mats.forEach((m) => {
      m.transparent = true;
      m.opacity = 0.28;
    });
    return g;
  }, []);

  return (
    <group>
      {/* Reflective wet asphalt */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[64, 64]} />
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
      </mesh>

      {/* Street overlays */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <planeGeometry args={[6, 56]} />
        <meshStandardMaterial color="#0e141c" metalness={0.4} roughness={0.6} transparent opacity={0.85} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.035, 0]}>
        <planeGeometry args={[56, 6]} />
        <meshStandardMaterial color="#0e141c" metalness={0.4} roughness={0.6} transparent opacity={0.85} />
      </mesh>

      {/* Lane markers */}
      {[-2, 2].map((x) => (
        <mesh key={`vx-${x}`} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.045, 0]}>
          <planeGeometry args={[0.08, 52]} />
          <meshBasicMaterial color="#17ff4d" transparent opacity={0.3} toneMapped={false} />
        </mesh>
      ))}
      {[-2, 2].map((z) => (
        <mesh key={`hz-${z}`} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, z]}>
          <planeGeometry args={[52, 0.08]} />
          <meshBasicMaterial color="#3de7ff" transparent opacity={0.25} toneMapped={false} />
        </mesh>
      ))}

      <primitive object={grid} />
    </group>
  );
}
