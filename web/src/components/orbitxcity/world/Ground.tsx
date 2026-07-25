import { useMemo } from "react";
import * as THREE from "three";

/** Neon grid plaza + asphalt streets for the demo block. */
export function Ground() {
  const grid = useMemo(() => {
    const size = 64;
    const divisions = 32;
    const g = new THREE.GridHelper(size, divisions, "#17ff4d", "#14301f");
    g.position.y = 0.01;
    const mats = Array.isArray(g.material) ? g.material : [g.material];
    mats.forEach((m) => {
      m.transparent = true;
      m.opacity = 0.35;
    });
    return g;
  }, []);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[64, 64]} />
        <meshStandardMaterial color="#070b12" metalness={0.2} roughness={0.85} />
      </mesh>

      {/* Cross streets */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow>
        <planeGeometry args={[6, 56]} />
        <meshStandardMaterial color="#101820" metalness={0.35} roughness={0.7} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 0]} receiveShadow>
        <planeGeometry args={[56, 6]} />
        <meshStandardMaterial color="#101820" metalness={0.35} roughness={0.7} />
      </mesh>

      {/* Lane markers */}
      {[-2, 2].map((x) => (
        <mesh key={`vx-${x}`} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.03, 0]}>
          <planeGeometry args={[0.08, 52]} />
          <meshBasicMaterial color="#17ff4d" transparent opacity={0.25} />
        </mesh>
      ))}
      {[-2, 2].map((z) => (
        <mesh key={`hz-${z}`} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.035, z]}>
          <planeGeometry args={[52, 0.08]} />
          <meshBasicMaterial color="#3de7ff" transparent opacity={0.2} />
        </mesh>
      ))}

      <primitive object={grid} />
    </group>
  );
}
