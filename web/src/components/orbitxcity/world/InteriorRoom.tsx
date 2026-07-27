import { Text } from "@react-three/drei";
import type { BuildingDefinition, HudPanel } from "@/lib/orbitxcity/types";
import {
  panelForBuilding,
  resolveRoomTheme,
  roomTitle,
  type RoomTheme,
} from "@/lib/orbitxcity/interiorLayout";
import { useCity } from "@/pages/orbitxcity/CityProvider";

function NeonStrip({
  position,
  size,
  color,
}: {
  position: [number, number, number];
  size: [number, number, number];
  color: string;
}) {
  return (
    <mesh position={position}>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.85} toneMapped={false} />
    </mesh>
  );
}

function MonitorBank({
  position,
  accent,
  cols = 3,
  onActivate,
  label,
}: {
  position: [number, number, number];
  accent: string;
  cols?: number;
  onActivate: (e: { stopPropagation: () => void }) => void;
  label: string;
}) {
  const span = cols * 0.72;
  return (
    <group position={position} onClick={onActivate}>
      <mesh position={[0, 0.55, 0]} castShadow>
        <boxGeometry args={[span + 0.35, 1.05, 0.7]} />
        <meshStandardMaterial color="#1a222b" metalness={0.45} roughness={0.4} />
      </mesh>
      {Array.from({ length: cols }).map((_, i) => {
        const x = -span / 2 + 0.36 + i * 0.72;
        return (
          <mesh key={i} position={[x, 1.2, -0.28]} rotation={[-0.18, 0, 0]}>
            <boxGeometry args={[0.62, 0.42, 0.04]} />
            <meshStandardMaterial color="#060b12" emissive={accent} emissiveIntensity={0.45} roughness={0.2} />
          </mesh>
        );
      })}
      <Text position={[0, 1.72, -0.2]} fontSize={0.15} color="#eef4f8" anchorX="center" outlineWidth={0.012} outlineColor="#05080c">
        TAP · {label}
      </Text>
    </group>
  );
}

function BarCounter({
  position,
  width,
  accent,
  onActivate,
  label,
}: {
  position: [number, number, number];
  width: number;
  accent: string;
  onActivate: (e: { stopPropagation: () => void }) => void;
  label: string;
}) {
  return (
    <group position={position} onClick={onActivate}>
      <mesh position={[0, 0.55, 0]} castShadow>
        <boxGeometry args={[width, 1.05, 0.85]} />
        <meshStandardMaterial color="#2a2320" metalness={0.25} roughness={0.55} />
      </mesh>
      <mesh position={[0, 1.1, 0]} castShadow>
        <boxGeometry args={[width + 0.1, 0.08, 0.95]} />
        <meshStandardMaterial color="#3a322c" metalness={0.35} roughness={0.4} />
      </mesh>
      <NeonStrip position={[0, 0.12, 0.48]} size={[width * 0.92, 0.06, 0.04]} color={accent} />
      <Text position={[0, 1.45, 0.2]} fontSize={0.16} color="#f2f6f8" anchorX="center" outlineWidth={0.012} outlineColor="#05080c">
        TAP · {label}
      </Text>
    </group>
  );
}

function LoungeSeating({ x, z, accent }: { x: number; z: number; accent: string }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.32, 0]} castShadow>
        <boxGeometry args={[1.5, 0.45, 0.7]} />
        <meshStandardMaterial color="#252a38" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.62, -0.22]} castShadow>
        <boxGeometry args={[1.5, 0.55, 0.18]} />
        <meshStandardMaterial color="#2e3344" roughness={0.65} />
      </mesh>
      <NeonStrip position={[0, 0.08, 0.38]} size={[1.2, 0.04, 0.04]} color={accent} />
    </group>
  );
}

function Stall({
  position,
  accent,
  onActivate,
  label,
}: {
  position: [number, number, number];
  accent: string;
  onActivate: (e: { stopPropagation: () => void }) => void;
  label: string;
}) {
  return (
    <group position={position} onClick={onActivate}>
      <mesh position={[0, 0.7, 0]} castShadow>
        <boxGeometry args={[1.35, 1.3, 0.85]} />
        <meshStandardMaterial color="#22262e" metalness={0.2} roughness={0.55} />
      </mesh>
      <mesh position={[0, 1.45, 0]} castShadow>
        <boxGeometry args={[1.5, 0.12, 1]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.35} />
      </mesh>
      <mesh position={[0, 1.05, -0.4]}>
        <boxGeometry args={[1.1, 0.55, 0.05]} />
        <meshStandardMaterial color="#0a1018" emissive={accent} emissiveIntensity={0.3} />
      </mesh>
      <Text position={[0, 1.75, 0]} fontSize={0.14} color="#f2f6f8" anchorX="center" outlineWidth={0.01} outlineColor="#05080c">
        TAP · {label}
      </Text>
    </group>
  );
}

