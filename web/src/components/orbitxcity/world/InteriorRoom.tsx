import { Billboard, Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import type { AvatarAppearance, BuildingDefinition, HudPanel } from "@/lib/orbitxcity/types";
import {
  furnitureSlots,
  interiorNpcSlots,
  panelForBuilding,
  resolveRoomTheme,
  roomTitle,
  type InteriorNpcSlot,
  type RoomTheme,
} from "@/lib/orbitxcity/interiorLayout";
import { getFurnitureSet } from "@/lib/orbitxcity/assets/catalog";
import { interiorDoorWidth, interiorMetrics } from "@/lib/orbitxcity/collision";
import { appearanceFromClass, getCharacterClass } from "@/lib/orbitxcity/characterClasses";
import { useCity } from "@/pages/orbitxcity/CityProvider";
import { GltfProp } from "./GltfProp";
import { CharacterMesh } from "./CharacterMesh";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

const NPC_BODY = ["#233a5c", "#3c2a4d", "#1e4436", "#4d3a1e", "#2a3d4d"];
const VENDOR_RADIUS = 1.85;

type RoomPalette = {
  floor: string;
  wall: string;
  ceiling: string;
  entry: string;
  key: string;
  fill: string;
  floorRough: number;
  floorMetal: number;
  keyIntensity: number;
};

function roomPalette(theme: RoomTheme): RoomPalette {
  switch (theme) {
    case "hq":
      return {
        floor: "#0c1218",
        wall: "#152028",
        ceiling: "#0e141a",
        entry: "#101820",
        key: "#d8ebe4",
        fill: "#c5a26f",
        floorRough: 0.32,
        floorMetal: 0.48,
        keyIntensity: 1.45,
      };
    case "trade":
      return {
        floor: "#101820",
        wall: "#18222c",
        ceiling: "#0c1218",
        entry: "#121a22",
        key: "#cfe4f0",
        fill: "#3de7ff",
        floorRough: 0.45,
        floorMetal: 0.35,
        keyIntensity: 1.5,
      };
    case "club":
      return {
        floor: "#120e18",
        wall: "#1a1222",
        ceiling: "#0e0a14",
        entry: "#18101e",
        key: "#f0c8e0",
        fill: "#ff4d9a",
        floorRough: 0.4,
        floorMetal: 0.42,
        keyIntensity: 1.2,
      };
    case "market":
      return {
        floor: "#1a1814",
        wall: "#242018",
        ceiling: "#161410",
        entry: "#1e1a14",
        key: "#f0e2c8",
        fill: "#c5a26f",
        floorRough: 0.7,
        floorMetal: 0.15,
        keyIntensity: 1.35,
      };
    case "launch":
      return {
        floor: "#2a2418",
        wall: "#2c261c",
        ceiling: "#1a160e",
        entry: "#241e14",
        key: "#f7ecd0",
        fill: "#ffb84d",
        floorRough: 0.62,
        floorMetal: 0.22,
        keyIntensity: 1.4,
      };
    case "theater":
      return {
        floor: "#12161c",
        wall: "#1a2028",
        ceiling: "#0c1016",
        entry: "#141a20",
        key: "#e8eef4",
        fill: "#a78bfa",
        floorRough: 0.55,
        floorMetal: 0.25,
        keyIntensity: 1.25,
      };
    case "lounge":
      return {
        floor: "#1a1c22",
        wall: "#22262e",
        ceiling: "#141820",
        entry: "#1c2028",
        key: "#efe6d6",
        fill: "#00ff9f",
        floorRough: 0.6,
        floorMetal: 0.2,
        keyIntensity: 1.3,
      };
    default:
      return {
        floor: "#1a1f26",
        wall: "#1c242c",
        ceiling: "#151a20",
        entry: "#10161c",
        key: "#efe6d6",
        fill: "#cfe8ff",
        floorRough: 0.55,
        floorMetal: 0.28,
        keyIntensity: 1.35,
      };
  }
}

function FurnitureLayer({
  theme,
  width,
  depth,
}: {
  theme: RoomTheme;
  width: number;
  depth: number;
}) {
  const paths = getFurnitureSet(theme);
  const slots = useMemo(() => furnitureSlots(theme, width, depth, paths), [theme, width, depth, paths]);
  if (!slots.length) return null;
  return (
    <group>
      {slots.map((s, i) => (
        <GltfProp
          key={`${s.path}-${i}`}
          path={s.path}
          position={[s.x, 0, s.z]}
          rotation={[0, s.rotY, 0]}
          scale={s.scale}
        />
      ))}
    </group>
  );
}

function InteriorNpc({
  slot,
  accent,
  seed,
  originX,
  originZ,
}: {
  slot: InteriorNpcSlot;
  accent: string;
  seed: number;
  originX: number;
  originZ: number;
}) {
  const { playerPos } = useCity();
  const group = useRef<THREE.Group>(null);
  const appearance = useMemo<AvatarAppearance>(() => {
    const base = appearanceFromClass(getCharacterClass(slot.classId), slot.vendorLabel ?? slot.id);
    return {
      ...base,
      bodyColor: NPC_BODY[seed % NPC_BODY.length]!,
      accentColor: slot.role === "vendor" ? accent : base.accentColor,
      outfit: slot.outfit,
      name: slot.vendorLabel ?? "npc",
    };
  }, [slot, accent, seed]);

  const [bubble, setBubble] = useState<string | null>(slot.lines[0] ?? null);

  useEffect(() => {
    let hide: ReturnType<typeof setTimeout> | undefined;
    const cycle = setInterval(() => {
      const line = slot.lines[Math.floor(Math.random() * slot.lines.length)];
      if (!line) return;
      setBubble(line);
      hide = setTimeout(() => setBubble(null), 3400);
    }, 5200 + (seed % 2800));
    return () => {
      clearInterval(cycle);
      if (hide) clearTimeout(hide);
    };
  }, [slot.lines, seed]);

  useFrame((_, rawDt) => {
    if (!group.current) return;
    const dt = Math.min(rawDt, 0.05);
    const wx = originX + slot.x;
    const wz = originZ + slot.z;
    const dx = playerPos.x - wx;
    const dz = playerPos.z - wz;
    const dist = Math.hypot(dx, dz);
    // Face the player when nearby; otherwise hold authored rotY.
    const targetYaw = dist < 4.5 ? Math.atan2(dx, dz) : slot.rotY;
    let y = group.current.rotation.y;
    let delta = targetYaw - y;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    group.current.rotation.y = y + delta * Math.min(1, dt * 6);
  });

  return (
    <group ref={group} position={[slot.x, 0, slot.z]} rotation={[0, slot.rotY, 0]}>
      <CharacterMesh
        appearance={appearance}
        moving={false}
        dancing={Boolean(slot.dancing)}
        walkIntensity={slot.dancing ? 0.9 : 0.35}
      />
      {slot.role === "vendor" && (
        <mesh position={[0, 0.04, 0.55]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.45, 0.58, 28]} />
          <meshStandardMaterial
            color={accent}
            emissive={accent}
            emissiveIntensity={0.35}
            transparent
            opacity={0.45}
            toneMapped={false}
          />
        </mesh>
      )}
      {bubble && (
        <Billboard position={[0, 2.45, 0]}>
          <Text
            fontSize={0.2}
            color="#eef4ff"
            anchorX="center"
            anchorY="middle"
            maxWidth={2.8}
            outlineWidth={0.04}
            outlineColor="#04070f"
          >
            {bubble}
          </Text>
        </Billboard>
      )}
    </group>
  );
}

