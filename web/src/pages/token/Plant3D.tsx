import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";

const LEAF_COLORS = ["#16a34a", "#22c55e", "#16a34a", "#22c55e", "#16a34a", "#22c55e", "#15803d"] as const;

/** Deterministic per-leaf transform so the plant looks the same on every render. */
interface LeafTransform {
  color: (typeof LEAF_COLORS)[number];
  position: [number, number, number];
  rotation: [number, number, number];
}

const LEAVES: LeafTransform[] = [
  { color: LEAF_COLORS[0], position: [0, 0.62, 0], rotation: [0.12, 0, -0.1] },
  { color: LEAF_COLORS[1], position: [0.14, 0.56, 0.06], rotation: [0.32, 0, -0.42] },
  { color: LEAF_COLORS[2], position: [-0.13, 0.58, 0.08], rotation: [-0.28, 0, 0.38] },
  { color: LEAF_COLORS[3], position: [0.06, 0.6, -0.14], rotation: [0.44, 0.7, -0.18] },
  { color: LEAF_COLORS[4], position: [-0.07, 0.62, -0.13], rotation: [-0.4, -0.6, 0.22] },
  { color: LEAF_COLORS[5], position: [0.11, 0.52, -0.05], rotation: [0.2, 1.4, -0.5] },
  { color: LEAF_COLORS[6], position: [-0.11, 0.54, -0.02], rotation: [-0.18, -1.3, 0.48] },
];

export function OfficePlant() {
  const foliageRef = useRef<Group>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (foliageRef.current) {
      foliageRef.current.rotation.z = Math.sin(t * 1.1) * 0.03;
      foliageRef.current.rotation.x = Math.sin(t * 0.8 + 1.3) * 0.02;
    }
  });

  return (
    <group position={[-1.5, 0, -3.4]}>
      {/* Terracotta pot */}
      <mesh position={[0, 0.15, 0]}>
        <cylinderGeometry args={[0.22, 0.17, 0.3, 24]} />
        <meshStandardMaterial color="#b45309" roughness={0.9} />
      </mesh>
      {/* Pot rim */}
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.24, 0.24, 0.05, 24]} />
        <meshStandardMaterial color="#a34a08" roughness={0.9} />
      </mesh>
      {/* Soil */}
      <mesh position={[0, 0.29, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.19, 24]} />
        <meshStandardMaterial color="#3f2d1e" roughness={1} />
      </mesh>
      {/* Foliage (sways gently) */}
      <group ref={foliageRef}>
        {LEAVES.map((leaf, i) => (
          <mesh key={i} position={leaf.position} rotation={leaf.rotation} scale={[1.4, 1, 0.55]}>
            <coneGeometry args={[0.06, 0.7, 8]} />
            <meshStandardMaterial color={leaf.color} roughness={0.7} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
