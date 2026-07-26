import { Text } from "@react-three/drei";
import type { BuildingDefinition, HudPanel } from "@/lib/orbitxcity/types";
import { useCity } from "@/pages/orbitxcity/CityProvider";

/**
 * Walk-in interiors — the exterior shell remains in the world while this
 * furnished, building-specific lobby is revealed inside it.
 */
function InteriorTerminal({ building, height, depth }: { building: BuildingDefinition; height: number; depth: number }) {
  const { openPanel, setVoiceOpen } = useCity();
  const panelByKind: Record<string, HudPanel> = {
    hq: "map",
    marketplace: "marketplace",
    launch: "launch",
    trading: "trading",
    community: "community",
    billboard: "live",
    voice: "voice",
    games: "games",
    nft: "nft",
  };
  const panel = building.interaction ? panelByKind[building.interaction] ?? "live" : "community";
  const activate = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    if (building.interaction === "voice") setVoiceOpen(true);
    openPanel(panel);
  };

  return (
    <group position={[0, 0, -depth / 2 + 0.62]}>
      <mesh position={[0, 0.5, 0]} castShadow onClick={activate}>
        <boxGeometry args={[2.5, 1, 0.62]} />
        <meshStandardMaterial color="#1a2229" metalness={0.55} roughness={0.35} />
      </mesh>
      <mesh position={[0, 1.08, -0.33]} rotation={[-0.16, 0, 0]} onClick={activate}>
        <boxGeometry args={[1.82, 0.62, 0.05]} />
        <meshStandardMaterial color="#091017" emissive={building.accent} emissiveIntensity={0.38} roughness={0.25} />
      </mesh>
      <mesh position={[-0.86, 0.95, -0.36]} onClick={activate}>
        <sphereGeometry args={[0.07, 12, 12]} />
        <meshStandardMaterial color={building.accent} emissive={building.accent} emissiveIntensity={0.6} />
      </mesh>
      <Text
        position={[0, 1.52, -0.36]}
        fontSize={0.2}
        color="#e8f0f4"
        anchorX="center"
        outlineWidth={0.015}
        outlineColor="#05080c"
        onClick={activate}
      >
        TAP TERMINAL · {building.interaction?.toUpperCase() ?? "EXPLORE"}
      </Text>
      <Text position={[0, height - 0.9, 0]} fontSize={0.18} color={building.accent} anchorX="center">
        {building.label ?? building.name}
      </Text>
    </group>
  );
}

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
  const id = building.id.toLowerCase();

  if (id.includes("club")) {
    return (
      <>
        <mesh position={[0, 0.035, -0.2]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[Math.min(width - 1.4, 5.2), Math.min(depth - 3, 4.4)]} />
          <meshStandardMaterial color="#17121c" emissive={accent} emissiveIntensity={0.14} metalness={0.35} roughness={0.45} />
        </mesh>
        {[-1.5, -0.5, 0.5, 1.5].map((x) => (
          <mesh key={x} position={[x, 0.07, -0.2]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.04, Math.min(depth - 3.4, 3.6)]} />
            <meshBasicMaterial color={accent} toneMapped={false} />
          </mesh>
        ))}
        {[-width / 2 + 0.75, width / 2 - 0.75].map((x) => (
          <mesh key={x} position={[x, 1.2, -depth / 2 + 0.42]}>
            <boxGeometry args={[0.8, 2.2, 0.45]} />
            <meshStandardMaterial color="#131822" emissive={accent} emissiveIntensity={0.18} metalness={0.5} roughness={0.38} />
          </mesh>
        ))}
        <Text position={[0, height - 0.85, wallZ]} fontSize={0.34} color={accent} anchorX="center">PULSE · LIVE ROOM</Text>
      </>
    );
  }

  if (id.includes("casino") || id.includes("arcade")) {
    return (
      <>
        {[-1.6, 0, 1.6].map((x) => (
          <group key={x} position={[x, 0, -0.3]}>
            <mesh position={[0, 0.55, 0]} castShadow>
              <boxGeometry args={[0.78, 1.1, 0.68]} />
              <meshStandardMaterial color="#20242a" metalness={0.45} roughness={0.42} />
            </mesh>
            <mesh position={[0, 0.78, -0.36]}>
              <boxGeometry args={[0.54, 0.38, 0.04]} />
              <meshStandardMaterial color="#0a1017" emissive={accent} emissiveIntensity={0.35} roughness={0.28} />
            </mesh>
          </group>
        ))}
        <Text position={[0, height - 0.85, wallZ]} fontSize={0.34} color={accent} anchorX="center">
          {id.includes("casino") ? "ROYAL ORBIT · TABLES OPEN" : "NEON ARCADE · FREE PLAY"}
        </Text>
      </>
    );
  }

  if (id.includes("cinema") || id.includes("theater")) {
    return (
      <>
        <mesh position={[0, height * 0.56, -depth / 2 + 0.22]}>
          <boxGeometry args={[Math.min(width - 1, 6.4), Math.min(height * 0.55, 2.2), 0.08]} />
          <meshStandardMaterial color="#0c1119" emissive="#d8e4f0" emissiveIntensity={0.32} roughness={0.24} />
        </mesh>
        {[-1.35, 0, 1.35].map((x) => (
          <mesh key={x} position={[x, 0.38, 0.45]} castShadow>
            <boxGeometry args={[0.85, 0.7, 0.72]} />
            <meshStandardMaterial color="#34283e" roughness={0.7} />
          </mesh>
        ))}
        <Text position={[0, height - 0.85, wallZ]} fontSize={0.32} color={accent} anchorX="center">NOW SHOWING · ORBITX LIVE</Text>
      </>
    );
  }

  if (id.includes("coffee")) {
    return (
      <>
        {[-0.95, 0.95].map((x) => (
          <group key={x} position={[x, 0, -0.2]}>
            <mesh position={[0, 0.46, 0]} castShadow>
              <cylinderGeometry args={[0.48, 0.48, 0.08, 16]} />
              <meshStandardMaterial color="#6d5340" roughness={0.72} />
            </mesh>
            <mesh position={[0, 0.23, 0]} castShadow>
              <cylinderGeometry args={[0.05, 0.08, 0.44, 10]} />
              <meshStandardMaterial color="#282b2e" metalness={0.7} roughness={0.35} />
            </mesh>
          </group>
        ))}
        <Text position={[0, height - 0.85, wallZ]} fontSize={0.32} color={accent} anchorX="center">ORBIT BREW · OPEN</Text>
      </>
    );
  }

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
  const floorColor = building.kind === "launch_arena" ? "#39311c" : building.color;
  const wallColor = building.color;

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
          <meshStandardMaterial color={wallColor} roughness={0.72} metalness={0.2} />
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
      <InteriorTerminal building={building} height={h} depth={d} />
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