/** Theme NPCs + vendor proximity → CityProvider prompt / E. */
function InteriorCrowd({
  theme,
  width,
  depth,
  building,
}: {
  theme: RoomTheme;
  width: number;
  depth: number;
  building: BuildingDefinition;
}) {
  const { playerPos, setInteriorVendor, openPanel, setVoiceOpen } = useCity();
  const slots = useMemo(() => interiorNpcSlots(theme, width, depth), [theme, width, depth]);
  const vendor = useMemo(() => slots.find((s) => s.role === "vendor" && s.panel), [slots]);
  const originX = building.position.x;
  const originZ = building.position.z;
  const nearVendor = useRef(false);

  useFrame(() => {
    if (!vendor?.panel) {
      if (nearVendor.current) {
        nearVendor.current = false;
        setInteriorVendor(null);
      }
      return;
    }
    const wx = originX + vendor.x;
    const wz = originZ + vendor.z;
    const dist = Math.hypot(playerPos.x - wx, playerPos.z - wz);
    const near = dist <= VENDOR_RADIUS;
    if (near === nearVendor.current) return;
    nearVendor.current = near;
    if (near) {
      setInteriorVendor({
        label: vendor.vendorLabel ?? "Vendor",
        hint: vendor.vendorHint ?? "E · talk",
        panel: vendor.panel,
      });
    } else {
      setInteriorVendor(null);
    }
  });

  useEffect(() => () => setInteriorVendor(null), [setInteriorVendor]);

  return (
    <group>
      {slots.map((slot, i) => (
        <group
          key={slot.id}
          onClick={
            slot.role === "vendor" && slot.panel
              ? (e) => {
                  e.stopPropagation();
                  if (slot.panel === "voice") setVoiceOpen(true);
                  openPanel(slot.panel!);
                }
              : undefined
          }
        >
          <InteriorNpc
            slot={slot}
            accent={building.accent}
            seed={i * 97 + theme.length}
            originX={originX}
            originZ={originZ}
          />
        </group>
      ))}
    </group>
  );
}

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
  const { width: w, depth: d } = interiorMetrics(building);
  const h = Math.min(4.5, Math.max(3.4, building.size.height * 0.32));
  const { x, z } = building.position;
  const palette = roomPalette(theme);

  return (
    <group position={[x, 0, z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]} receiveShadow>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color={palette.floor} roughness={palette.floorRough} metalness={palette.floorMetal} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.055, d / 2 - 1.5]}>
        <planeGeometry args={[Math.min(w - 1, 3.4), 1.2]} />
        <meshStandardMaterial color={palette.entry} emissive={building.accent} emissiveIntensity={0.2} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, h, 0]}>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color={palette.ceiling} roughness={0.8} side={2} />
      </mesh>
      {/* North wall */}
      <mesh position={[0, h / 2, -d / 2]} castShadow receiveShadow>
        <boxGeometry args={[w, h, 0.18]} />
        <meshStandardMaterial color={palette.wall} roughness={0.68} metalness={0.22} />
      </mesh>
      {/* South wall split around open doorway */}
      {([-1, 1] as const).map((side) => {
        const doorW = interiorDoorWidth(building);
        const seg = Math.max(0.2, (w - doorW - 0.35) / 2);
        return (
          <mesh key={`sw-${side}`} position={[side * (doorW / 2 + seg / 2 + 0.1), h / 2, d / 2]} castShadow receiveShadow>
            <boxGeometry args={[seg, h, 0.18]} />
            <meshStandardMaterial color={palette.wall} roughness={0.68} metalness={0.22} />
          </mesh>
        );
      })}
      {/* East / west walls */}
      <mesh position={[-w / 2, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.18, h, d]} />
        <meshStandardMaterial color={palette.wall} roughness={0.68} metalness={0.22} />
      </mesh>
      <mesh position={[w / 2, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.18, h, d]} />
        <meshStandardMaterial color={palette.wall} roughness={0.68} metalness={0.22} />
      </mesh>

      {/* Street-facing window slits — light continuity with Midtown */}
      {[
        { pos: [0, h * 0.62, -d / 2 + 0.12] as const, size: [w * 0.55, 0.55, 0.06] as const },
        { pos: [-w / 2 + 0.12, h * 0.55, -d * 0.15] as const, size: [0.06, 0.7, d * 0.35] as const },
        { pos: [w / 2 - 0.12, h * 0.55, -d * 0.15] as const, size: [0.06, 0.7, d * 0.35] as const },
      ].map((win, i) => (
        <mesh key={`win-${i}`} position={win.pos}>
          <boxGeometry args={win.size} />
          <meshStandardMaterial
            color="#0a1218"
            emissive={building.accent}
            emissiveIntensity={0.4}
            transparent
            opacity={0.85}
            toneMapped={false}
          />
        </mesh>
      ))}

      <pointLight position={[0, h - 0.4, 0]} intensity={palette.keyIntensity} distance={13} color={palette.key} />
      <pointLight position={[0, 1.8, -d / 2 + 0.8]} intensity={0.75} distance={9} color={building.accent} />
      <pointLight position={[0, 1.4, d / 2 - 0.6]} intensity={0.5} distance={6} color={palette.fill} />

      <Text
        position={[0, h - 0.5, -d / 2 + 0.22]}
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
        position={[0, 2.2, d / 2 - 1.35]}
        fontSize={0.16}
        color="#d5e0e8"
        anchorX="center"
        outlineWidth={0.012}
        outlineColor="#0a1014"
      >
        Walk out the door · E opens tools · TAP stations
      </Text>

      <ThemeSet theme={theme} width={w} depth={d} height={h} accent={building.accent} building={building} />
      <FurnitureLayer theme={theme} width={w} depth={d} />
      <InteriorCrowd theme={theme} width={w} depth={d} building={building} />

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
      <Text position={[0, 1.05, d / 2 - 0.9]} fontSize={0.22} color="#d8e8d6" anchorX="center" outlineWidth={0.02} outlineColor="#1a221c">
        DOOR → STREET
      </Text>
    </group>
  );
}