function ThemeSet({
  theme,
  width,
  depth,
  height,
  accent,
  building,
}: {
  theme: RoomTheme;
  width: number;
  depth: number;
  height: number;
  accent: string;
  building: BuildingDefinition;
}) {
  const { openPanel, setVoiceOpen } = useCity();
  const panel = panelForBuilding(building);
  const wallZ = -depth / 2 + 0.7;
  const side = Math.min(width / 2 - 1.2, 3.0);

  const activate =
    (p: HudPanel, voice = false) =>
    (e: { stopPropagation: () => void }) => {
      e.stopPropagation();
      if (voice) setVoiceOpen(true);
      openPanel(p);
    };

  return (
    <>
      {/* Neon room frame */}
      <NeonStrip position={[0, height - 0.2, 0]} size={[width * 0.9, 0.06, depth * 0.9]} color={accent} />
      <NeonStrip position={[-width / 2 + 0.15, height * 0.55, 0]} size={[0.05, height * 0.7, depth * 0.85]} color={accent} />
      <NeonStrip position={[width / 2 - 0.15, height * 0.55, 0]} size={[0.05, height * 0.7, depth * 0.85]} color={accent} />

      {theme === "trade" && (
        <>
          <MonitorBank position={[-side * 0.65, 0, wallZ]} accent={accent} cols={3} label="TRADE" onActivate={activate("trading")} />
          <MonitorBank position={[side * 0.65, 0, wallZ]} accent={accent} cols={3} label="CHARTS" onActivate={activate("live")} />
          <MonitorBank position={[0, 0, 0.2]} accent={accent} cols={2} label="TOKEN" onActivate={activate("token")} />
          <mesh position={[0, 0.03, -0.2]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[Math.min(width - 1.6, 5), Math.min(depth - 2.4, 3.6)]} />
            <meshStandardMaterial color="#10161d" emissive={accent} emissiveIntensity={0.06} />
          </mesh>
        </>
      )}

      {theme === "lounge" && (
        <>
          <LoungeSeating x={-side * 0.55} z={-0.2} accent={accent} />
          <LoungeSeating x={side * 0.55} z={-0.2} accent={accent} />
          <BarCounter position={[0, 0, wallZ]} width={Math.min(width - 1.6, 4)} accent={accent} label="SOCIAL" onActivate={activate("community")} />
          <MonitorBank position={[side, 0, 0.5]} accent={accent} cols={1} label="CHAT" onActivate={activate("chat")} />
          <MonitorBank position={[-side, 0, 0.5]} accent={accent} cols={1} label="VOICE" onActivate={activate("voice", true)} />
        </>
      )}

      {theme === "market" && (
        <>
          <Stall position={[-side * 0.7, 0, wallZ + 0.1]} accent={accent} label="BUY" onActivate={activate("marketplace")} />
          <Stall position={[0, 0, wallZ + 0.1]} accent={accent} label="MEMES" onActivate={activate("marketplace")} />
          <Stall position={[side * 0.7, 0, wallZ + 0.1]} accent={accent} label="LIVE" onActivate={activate("live")} />
          <BarCounter position={[0, 0, 0.55]} width={Math.min(width - 2, 3.2)} accent={accent} label="CASHIER" onActivate={activate("token")} />
        </>
      )}

      {theme === "club" && (
        <>
          <mesh position={[0, 0.04, -0.1]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[Math.min(width - 1.5, 5.2), Math.min(depth - 2.5, 3.8)]} />
            <meshStandardMaterial color="#140f18" emissive={accent} emissiveIntensity={0.2} metalness={0.4} roughness={0.35} />
          </mesh>
          {[-1.4, -0.7, 0, 0.7, 1.4].map((x) => (
            <NeonStrip key={x} position={[x, 0.06, -0.1]} size={[0.05, 0.04, Math.min(depth - 2.8, 3.2)]} color={accent} />
          ))}
          <BarCounter position={[0, 0, wallZ]} width={Math.min(width - 1.8, 4.2)} accent={accent} label="VOICE" onActivate={activate("voice", true)} />
          <MonitorBank position={[-side, 0, 0.3]} accent={accent} cols={1} label="CHAT" onActivate={activate("chat")} />
          <MonitorBank position={[side, 0, 0.3]} accent={accent} cols={1} label="EVENTS" onActivate={activate("events")} />
        </>
      )}

      {theme === "theater" && (
        <>
          <mesh
            position={[0, height * 0.5, -depth / 2 + 0.22]}
            onClick={activate(building.interaction === "nft" ? "nft" : "games")}
          >
            <boxGeometry args={[Math.min(width - 1, 5.6), Math.min(height * 0.55, 2.2), 0.1]} />
            <meshStandardMaterial color="#0a0e16" emissive="#d8e6f4" emissiveIntensity={0.45} roughness={0.2} />
          </mesh>
          <Text position={[0, height * 0.5, -depth / 2 + 0.3]} fontSize={0.26} color="#05080c" anchorX="center">
            {building.interaction === "nft" ? "TAP · NFT GALLERY" : "TAP SCREEN · PLAY"}
          </Text>
          {[-1.3, 0, 1.3].map((x) => (
            <LoungeSeating key={x} x={x} z={0.55} accent={accent} />
          ))}
          <MonitorBank
            position={[side, 0, wallZ + 0.4]}
            accent={accent}
            cols={1}
            label={building.interaction === "nft" ? "NFT" : "EVENTS"}
            onActivate={activate(building.interaction === "nft" ? "nft" : "events")}
          />
        </>
      )}

      {theme === "hq" && (
        <>
          {/* Premium OrbitX HQ office — glass boardroom + product command wall */}
          <mesh position={[0, 0.03, -0.15]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[Math.min(width - 1.4, 6.2), Math.min(depth - 2.2, 4.4)]} />
            <meshStandardMaterial color="#0e161c" metalness={0.55} roughness={0.28} emissive={accent} emissiveIntensity={0.05} />
          </mesh>
          <NeonStrip position={[0, 0.08, -0.15]} size={[Math.min(width - 1.8, 5.6), 0.04, Math.min(depth - 2.6, 3.8)]} color={accent} />

          {/* Reception / brand wall */}
          <mesh position={[0, height * 0.55, -depth / 2 + 0.2]} castShadow>
            <boxGeometry args={[Math.min(width - 1.2, 5.8), height * 0.7, 0.12]} />
            <meshStandardMaterial color="#101820" metalness={0.4} roughness={0.4} />
          </mesh>
          <Text position={[0, height * 0.62, -depth / 2 + 0.3]} fontSize={0.42} color={accent} anchorX="center" outlineWidth={0.02} outlineColor="#050a0e">
            ORBITX
          </Text>
          <Text position={[0, height * 0.42, -depth / 2 + 0.3]} fontSize={0.16} color="#d5e2ea" anchorX="center">
            HQ · DEX · LAUNCHPAD · SOCIAL
          </Text>

          {/* Glass conference table */}
          <mesh position={[0, 0.42, -0.35]} castShadow>
            <boxGeometry args={[2.6, 0.08, 1.35]} />
            <meshStandardMaterial color="#8ec8e8" metalness={0.65} roughness={0.12} transparent opacity={0.55} />
          </mesh>
          <mesh position={[0, 0.2, -0.35]} castShadow>
            <boxGeometry args={[0.12, 0.4, 0.12]} />
            <meshStandardMaterial color="#1a222c" metalness={0.5} roughness={0.4} />
          </mesh>
          {[-0.85, 0.85].map((x) => (
            <mesh key={`chair-${x}`} position={[x, 0.35, 0.45]} castShadow>
              <boxGeometry args={[0.55, 0.55, 0.5]} />
              <meshStandardMaterial color="#1c2430" roughness={0.65} />
            </mesh>
          ))}

          {/* Product command desks — real OrbitX rails */}
          <MonitorBank position={[0, 0, wallZ + 0.2]} accent={accent} cols={4} label="LIVE DEX" onActivate={activate("live")} />
          <MonitorBank position={[-side * 0.75, 0, 0.2]} accent={accent} cols={2} label="TRADE" onActivate={activate("trading")} />
          <MonitorBank position={[side * 0.75, 0, 0.2]} accent={accent} cols={2} label="LAUNCH" onActivate={activate("launch")} />
          <MonitorBank position={[-side, 0, 0.95]} accent="#ff4d9a" cols={1} label="STORE" onActivate={activate("marketplace")} />
          <MonitorBank position={[side, 0, 0.95]} accent="#a78bfa" cols={1} label="SOCIAL" onActivate={activate("community")} />
          <BarCounter
            position={[0, 0, depth / 2 - 2.35]}
            width={Math.min(width - 2.2, 3.4)}
            accent={accent}
            label="FRONT DESK"
            onActivate={activate("missions")}
          />
        </>
      )}

      {theme === "launch" && (
        <>
          <mesh position={[0, 0.22, -0.1]} receiveShadow>
            <cylinderGeometry args={[1.4, 1.65, 0.42, 36]} />
            <meshStandardMaterial color="#2a2418" metalness={0.35} roughness={0.55} />
          </mesh>
          <mesh position={[0, 0.5, -0.1]} onClick={activate("launch")}>
            <cylinderGeometry args={[0.95, 1.15, 0.16, 36]} />
            <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.55} />
          </mesh>
          <Text position={[0, 1.15, -0.1]} fontSize={0.28} color="#f7f0d6" anchorX="center" outlineWidth={0.02} outlineColor="#1a160c">
            TAP STAGE · LAUNCH
          </Text>
          <MonitorBank position={[-side, 0, wallZ + 0.2]} accent={accent} cols={1} label="TOKEN" onActivate={activate("token")} />
          <MonitorBank position={[side, 0, wallZ + 0.2]} accent={accent} cols={1} label="LIVE" onActivate={activate("live")} />
        </>
      )}

      {theme === "lobby" && (
        <>
          <BarCounter position={[0, 0, wallZ]} width={Math.min(width - 1.6, 3.8)} accent={accent} label="FRONT DESK" onActivate={activate(panel)} />
          <LoungeSeating x={-side * 0.7} z={0.35} accent={accent} />
          <LoungeSeating x={side * 0.7} z={0.35} accent={accent} />
          <MonitorBank position={[-side, 0, wallZ + 0.9]} accent={accent} cols={1} label="LIVE" onActivate={activate("live")} />
          <MonitorBank position={[side, 0, wallZ + 0.9]} accent={accent} cols={1} label="MAP" onActivate={activate("map")} />
        </>
      )}
    </>
  );
}

