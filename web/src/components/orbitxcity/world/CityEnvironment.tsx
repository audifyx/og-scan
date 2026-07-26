import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Stars, Text } from "@react-three/drei";
import * as THREE from "three";
import { NYC_DEMO_BLOCK } from "@/lib/orbitxcity/demoBlock";
import type { ScreenerRow } from "@/lib/orbitxcity/marketData";
import type { CityId, WorldBlockConfig } from "@/lib/orbitxcity/types";
import { Ground } from "./Ground";
import { BuildingMesh } from "./BuildingMesh";
import { BillboardMesh } from "./BillboardMesh";
import { GraffitiLayer } from "./GraffitiLayer";
import { Skyline } from "./Skyline";
import { StreetProps } from "./StreetProps";
import { NPCs } from "./NPCs";
import { Drones } from "./Drones";
import { RocketShow } from "./RocketShow";
import { MegaScreen } from "./MegaScreen";
import { OxiGuide } from "./OxiGuide";
import { Park } from "./Park";
import { Traffic } from "./Traffic";

function cityTheme(cityId: CityId) {
  switch (cityId) {
    case "miami":
      return { primary: "#3de7ff", secondary: "#7fffd4", warm: "#ff8bd1", background: "#04101a", fog: "#04101a" };
    case "la":
      return { primary: "#ff4d9a", secondary: "#a78bfa", warm: "#f5c542", background: "#090612", fog: "#090612" };
    case "nyc":
    case "boston":
    default:
      return { primary: "#17ff4d", secondary: "#3de7ff", warm: "#ff4d9a", background: "#04070f", fog: "#04070f" };
  }
}

function marketScreensFor(cityId: CityId): Array<{ position: [number, number, number]; rotationY: number; width: number; height: number }> {
  switch (cityId) {
    case "miami":
      return [
        { position: [-9, 6.5, 24], rotationY: Math.PI * 0.08, width: 7.2, height: 4 },
        { position: [24, 6, -15], rotationY: Math.PI * 0.82, width: 6.2, height: 3.5 },
      ];
    case "la":
      return [
        { position: [0, 9.5, 13.8], rotationY: Math.PI, width: 8.4, height: 4.6 },
        { position: [38, 10.5, 4.8], rotationY: -Math.PI / 2, width: 7, height: 4 },
      ];
    case "nyc":
    case "boston":
    default:
      return [
        { position: [18, 11.5, 15.4], rotationY: Math.PI * 0.78, width: 8.5, height: 4.8 },
        { position: [-4.2, 6.2, 17.8], rotationY: Math.PI * -0.12, width: 6.5, height: 3.6 },
      ];
  }
}

function HqHologram({ block }: { block: WorldBlockConfig }) {
  const ring = useRef<THREE.Mesh>(null);
  const ringB = useRef<THREE.Mesh>(null);
  const hq = block.buildings.find((b) => b.kind === "hq") ?? block.buildings[0];
  const position = hq?.position ?? block.spawn;
  const primary = hq?.accent ?? "#17ff4d";
  const secondary = block.cityId === "la" ? "#a78bfa" : block.cityId === "miami" ? "#7fffd4" : "#3de7ff";
  const height = (hq?.size.height ?? 14) + 3.4;
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (ring.current) {
      ring.current.rotation.z = t * 0.5;
      ring.current.position.y = height + Math.sin(t * 1.2) * 0.3;
    }
    if (ringB.current) {
      ringB.current.rotation.z = -t * 0.8;
      ringB.current.position.y = height + Math.sin(t * 1.2) * 0.3;
    }
  });
  return (
    <group position={[position.x, 0, position.z]}>
      <mesh ref={ring} position={[0, height, 0]}>
        <torusGeometry args={[2.2, 0.06, 10, 48]} />
        <meshBasicMaterial color={primary} transparent opacity={0.7} toneMapped={false} />
      </mesh>
      <mesh ref={ringB} position={[0, height, 0]} rotation-x={Math.PI / 3}>
        <torusGeometry args={[1.6, 0.05, 10, 48]} />
        <meshBasicMaterial color={secondary} transparent opacity={0.55} toneMapped={false} />
      </mesh>
      <Text
        position={[0, height, 0]}
        fontSize={0.9}
        color={primary}
        anchorX="center"
        anchorY="middle"
        material-toneMapped={false}
        outlineWidth={0.05}
        outlineColor="#04140a"
      >
        ORBITX
      </Text>
    </group>
  );
}

/** Full scenic layer — env, districts, graffiti, screens, ambient life. */
export function CityEnvironment({ tickerRows, block = NYC_DEMO_BLOCK }: { tickerRows: ScreenerRow[]; block?: WorldBlockConfig }) {
  const theme = cityTheme(block.cityId);
  const screens = marketScreensFor(block.cityId);

  return (
    <group>
      <color attach="background" args={[theme.background]} />
      <fog attach="fog" args={[theme.fog, 38, 150]} />

      <ambientLight intensity={0.55} />
      <hemisphereLight args={["#28406b", "#05070d", 0.6]} />
      <directionalLight
        position={[24, 36, 16]}
        intensity={1.4}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-60}
        shadow-camera-right={60}
        shadow-camera-top={60}
        shadow-camera-bottom={-60}
      />
      <pointLight position={[block.spawn.x, 10, block.spawn.z]} intensity={0.6} color={theme.primary} distance={40} />
      <pointLight position={[-16, 8, 0]} intensity={0.45} color={theme.warm} distance={24} />
      <pointLight position={[16, 8, 0]} intensity={0.45} color="#f5c542" distance={24} />
      <pointLight position={[0, 8, 16]} intensity={0.4} color={theme.secondary} distance={24} />
      <pointLight position={[40, 10, 10]} intensity={0.5} color="#f5c542" distance={30} />
      <pointLight position={[-14, 8, 42]} intensity={0.5} color="#ff4d9a" distance={28} />

      <Stars radius={130} depth={60} count={2200} factor={3.6} saturation={0} fade speed={0.4} />

      <Ground block={block} />
      <Skyline block={block} />
      <StreetProps block={block} />
      <GraffitiLayer block={block} />

      {block.buildings.map((b) => (
        <BuildingMesh key={b.id} building={b} />
      ))}

      {block.billboards.map((bb) => (
        <BillboardMesh key={bb.id} board={bb} />
      ))}

      {/* Live market jumbotrons */}
      {screens.map((screen, index) => (
        <MegaScreen key={`screen-${index}`} rows={tickerRows} {...screen} />
      ))}

      <HqHologram block={block} />
      <RocketShow />
      <NPCs block={block} />
      <Drones />
      <OxiGuide />
      {block.cityId === "nyc" && <Park />}
      <Traffic />

      {/* Central plaza hologram disc */}
      <mesh position={[block.spawn.x, 0.08, block.spawn.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[3.2, 48]} />
        <meshStandardMaterial color="#0a1410" emissive={theme.primary} emissiveIntensity={0.06} metalness={0.5} roughness={0.4} transparent opacity={0.85} />
      </mesh>
      <mesh position={[block.spawn.x, 0.1, block.spawn.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.9, 3.2, 48]} />
        <meshBasicMaterial color={theme.primary} transparent opacity={0.5} toneMapped={false} />
      </mesh>
    </group>
  );
}
