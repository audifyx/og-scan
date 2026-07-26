import { Text } from "@react-three/drei";
import type { BuildingDefinition } from "@/lib/orbitxcity/types";

/**
 * Walk-in interiors — the exterior shell remains in the world while this
 * furnished, building-specific lobby is revealed inside it.
 */
function InteriorFurniture({
  building,
  width,
  depth,
  height,
}: {
  building: BuildingDefinition;
  width: number;
  depth: number;
  height: number;
}) {
  const accent = building.accent;
  const wallZ = -depth / 2 + 0.28;

  switch (building.kind) {
    case "trading_floor":
      return (
        <>
          {[-1.8, 0, 1.8].map((x) => (
            <group key={x} position={[x, 0, -0.35]}>
              <mesh position={[0, 0.5, 0]} castShadow>
                <boxGeometry args={[1.35, 0.75, 0.72]} />
                <meshStandardMaterial color="#202a31" metalness={0.38} roughness={0.55} />
              </mesh>
              <mesh position={[0, 1.03, -0.12]} rotation={[-0.12, 0, 0]}>
                <boxGeometry args={[1.12, 0.46, 0.05]} />
                <meshStandardMaterial color="#0b1319" emissive={accent} emissiveIntensity={0.22} roughness={0.35} />
              </mesh>
            </group>
          ))}
          <Text position={[0, height - 0.85, wallZ]} fontSize={0.34} color={accent} anchorX="center">
            LIVE MARKET FLOOR
          </Text>
        </>
      );
    case "launch_arena":
      return (
        <>
          <mesh position={[0, 0.22, -0.1]} receiveShadow>
            <cylinderGeometry args={[1.45, 1.7, 0.42, 32]} />
            <meshStandardMaterial color="#242118" metalness={0.3} roughness={0.6} />
          </mesh>
          <mesh position={[0, 0.5, -0.1]}>
            <cylinderGeometry args={[0.95, 1.18, 0.16, 32]} />
            <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.35} roughness={0.4} />
          </mesh>
          <Text position={[0, 1.25, -0.1]} fontSize={0.38} color="#f7f0d6" anchorX="center">
            LAUNCH STAGE
          </Text>
        </>
      );
    case "social_hub":
      return (
        <>
          {[-1, 1].map((x) => (
            <group key={x} position={[x, 0, -0.25]}>
              <mesh position={[0, 0.38, 0]} castShadow>
                <boxGeometry args={[1.25, 0.54, 0.75]} />
                <meshStandardMaterial color="#29263a" roughness={0.72} />
              </mesh>
              <mesh position={[0, 0.78, 0]}>
                <boxGeometry args={[1.35, 0.12, 0.88]} />
                <meshStandardMaterial color="#5a5370" metalness={0.15} roughness={0.58} />
              </mesh>
            </group>
          ))}
          <Text position={[0, height - 0.85, wallZ]} fontSize={0.34} color={accent} anchorX="center">
            COMMUNITY LOUNGE
          </Text>
        </>
      );
    case "market":
    case "shop":
      return (
        <>
          <mesh position={[0, 0.56, -0.2]} castShadow>
            <boxGeometry args={[Math.min(width - 1.2, 4.2), 1.05, 0.72]} />
            <meshStandardMaterial color="#28272b" metalness={0.18} roughness={0.58} />
          </mesh>
          <mesh position={[0, 1.12, -0.56]}>
            <boxGeometry args={[Math.min(width - 1.45, 3.9), 0.72, 0.04]} />
            <meshStandardMaterial color="#0c1115" emissive={accent} emissiveIntensity={0.18} roughness={0.4} />
          </mesh>
          <Text position={[0, height - 0.85, wallZ]} fontSize={0.34} color={accent} anchorX="center">
            {building.label ?? "ORBITX"} EXCHANGE
          </Text>
        </>
      );
    case "hq":
      return (
        <>
          <mesh position={[0, 0.5, -0.45]} castShadow>
            <boxGeometry args={[Math.min(width - 1.2, 5.4), 0.96, 0.9]} />
            <meshStandardMaterial color="#202a35" metalness={0.4} roughness={0.48} />
          </mesh>
          <Text position={[0, 1.25, -0.1]} fontSize={0.42} color={accent} anchorX="center">
            ORBITX HQ
          </Text>
          <Text position={[0, height - 0.85, wallZ]} fontSize={0.28} color="#d9e4ea" anchorX="center">
            WORLD OPERATIONS
          </Text>
        </>
      );
    default:
      return (
        <>
          <mesh position={[0, 0.48, -0.35]} castShadow>
            <boxGeometry args={[Math.min(width - 1.4, 3.8), 0.88, 0.72]} />
            <meshStandardMaterial color="#2b3036" metalness={0.22} roughness={0.65} />
          </mesh>
          <Text position={[0, height - 0.85, wallZ]} fontSize={0.32} color={accent} anchorX="center">
            {building.label ?? building.name}
          </Text>
        </>
      );
  }
}

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
  const floorColor = building.kind === "launch_arena" ? "#39311c" : "#32373c";

  return (
    <group position={[x, 0, z]}>
      {/* Polished floor and inlaid entry strip */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]} receiveShadow>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color={floorColor} roughness={0.62} metalness={0.24} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.055, d / 2 - 1.55]}>
        <planeGeometry args={[Math.min(w - 1, 3.2), 1.1]} />
        <meshStandardMaterial color="#151b20" emissive={building.accent} emissiveIntensity={0.12} roughness={0.48} />
      </mesh>
      {/* Ceiling panel with perimeter lighting */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, h, 0]}>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color="#20262b" roughness={0.78} side={2} />
      </mesh>
      {[
        { pos: [0, h / 2, -d / 2] as const, size: [w, h, 0.18] as const },
        { pos: [0, h / 2, d / 2] as const, size: [w, h, 0.18] as const },
        { pos: [-w / 2, h / 2, 0] as const, size: [0.18, h, d] as const },
        { pos: [w / 2, h / 2, 0] as const, size: [0.18, h, d] as const },
      ].map((wall, i) => (
        <mesh key={i} position={wall.pos} castShadow receiveShadow>
          <boxGeometry args={wall.size} />
          <meshStandardMaterial color="#414950" roughness={0.72} metalness={0.2} />
        </mesh>
      ))}
      <mesh position={[0, h - 0.16, 0]}>
        <boxGeometry args={[w * 0.92, 0.07, d * 0.92]} />
        <meshStandardMaterial
          color={building.accent}
          emissive={building.accent}
          emissiveIntensity={0.42}
          roughness={0.42}
        />
      </mesh>
      <pointLight position={[0, h - 0.45, 0]} intensity={1.15} distance={11} color="#e8e2d4" />
      <pointLight position={[0, 1.6, -d / 2 + 0.6]} intensity={0.45} distance={7} color={building.accent} />
      <Text
        position={[0, h - 0.55, d / 2 - 0.22]}
        fontSize={0.28}
        color="#eef2f4"
        anchorX="center"
        outlineWidth={0.02}
        outlineColor="#12161a"
      >
        {building.name.toUpperCase()}
      </Text>
      <InteriorFurniture building={building} width={w} depth={d} height={h} />
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
