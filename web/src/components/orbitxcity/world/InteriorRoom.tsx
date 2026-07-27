import { Clone, Text, useGLTF } from "@react-three/drei";
import type { BuildingDefinition, HudPanel } from "@/lib/orbitxcity/types";
import {
  panelForBuilding,
  resolveRoomTheme,
  roomTitle,
  type RoomTheme,
} from "@/lib/orbitxcity/interiorLayout";
import { useCity } from "@/pages/orbitxcity/CityProvider";

const FURN = {
  couch: "/orbitxcity/models/furniture/couch_pillows.gltf",
  armchair: "/orbitxcity/models/furniture/armchair_pillows.gltf",
  table: "/orbitxcity/models/furniture/table_medium.gltf",
  tableLong: "/orbitxcity/models/furniture/table_medium_long.gltf",
  tableLow: "/orbitxcity/models/furniture/table_low.gltf",
  tableSmall: "/orbitxcity/models/furniture/table_small.gltf",
  chair: "/orbitxcity/models/furniture/chair_A.gltf",
  stool: "/orbitxcity/models/furniture/chair_stool.gltf",
  cabinet: "/orbitxcity/models/furniture/cabinet_medium_decorated.gltf",
  shelf: "/orbitxcity/models/furniture/shelf_B_large_decorated.gltf",
  lamp: "/orbitxcity/models/furniture/lamp_standing.gltf",
  lampTable: "/orbitxcity/models/furniture/lamp_table.gltf",
  rug: "/orbitxcity/models/furniture/rug_rectangle_stripes_A.gltf",
  books: "/orbitxcity/models/furniture/book_set.gltf",
  art: "/orbitxcity/models/furniture/pictureframe_large_A.gltf",
  artMed: "/orbitxcity/models/furniture/pictureframe_medium.gltf",
  plant: "/orbitxcity/models/furniture/cactus_small_A.gltf",
} as const;

Object.values(FURN).forEach((path) => useGLTF.preload(path));

function Prop({
  path,
  position,
  rotation = [0, 0, 0],
  scale = 1,
}: {
  path: string;
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: number | [number, number, number];
}) {
  const { scene } = useGLTF(path);
  return <Clone object={scene} position={position} rotation={rotation} scale={scale} castShadow receiveShadow />;
}

function Hotspot({
  position,
  label,
  accent,
  panel,
  voice,
}: {
  position: [number, number, number];
  label: string;
  accent: string;
  panel: HudPanel;
  voice?: boolean;
}) {
  const { openPanel, setVoiceOpen } = useCity();
  const activate = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    if (voice) setVoiceOpen(true);
    openPanel(panel);
  };

  return (
    <group position={position} onClick={activate}>
      <mesh position={[0, 0.92, 0]} castShadow>
        <boxGeometry args={[1.15, 1.15, 0.55]} />
        <meshStandardMaterial color="#141b22" metalness={0.55} roughness={0.32} />
      </mesh>
      <mesh position={[0, 1.55, -0.28]} rotation={[-0.18, 0, 0]}>
        <boxGeometry args={[0.95, 0.58, 0.05]} />
        <meshStandardMaterial color="#070d14" emissive={accent} emissiveIntensity={0.55} roughness={0.22} />
      </mesh>
      <mesh position={[0, 0.08, 0]}>
        <cylinderGeometry args={[0.55, 0.62, 0.08, 20]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.35} roughness={0.4} />
      </mesh>
      <Text
        position={[0, 2.05, 0]}
        fontSize={0.16}
        color="#f2f6f8"
        anchorX="center"
        outlineWidth={0.014}
        outlineColor="#05080c"
      >
        TAP · {label}
      </Text>
    </group>
  );
}

