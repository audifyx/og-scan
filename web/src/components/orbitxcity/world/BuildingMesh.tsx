import { useMemo } from "react";
import { Text, Billboard } from "@react-three/drei";
import type { BuildingDefinition } from "@/lib/orbitxcity/types";

export function BuildingMesh({ building }: { building: BuildingDefinition }) {
  const { position, size, color, accent, label, name } = building;
  const y = size.height / 2;

  const windowMat = useMemo(
    () => ({
      color: accent,
      emissive: accent,
      emissiveIntensity: 0.55,
      transparent: true,
      opacity: 0.85,
    }),
    [accent],
  );

  const floors = Math.max(2, Math.floor(size.height / 2.2));
  const cols = Math.max(2, Math.floor(size.width / 1.6));

  return (
    <group position={[position.x, 0, position.z]}>
      <mesh position={[0, y, 0]} castShadow receiveShadow>
        <boxGeometry args={[size.width, size.height, size.depth]} />
        <meshStandardMaterial color={color} metalness={0.45} roughness={0.4} />
      </mesh>

      {/* Accent crown */}
      <mesh position={[0, size.height + 0.15, 0]}>
        <boxGeometry args={[size.width * 0.92, 0.3, size.depth * 0.92]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.7} metalness={0.6} roughness={0.25} />
      </mesh>

      {/* Window grid (front face) */}
      {Array.from({ length: floors }).map((_, fi) =>
        Array.from({ length: cols }).map((_, ci) => {
          const wx = -size.width / 2 + 1 + ci * ((size.width - 2) / Math.max(cols - 1, 1));
          const wy = 1.2 + fi * ((size.height - 2) / Math.max(floors - 1, 1));
          return (
            <mesh key={`w-${fi}-${ci}`} position={[wx, wy, size.depth / 2 + 0.02]}>
              <planeGeometry args={[0.55, 0.7]} />
              <meshStandardMaterial {...windowMat} />
            </mesh>
          );
        }),
      )}

      {/* Door frame */}
      <mesh position={[0, 1.1, size.depth / 2 + 0.03]}>
        <boxGeometry args={[1.6, 2.2, 0.12]} />
        <meshStandardMaterial color="#05080f" metalness={0.3} roughness={0.5} />
      </mesh>
      <mesh position={[0, 1.1, size.depth / 2 + 0.1]}>
        <planeGeometry args={[1.2, 1.8]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.35} transparent opacity={0.5} />
      </mesh>

      <Billboard position={[0, size.height + 1.2, 0]}>
        <Text
          fontSize={0.55}
          color={accent}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.03}
          outlineColor="#000000"
          maxWidth={8}
        >
          {label ?? name}
        </Text>
      </Billboard>
    </group>
  );
}
