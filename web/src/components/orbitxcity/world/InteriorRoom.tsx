import { Text } from "@react-three/drei";
import type { BuildingDefinition } from "@/lib/orbitxcity/types";

/**
 * Walk-in interior — floor, walls, ceiling, accent light, exit pad.
 * Outdoor building shell stays; collision for that building is ignored while inside.
 */
export function InteriorRoom({
  building,
  onRequestExit,
}: {
  building: BuildingDefinition;
  onRequestExit: () => void;
}) {
  const w = Math.max(4.5, building.size.width - 1.2);
  const d = Math.max(4.5, building.size.depth - 1.2);
  const h = Math.min(4.2, Math.max(3.2, building.size.height * 0.35));
  const { x, z } = building.position;

  return (
    <group position={[x, 0, z]}>
      {/* Floor — polished concrete */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]} receiveShadow>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color="#3a3f44" roughness={0.88} metalness={0.1} />
      </mesh>
      {/* Ceiling */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, h, 0]}>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color="#2a2e32" roughness={0.85} side={2} />
      </mesh>
      {/* Walls */}
      {[
        { pos: [0, h / 2, -d / 2] as const, size: [w, h, 0.18] as const },
        { pos: [0, h / 2, d / 2] as const, size: [w, h, 0.18] as const },
        { pos: [-w / 2, h / 2, 0] as const, size: [0.18, h, d] as const },
        { pos: [w / 2, h / 2, 0] as const, size: [0.18, h, d] as const },
      ].map((wall, i) => (
        <mesh key={i} position={wall.pos} castShadow receiveShadow>
          <boxGeometry args={wall.size} />
          <meshStandardMaterial color="#4a5158" roughness={0.82} metalness={0.12} />
        </mesh>
      ))}
      {/* Accent strip */}
      <mesh position={[0, h - 0.15, 0]}>
        <boxGeometry args={[w * 0.9, 0.08, d * 0.9]} />
        <meshStandardMaterial
          color={building.accent}
          emissive={building.accent}
          emissiveIntensity={0.15}
          roughness={0.5}
        />
      </mesh>
      {/* Soft interior light */}
      <pointLight position={[0, h - 0.4, 0]} intensity={0.85} distance={10} color="#e8e2d4" />
      <Text
        position={[0, h - 0.55, 0]}
        fontSize={0.35}
        color="#eef2f4"
        anchorX="center"
        outlineWidth={0.02}
        outlineColor="#12161a"
      >
        {building.label ?? building.name}
      </Text>
      {/* Exit pad (south / street side) */}
      <mesh
        position={[0, 0.06, d / 2 - 0.9]}
        rotation={[-Math.PI / 2, 0, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onRequestExit();
        }}
      >
        <circleGeometry args={[0.7, 24]} />
        <meshStandardMaterial color="#6a8f6e" emissive="#3d5c3a" emissiveIntensity={0.25} roughness={0.6} />
      </mesh>
      <Text
        position={[0, 1.1, d / 2 - 0.9]}
        fontSize={0.28}
        color="#d8e8d6"
        anchorX="center"
        outlineWidth={0.02}
        outlineColor="#1a221c"
      >
        [E] EXIT
      </Text>
    </group>
  );
}