function ThemeFurniture({
  theme,
  width,
  depth,
  height,
  accent,
}: {
  theme: RoomTheme;
  width: number;
  depth: number;
  height: number;
  accent: string;
}) {
  const wallZ = -depth / 2 + 0.55;
  const side = Math.min(width / 2 - 1.15, 3.1);

  return (
    <>
      <Prop path={FURN.rug} position={[0, 0.02, -0.15]} scale={[Math.min(width * 0.55, 4.2), 1, Math.min(depth * 0.45, 3.4)]} />
      <Prop path={FURN.art} position={[-side * 0.35, height * 0.55, wallZ - 0.02]} rotation={[0, 0, 0]} scale={1.15} />
      <Prop path={FURN.artMed} position={[side * 0.45, height * 0.52, wallZ - 0.02]} scale={1.05} />
      <Prop path={FURN.plant} position={[-width / 2 + 0.7, 0, depth / 2 - 1.35]} scale={1.2} />
      <Prop path={FURN.plant} position={[width / 2 - 0.7, 0, depth / 2 - 1.35]} scale={1.1} />
      <Prop path={FURN.lamp} position={[-width / 2 + 0.85, 0, -0.2]} scale={1.05} />

      {theme === "trade" && (
        <>
          <Prop path={FURN.tableLong} position={[-side * 0.7, 0, wallZ + 0.35]} scale={1.05} />
          <Prop path={FURN.tableLong} position={[0, 0, wallZ + 0.35]} scale={1.05} />
          <Prop path={FURN.tableLong} position={[side * 0.7, 0, wallZ + 0.35]} scale={1.05} />
          <Prop path={FURN.chair} position={[-side * 0.7, 0, wallZ + 1.15]} rotation={[0, Math.PI, 0]} />
          <Prop path={FURN.chair} position={[0, 0, wallZ + 1.15]} rotation={[0, Math.PI, 0]} />
          <Prop path={FURN.chair} position={[side * 0.7, 0, wallZ + 1.15]} rotation={[0, Math.PI, 0]} />
          <Prop path={FURN.shelf} position={[-side, 0, 0.15]} rotation={[0, Math.PI / 2, 0]} scale={1.1} />
          <Prop path={FURN.shelf} position={[side, 0, 0.15]} rotation={[0, -Math.PI / 2, 0]} scale={1.1} />
          <Prop path={FURN.books} position={[0, 0.78, wallZ + 0.35]} scale={0.9} />
        </>
      )}

      {theme === "lounge" && (
        <>
          <Prop path={FURN.couch} position={[-side * 0.55, 0, -0.35]} rotation={[0, 0.2, 0]} scale={1.15} />
          <Prop path={FURN.couch} position={[side * 0.55, 0, -0.35]} rotation={[0, -0.2, 0]} scale={1.15} />
          <Prop path={FURN.tableLow} position={[0, 0, 0.35]} scale={1.2} />
          <Prop path={FURN.armchair} position={[-side, 0, 0.65]} rotation={[0, 0.9, 0]} />
          <Prop path={FURN.armchair} position={[side, 0, 0.65]} rotation={[0, -0.9, 0]} />
          <Prop path={FURN.cabinet} position={[0, 0, wallZ + 0.2]} scale={1.1} />
          <Prop path={FURN.lampTable} position={[0.7, 0, 0.35]} scale={1} />
        </>
      )}

      {theme === "market" && (
        <>
          <Prop path={FURN.tableLong} position={[0, 0, wallZ + 0.25]} scale={[1.35, 1, 1.1]} />
          <Prop path={FURN.cabinet} position={[-side, 0, -0.1]} rotation={[0, Math.PI / 2, 0]} />
          <Prop path={FURN.cabinet} position={[side, 0, -0.1]} rotation={[0, -Math.PI / 2, 0]} />
          <Prop path={FURN.shelf} position={[-side * 0.35, 0, wallZ + 0.15]} scale={1} />
          <Prop path={FURN.stool} position={[-0.9, 0, wallZ + 1.1]} />
          <Prop path={FURN.stool} position={[0.9, 0, wallZ + 1.1]} />
          <Prop path={FURN.books} position={[0.2, 0.78, wallZ + 0.25]} />
        </>
      )}

      {theme === "club" && (
        <>
          <mesh position={[0, 0.04, -0.15]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[Math.min(width - 1.5, 5.4), Math.min(depth - 2.6, 4)]} />
            <meshStandardMaterial color="#17121c" emissive={accent} emissiveIntensity={0.16} metalness={0.4} roughness={0.4} />
          </mesh>
          <Prop path={FURN.tableLong} position={[0, 0, wallZ + 0.35]} scale={1.2} />
          <Prop path={FURN.stool} position={[-1.1, 0, wallZ + 1.15]} />
          <Prop path={FURN.stool} position={[0, 0, wallZ + 1.15]} />
          <Prop path={FURN.stool} position={[1.1, 0, wallZ + 1.15]} />
          <Prop path={FURN.armchair} position={[-side, 0, 0.25]} rotation={[0, 0.7, 0]} />
          <Prop path={FURN.armchair} position={[side, 0, 0.25]} rotation={[0, -0.7, 0]} />
          <Prop path={FURN.lamp} position={[side * 0.2, 0, -0.8]} scale={1.1} />
        </>
      )}

      {theme === "theater" && (
        <>
          <mesh position={[0, height * 0.52, wallZ - 0.05]}>
            <boxGeometry args={[Math.min(width - 1, 5.8), Math.min(height * 0.5, 2.1), 0.08]} />
            <meshStandardMaterial color="#0b1018" emissive="#d7e4f2" emissiveIntensity={0.4} roughness={0.22} />
          </mesh>
          <Prop path={FURN.armchair} position={[-1.25, 0, 0.4]} rotation={[0, 0.1, 0]} />
          <Prop path={FURN.armchair} position={[0, 0, 0.6]} />
          <Prop path={FURN.armchair} position={[1.25, 0, 0.4]} rotation={[0, -0.1, 0]} />
          <Prop path={FURN.tableSmall} position={[0, 0, 1.35]} scale={0.9} />
          <Prop path={FURN.shelf} position={[-side, 0, -0.4]} rotation={[0, Math.PI / 2, 0]} />
        </>
      )}

      {theme === "hq" && (
        <>
          <Prop path={FURN.tableLong} position={[0, 0, wallZ + 0.3]} scale={[1.4, 1, 1.15]} />
          <Prop path={FURN.chair} position={[-0.8, 0, wallZ + 1.2]} rotation={[0, Math.PI, 0]} />
          <Prop path={FURN.chair} position={[0.8, 0, wallZ + 1.2]} rotation={[0, Math.PI, 0]} />
          <Prop path={FURN.shelf} position={[-side, 0, 0.2]} rotation={[0, Math.PI / 2, 0]} scale={1.15} />
          <Prop path={FURN.cabinet} position={[side, 0, 0.2]} rotation={[0, -Math.PI / 2, 0]} />
          <Prop path={FURN.books} position={[-0.3, 0.78, wallZ + 0.3]} />
          <Prop path={FURN.lampTable} position={[1.1, 0, wallZ + 0.3]} />
        </>
      )}

      {theme === "launch" && (
        <>
          <mesh position={[0, 0.2, -0.15]} receiveShadow>
            <cylinderGeometry args={[1.35, 1.6, 0.4, 32]} />
            <meshStandardMaterial color="#2c2618" metalness={0.35} roughness={0.55} />
          </mesh>
          <mesh position={[0, 0.48, -0.15]}>
            <cylinderGeometry args={[0.9, 1.1, 0.14, 32]} />
            <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.42} roughness={0.38} />
          </mesh>
          <Prop path={FURN.stool} position={[-side, 0, wallZ + 0.45]} />
          <Prop path={FURN.stool} position={[side, 0, wallZ + 0.45]} />
          <Prop path={FURN.cabinet} position={[0, 0, wallZ + 0.15]} scale={0.95} />
        </>
      )}

      {theme === "lobby" && (
        <>
          <Prop path={FURN.table} position={[0, 0, wallZ + 0.35]} scale={1.15} />
          <Prop path={FURN.chair} position={[-0.7, 0, wallZ + 1.15]} rotation={[0, Math.PI, 0]} />
          <Prop path={FURN.chair} position={[0.7, 0, wallZ + 1.15]} rotation={[0, Math.PI, 0]} />
          <Prop path={FURN.couch} position={[-side * 0.75, 0, 0.25]} rotation={[0, 0.4, 0]} />
          <Prop path={FURN.armchair} position={[side * 0.75, 0, 0.25]} rotation={[0, -0.4, 0]} />
          <Prop path={FURN.shelf} position={[side, 0, -0.55]} rotation={[0, -Math.PI / 2, 0]} />
          <Prop path={FURN.books} position={[0.15, 0.78, wallZ + 0.35]} />
        </>
      )}
    </>
  );
}

