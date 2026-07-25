import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const LAMP_SPOTS: Array<[number, number]> = [
  [4.5, 4.5],
  [-4.5, 4.5],
  [4.5, -4.5],
  [-4.5, -4.5],
  [12, 4.5],
  [-12, -4.5],
  [4.5, 14],
  [-4.5, -14],
];

function StreetLamp({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 2.4, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.1, 4.8, 8]} />
        <meshStandardMaterial color="#1a2232" metalness={0.75} roughness={0.3} />
      </mesh>
      <mesh position={[0, 4.85, 0]}>
        <boxGeometry args={[0.5, 0.16, 0.24]} />
        <meshBasicMaterial color="#cfe8ff" toneMapped={false} />
      </mesh>
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

/** Neon curb strips + lamps + holo pillars — the "wet cyberpunk street" kit. */
export function StreetProps() {
  return (
    <group>
      {/* Neon curb strips along both streets */}
      {[-3.3, 3.3].map((x, i) => (
        <mesh key={`curb-v-${x}`} position={[x, 0.05, 0]}>
          <boxGeometry args={[0.12, 0.07, 52]} />
          <meshBasicMaterial color={i === 0 ? "#17ff4d" : "#3de7ff"} toneMapped={false} />
        </mesh>
      ))}
      {[-3.3, 3.3].map((z, i) => (
        <mesh key={`curb-h-${z}`} position={[0, 0.06, z]}>
          <boxGeometry args={[52, 0.07, 0.12]} />
          <meshBasicMaterial color={i === 0 ? "#ff4d9a" : "#f5c542"} toneMapped={false} />
        </mesh>
      ))}

      {LAMP_SPOTS.map(([x, z]) => (
        <StreetLamp key={`lamp-${x}-${z}`} x={x} z={z} />
      ))}

      <HoloPillar x={6.5} z={6.5} color="#3de7ff" />
      <HoloPillar x={-6.5} z={6.5} color="#17ff4d" />
      <HoloPillar x={6.5} z={-6.5} color="#f5c542" />
      <HoloPillar x={-6.5} z={-6.5} color="#ff4d9a" />
    </group>
  );
}
