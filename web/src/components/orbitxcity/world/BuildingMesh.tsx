import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Text, Billboard } from "@react-three/drei";
import * as THREE from "three";
import type { BuildingDefinition } from "@/lib/orbitxcity/types";
import { hashSeed, mulberry32 } from "@/lib/orbitxcity/collision";

function BlinkingBeacon({ height, accent }: { height: number; accent: string }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const mat = ref.current.material as THREE.MeshBasicMaterial;
    mat.opacity = 0.35 + Math.abs(Math.sin(clock.elapsedTime * 2.6)) * 0.65;
  });
  return (
    <group position={[0, height, 0]}>
      <mesh position={[0, 0.7, 0]}>
        <cylinderGeometry args={[0.03, 0.05, 1.4, 6]} />
        <meshStandardMaterial color="#1a2232" metalness={0.7} roughness={0.35} />
      </mesh>
      <mesh ref={ref} position={[0, 1.5, 0]}>
        <sphereGeometry args={[0.12, 10, 10]} />
        <meshBasicMaterial color={accent} transparent toneMapped={false} />
      </mesh>
    </group>
  );
}

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

  // Deterministic lit/dark window pattern
  const litMask = useMemo(() => {
    const rand = mulberry32(hashSeed(`win-${building.id}`));
    return Array.from({ length: floors * cols }, () => rand() > 0.28);
  }, [building.id, floors, cols]);

  return (
    <group position={[position.x, 0, position.z]}>
      <mesh position={[0, y, 0]} castShadow receiveShadow>
        <boxGeometry args={[size.width, size.height, size.depth]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.85} metalness={0.4} roughness={0.45} />
      </mesh>

      {/* Accent crown */}
      <mesh position={[0, size.height + 0.15, 0]}>
        <boxGeometry args={[size.width * 0.92, 0.3, size.depth * 0.92]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.7} metalness={0.6} roughness={0.25} />
      </mesh>

      {/* Vertical neon corner tubes */}
      {[
        [-size.width / 2, -size.depth / 2],
        [size.width / 2, -size.depth / 2],
        [-size.width / 2, size.depth / 2],
        [size.width / 2, size.depth / 2],
      ].map(([cx, cz], i) => (
        <mesh key={`tube-${i}`} position={[cx, y, cz]}>
          <boxGeometry args={[0.09, size.height, 0.09]} />
          <meshBasicMaterial color={accent} transparent opacity={0.85} toneMapped={false} />
        </mesh>
      ))}

      {/* Window grid (front face) with lit/dark variance */}
      {Array.from({ length: floors }).map((_, fi) =>
        Array.from({ length: cols }).map((_, ci) => {
          const wx = -size.width / 2 + 1 + ci * ((size.width - 2) / Math.max(cols - 1, 1));
          const wy = 1.2 + fi * ((size.height - 2) / Math.max(floors - 1, 1));
          const lit = litMask[fi * cols + ci];
          return (
            <mesh key={`w-${fi}-${ci}`} position={[wx, wy, size.depth / 2 + 0.02]}>
              <planeGeometry args={[0.55, 0.7]} />
              {lit ? (
                <meshStandardMaterial {...windowMat} />
              ) : (
                <meshStandardMaterial color="#05070d" metalness={0.6} roughness={0.35} />
              )}
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

      {/* Rooftop beacon on tall structures */}
      {size.height >= 8 && <BlinkingBeacon height={size.height} accent={accent} />}

      <Billboard position={[0, size.height + 1.2, 0]}>
        <Text
          fontSize={0.55}
          color={accent}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.03}
          outlineColor="#000000"
          maxWidth={8}
          material-toneMapped={false}
        >
          {label ?? name}
        </Text>
      </Billboard>
    </group>
  );
}