function ThemeHotspots({
  theme,
  building,
  depth,
  width,
}: {
  theme: RoomTheme;
  building: BuildingDefinition;
  depth: number;
  width: number;
}) {
  const panel = panelForBuilding(building);
  const accent = building.accent;
  const back = -depth / 2 + 1.15;
  const side = Math.min(width / 2 - 1.4, 2.6);

  const secondary: HudPanel =
    theme === "trade" ? "token" : theme === "lounge" || theme === "club" ? "chat" : theme === "market" ? "marketplace" : theme === "theater" ? "events" : theme === "hq" ? "missions" : theme === "launch" ? "launch" : "live";

  return (
    <>
      <Hotspot position={[0, 0, back]} label={building.interaction?.toUpperCase() ?? "EXPLORE"} accent={accent} panel={panel} voice={building.interaction === "voice"} />
      <Hotspot position={[-side, 0, 0.15]} label={secondary.toUpperCase()} accent={accent} panel={secondary} />
      {(theme === "lounge" || theme === "club") && (
        <Hotspot position={[side, 0, 0.15]} label="VOICE" accent={accent} panel="voice" voice />
      )}
      {(theme === "trade" || theme === "market") && (
        <Hotspot position={[side, 0, 0.15]} label="LIVE" accent={accent} panel="live" />
      )}
    </>
  );
}

