import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export function FloorLamp() {
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const light = lightRef.current;
    if (light) {
      light.intensity = 6 + Math.sin(t * 7) * 0.15 + Math.sin(t * 13.7) * 0.1;
    }
  });

  return (
    <group position={[-4.4, 0, 2.6]}>
      {/* Base: flat cylinder, dark metal */}
      <mesh position={[0, 0.025, 0]}>
        <cylinderGeometry args={[0.2, 0.2, 0.05, 24]} />
        <meshStandardMaterial color="#2a2a2e" metalness={0.8} roughness={0.35} />
      </mesh>

      {/* Pole: thin cylinder, dark metal, centered at y=0.85 */}
      <mesh position={[0, 0.85, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 1.6, 12]} />
        <meshStandardMaterial color="#2a2a2e" metalness={0.8} roughness={0.35} />
      </mesh>

      {/* Shade: open-ended cone, warm cream, centered at y=1.75 */}
      <mesh position={[0, 1.75, 0]}>
        <cylinderGeometry args={[0.18, 0.28, 0.35, 24, 1, true]} />
        <meshStandardMaterial
          color="#f5e6c8"
          emissive="#ffbe78"
          emissiveIntensity={0.35}
          side={THREE.DoubleSide}
          roughness={0.9}
        />
      </mesh>

      {/* Bulb glow: small sphere with strong warm emissive */}
      <mesh position={[0, 1.7, 0]}>
        <sphereGeometry args={[0.06, 16, 16]} />
        <meshStandardMaterial
          color="#ffd9a0"
          emissive="#ffd9a0"
          emissiveIntensity={3}
        />
      </mesh>

      {/* Warm point light with subtle flicker */}
      <pointLight
        ref={lightRef}
        position={[0, 1.7, 0]}
        color="#ffbe78"
        intensity={6}
        distance={6}
      />
    </group>
  );
}