/**
 * Neon commercial interiors — desks, bars, stalls, stages with TAP stations
 * wired to real OrbitX panels (not empty living-room props).
 */
export function InteriorRoom({
  building,
  onRequestExit,
}: {
  building: BuildingDefinition;
  onRequestExit: () => void;
}) {
  const theme = resolveRoomTheme(building);
  const w = Math.max(5.4, Math.min(14, building.size.width - 0.8));
  const d = Math.max(5.4, Math.min(14, building.size.depth - 0.8));
  const h = Math.min(4.5, Math.max(3.4, building.size.height * 0.32));
  const { x, z } = building.position;
  const floor =
    theme === "hq"
      ? "#0c1218"
      : theme === "club"
        ? "#121018"
        : theme === "launch"
          ? "#2a2418"
          : theme === "trade"
            ? "#121820"
            : "#1a1f26";

  return (
    <group position={[x, 0, z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]} receiveShadow>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color={floor} roughness={0.55} metalness={0.28} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.055, d / 2 - 1.5]}>
        <planeGeometry args={[Math.min(w - 1, 3.4), 1.2]} />
        <meshStandardMaterial color="#10161c" emissive={building.accent} emissiveIntensity={0.18} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, h, 0]}>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color="#151a20" roughness={0.8} side={2} />
      </mesh>
      {[
        { pos: [0, h / 2, -d / 2] as const, size: [w, h, 0.18] as const },
        { pos: [0, h / 2, d / 2] as const, size: [w, h, 0.18] as const },
        { pos: [-w / 2, h / 2, 0] as const, size: [0.18, h, d] as const },
        { pos: [w / 2, h / 2, 0] as const, size: [0.18, h, d] as const },
      ].map((wall, i) => (
        <mesh key={i} position={wall.pos} castShadow receiveShadow>
          <boxGeometry args={wall.size} />
          <meshStandardMaterial color="#1c242c" roughness={0.68} metalness={0.22} />
        </mesh>
      ))}

      <pointLight position={[0, h - 0.4, 0]} intensity={1.35} distance={13} color="#efe6d6" />
      <pointLight position={[0, 1.8, -d / 2 + 0.8]} intensity={0.7} distance={9} color={building.accent} />

      <Text
        position={[0, h - 0.5, d / 2 - 0.22]}
        fontSize={0.26}
        color="#eef2f4"
        anchorX="center"
        outlineWidth={0.02}
        outlineColor="#12161a"
      >
        {building.name.toUpperCase()}
      </Text>
      <Text position={[0, h - 0.9, -d / 2 + 0.25]} fontSize={0.2} color={building.accent} anchorX="center">
        {roomTitle(theme, building)}
      </Text>
      <Text
        position={[0, 2.35, d / 2 - 1.5]}
        fontSize={0.18}
        color="#d5e0e8"
        anchorX="center"
        outlineWidth={0.012}
        outlineColor="#0a1014"
      >
        TAP glowing stations · E exits
      </Text>

      <ThemeSet theme={theme} width={w} depth={d} height={h} accent={building.accent} building={building} />

      <mesh
        position={[0, 0.06, d / 2 - 0.9]}
        rotation={[-Math.PI / 2, 0, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onRequestExit();
        }}
      >
        <circleGeometry args={[0.75, 28]} />
        <meshStandardMaterial color="#6a8f6e" emissive="#3d5c3a" emissiveIntensity={0.32} />
      </mesh>
      <Text position={[0, 1.05, d / 2 - 0.9]} fontSize={0.26} color="#d8e8d6" anchorX="center" outlineWidth={0.02} outlineColor="#1a221c">
        [E] EXIT TO STREET
      </Text>
    </group>
  );
}
