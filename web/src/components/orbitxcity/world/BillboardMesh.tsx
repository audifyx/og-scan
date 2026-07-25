import { useMemo } from "react";
import { Text } from "@react-three/drei";
import * as THREE from "three";
import type { BillboardDefinition } from "@/lib/orbitxcity/types";

/** Procedural neon ad board — projects can later bind token/logo textures. */
export function BillboardMesh({ board }: { board: BillboardDefinition }) {
  const { position, rotationY, width, height, title, subtitle, accent } = board;

  const frameColor = useMemo(() => new THREE.Color(accent).multiplyScalar(0.35).getStyle(), [accent]);

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

      {/* Screen */}
      <mesh position={[0, 0, 0.1]}>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial color="#05070d" metalness={0.2} roughness={0.55} emissive={accent} emissiveIntensity={0.08} />
      </mesh>

      {/* Glow rim */}
      <mesh position={[0, 0, 0.09]}>
        <planeGeometry args={[width + 0.05, height + 0.05]} />
        <meshBasicMaterial color={accent} transparent opacity={0.12} />
      </mesh>

      <Text
        position={[0, 0.35, 0.12]}
        fontSize={Math.min(0.55, width / 8)}
        color={accent}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="#000"
        maxWidth={width * 0.9}
      >
        {title}
      </Text>
      <Text
        position={[0, -0.45, 0.12]}
        fontSize={Math.min(0.28, width / 16)}
        color="#d7e7ff"
        anchorX="center"
        anchorY="middle"
        maxWidth={width * 0.85}
      >
        {subtitle}
      </Text>
    </group>
  );
}
