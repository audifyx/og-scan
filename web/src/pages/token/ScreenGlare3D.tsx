import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";

const CYCLE = 10; // seconds per loop
const SWEEP = 7; // seconds of active sweep
const Z_MIN = -1.8;
const Z_MAX = 1.8;

export function ScreenGlare() {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const phase = t % CYCLE;
    const active = phase < SWEEP;
    const z = active ? Z_MIN + (phase / SWEEP) * (Z_MAX - Z_MIN) : Z_MAX;

    if (meshRef.current) {
      meshRef.current.position.set(-5.52, 2.4, z);
    }
    if (matRef.current) {
      matRef.current.opacity = active ? 0.05 : 0;
    }
  });

  return (
    <mesh ref={meshRef} rotation={[0, Math.PI / 2, 0]} position={[-5.52, 2.4, Z_MIN]}>
      <planeGeometry args={[0.5, 1.79]} />
      <meshBasicMaterial
        ref={matRef}
        color="white"
        transparent
        opacity={0.05}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
}