/**
 * Walk-in interiors — KayKit furniture + glowing tap stations so every
 * venue has things to look at and actually do.
 */
export function InteriorRoom({
  building,
  onRequestExit,
}: {
  building: BuildingDefinition;
  onRequestExit: () => void;
}) {
  const theme = resolveRoomTheme(building);
  const w = Math.max(5.2, Math.min(14, building.size.width - 0.8));
  const d = Math.max(5.2, Math.min(14, building.size.depth - 0.8));
  const h = Math.min(4.4, Math.max(3.3, building.size.height * 0.32));
  const { x, z } = building.position;
  const floorColor = theme === "launch" ? "#39311c" : theme === "club" ? "#1a1520" : building.color;

  return (
    <group position={[x, 0, z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]} receiveShadow>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color={floorColor} roughness={0.58} metalness={0.22} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.055, d / 2 - 1.55]}>
        <planeGeometry args={[Math.min(w - 1, 3.4), 1.15]} />
        <meshStandardMaterial color="#151b20" emissive={building.accent} emissiveIntensity={0.14} roughness={0.45} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, h, 0]}>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color="#1c2228" roughness={0.78} side={2} />
      </mesh>
      {[
        { pos: [0, h / 2, -d / 2] as const, size: [w, h, 0.18] as const },
        { pos: [0, h / 2, d / 2] as const, size: [w, h, 0.18] as const },
        { pos: [-w / 2, h / 2, 0] as const, size: [0.18, h, d] as const },
        { pos: [w / 2, h / 2, 0] as const, size: [0.18, h, d] as const },
      ].map((wall, i) => (
        <mesh key={i} position={wall.pos} castShadow receiveShadow>
          <boxGeometry args={wall.size} />
          <meshStandardMaterial color={building.color} roughness={0.7} metalness={0.18} />
        </mesh>
      ))}
      <mesh position={[0, h - 0.16, 0]}>
        <boxGeometry args={[w * 0.92, 0.07, d * 0.92]} />
        <meshStandardMaterial color={building.accent} emissive={building.accent} emissiveIntensity={0.4} roughness={0.42} />
      </mesh>
      <pointLight position={[0, h - 0.45, 0]} intensity={1.25} distance={12} color="#efe8d8" />
      <pointLight position={[0, 1.7, -d / 2 + 0.7]} intensity={0.55} distance={8} color={building.accent} />

      <Text
        position={[0, h - 0.55, d / 2 - 0.22]}
        fontSize={0.26}
        color="#eef2f4"
        anchorX="center"
        outlineWidth={0.02}
        outlineColor="#12161a"
      >
        {building.name.toUpperCase()}
      </Text>
      <Text position={[0, h - 0.95, -d / 2 + 0.25]} fontSize={0.22} color={building.accent} anchorX="center">
        {roomTitle(theme, building)}
      </Text>

      <ThemeFurniture theme={theme} width={w} depth={d} height={h} accent={building.accent} />
      <ThemeHotspots theme={theme} building={building} depth={d} width={w} />

      <mesh
        position={[0, 0.06, d / 2 - 0.9]}
        rotation={[-Math.PI / 2, 0, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onRequestExit();
        }}
      >
        <circleGeometry args={[0.72, 24]} />
        <meshStandardMaterial color="#6a8f6e" emissive="#3d5c3a" emissiveIntensity={0.28} roughness={0.55} />
      </mesh>
      <Text
        position={[0, 1.1, d / 2 - 0.9]}
        fontSize={0.26}
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
