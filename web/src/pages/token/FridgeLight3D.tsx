import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";

/**
 * FridgeGlow - fridge light spill in the office kitchen corner.
 *
 * A cool-white point light floats just in front of the fridge doors
 * (fridge sits at approx (4.8, 0.95, 3.2) facing -x) plus a faint glow
 * pool on the floor in front of it. Both pulse very subtly.
 */
export function FridgeGlow() {
  const lightRef = useRef<THREE.PointLight>(null);
  const planeRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (lightRef.current) {
      lightRef.current.intensity = 3 + Math.sin(t * 1.5) * 0.4;
    }
    const mat = planeRef.current?.material as THREE.MeshBasicMaterial | undefined;
    if (mat) {
      mat.opacity = 0.06 + Math.sin(t * 1.5) * 0.012;
    }
  });

  return (
    <group>
      <pointLight
        ref={lightRef}
        position={[4.25, 1.1, 3.2]}
        color="#cfe8ff"
        intensity={3}
        distance={4}
      />
      <mesh ref={planeRef} position={[4.2, 0.02, 3.2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.2, 0.9]} />
        <meshBasicMaterial color="#bfe0ff" transparent opacity={0.06} depthWrite={false} />
      </mesh>
    </group>
  );
}
