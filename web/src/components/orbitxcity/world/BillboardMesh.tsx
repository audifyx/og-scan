import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { BillboardDefinition } from "@/lib/orbitxcity/types";
import { hashSeed } from "@/lib/orbitxcity/collision";
import { createAdTexture } from "@/lib/orbitxcity/textures";

/** Neon ad board with a procedural screen texture + electrical flicker. */
export function BillboardMesh({ board }: { board: BillboardDefinition }) {
  const { position, rotationY, width, height, title, subtitle, accent } = board;

  const frameColor = useMemo(() => new THREE.Color(accent).multiplyScalar(0.35).getStyle(), [accent]);
  const screenTex = useMemo(
    () => createAdTexture(title, subtitle, accent, hashSeed(board.id)),
    [title, subtitle, accent, board.id],
  );
  const screenMat = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(() => {
    if (!screenMat.current) return;
    // Occasional CRT-style flicker
    screenMat.current.opacity = Math.random() < 0.03 ? 0.68 : 1;
  });

  return (
    <group position={[position.x, position.y, position.z]} rotation={[0, rotationY, 0]}>
      {/* Pole */}
      <mesh position={[0, -position.y / 2, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.16, position.y, 8]} />
        <meshStandardMaterial color="#1a2030" metalness={0.7} roughness={0.35} />
      </mesh>

      {/* Frame */}
      <mesh castShadow>
        <boxGeometry args={[width + 0.25, height + 0.25, 0.18]} />
        <meshStandardMaterial color={frameColor} metalness={0.55} roughness={0.3} emissive={accent} emissiveIntensity={0.15} />
      </mesh>

      {/* Procedural ad screen */}
      <mesh position={[0, 0, 0.1]}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial ref={screenMat} map={screenTex} transparent toneMapped={false} />
      </mesh>

      {/* Neon rim tubes */}
      {[
        [0, height / 2 + 0.16, width + 0.3, 0.07] as const,
        [0, -height / 2 - 0.16, width + 0.3, 0.07] as const,
      ].map(([x, ty, w, h], i) => (
        <mesh key={i} position={[x, ty, 0.06]}>
          <boxGeometry args={[w, h, 0.07]} />
          <meshBasicMaterial color={accent} toneMapped={false} />
        </mesh>
      ))}
      {[
        [-width / 2 - 0.16, 0, 0.07, height + 0.3] as const,
        [width / 2 + 0.16, 0, 0.07, height + 0.3] as const,
      ].map(([x, ty, w, h], i) => (
        <mesh key={`v-${i}`} position={[x, ty, 0.06]}>
          <boxGeometry args={[w, h, 0.07]} />
          <meshBasicMaterial color={accent} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}
