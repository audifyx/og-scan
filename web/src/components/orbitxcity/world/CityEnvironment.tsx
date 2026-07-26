import { Text } from "@react-three/drei";
import { NYC_DEMO_BLOCK } from "@/lib/orbitxcity/demoBlock";
import type { ScreenerRow } from "@/lib/orbitxcity/marketData";
import type { CityId, WorldBlockConfig } from "@/lib/orbitxcity/types";
import { useCity } from "@/pages/orbitxcity/CityProvider";
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
import { SkyCycle } from "./SkyCycle";
import { UrbanNature } from "./UrbanNature";

function cityTheme(cityId: CityId) {
  // Soft overcast daylight — atmospheric haze instead of neon-night void.
  switch (cityId) {
    case "miami":
      return {
        primary: "#5ec8b8",
        secondary: "#7a9eae",
        warm: "#c4a574",
        background: "#8fa6b0",
        fog: "#9ab8c0",
        hemiSky: "#c5d4dc",
        hemiGround: "#3d4a3a",
        sun: "#e8e0d0",
      };
    case "la":
      return {
        primary: "#b89a78",
        secondary: "#8a7a90",
        warm: "#d4b896",
        background: "#9aa0a8",
        fog: "#a8aeb4",
        hemiSky: "#d0d4d8",
        hemiGround: "#4a453c",
        sun: "#efe6d4",
      };
    case "nyc":
    case "boston":
    default:
      return {
        primary: "#6a8f6e",
        secondary: "#7a92a0",
        warm: "#c4a574",
        background: "#8b9aa3",
        fog: "#9aa7ae",
        hemiSky: "#c8d2d8",
        hemiGround: "#3f4a38",
        sun: "#ebe4d6",
      };
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

function HqBeacon({ block }: { block: WorldBlockConfig }) {
  const hq = block.buildings.find((b) => b.kind === "hq") ?? block.buildings[0];
  const position = hq?.position ?? block.spawn;
  const height = (hq?.size.height ?? 14) + 2.2;
  return (
    <group position={[position.x, 0, position.z]}>
      <mesh position={[0, height, 0]}>
        <cylinderGeometry args={[0.08, 0.12, 1.8, 8]} />
        <meshStandardMaterial color="#4a5560" metalness={0.65} roughness={0.4} />
      </mesh>
      <mesh position={[0, height + 1.1, 0]}>
        <sphereGeometry args={[0.22, 12, 12]} />
        <meshStandardMaterial color="#d8e0e6" emissive="#a8b8c4" emissiveIntensity={0.35} metalness={0.2} roughness={0.35} />
      </mesh>
      <Text
        position={[0, height + 1.8, 0]}
        fontSize={0.55}
        color="#e8eef2"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.03}
        outlineColor="#1a2228"
      >
        ORBITX
      </Text>
    </group>
  );
}

/** Full scenic layer — env, districts, graffiti, screens, ambient life. */
export function CityEnvironment({ tickerRows, block = NYC_DEMO_BLOCK }: { tickerRows: ScreenerRow[]; block?: WorldBlockConfig }) {
  const theme = cityTheme(block.cityId);
  const { quality } = useCity();
  const high = quality === "high";
  const screens = high ? marketScreensFor(block.cityId) : marketScreensFor(block.cityId).slice(0, 1);

  return (
    <group>
      <color attach="background" args={[theme.background]} />
      <fog attach="fog" args={[theme.fog, high ? 55 : 40, high ? 195 : 130]} />

      <SkyCycle block={block} />
      <ambientLight intensity={0.18} />
      {high && <directionalLight position={[-28, 22, -16]} intensity={0.28} color="#b8c4ce" />}
      <pointLight position={[block.spawn.x, 8, block.spawn.z]} intensity={0.22} color="#dfe6ea" distance={28} />

      <Ground block={block} />
      <UrbanNature block={block} lite={!high} />
      {high && <Skyline block={block} />}
      <StreetProps block={block} />
      {high && <GraffitiLayer block={block} />}

      {block.buildings.map((b) => (
        <BuildingMesh key={b.id} building={b} />
      ))}

      {block.billboards.map((bb) => (
        <BillboardMesh key={bb.id} board={bb} />
      ))}

      {screens.map((screen, index) => (
        <MegaScreen key={`screen-${index}`} rows={tickerRows} {...screen} />
      ))}

      <HqBeacon block={block} />
      {high && <RocketShow />}
      <NPCs block={block} count={high ? 12 : 4} />
      {high && <Drones />}
      {high && <OxiGuide />}
      {high && block.cityId === "nyc" && <Park />}
      <Traffic count={high ? 6 : 2} />

      {/* Stone plaza marker — readable, not neon disc */}
      <mesh position={[block.spawn.x, 0.06, block.spawn.z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[3.4, 48]} />
        <meshStandardMaterial color="#5a6168" metalness={0.15} roughness={0.82} />
      </mesh>
      <mesh position={[block.spawn.x, 0.08, block.spawn.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[3.15, 3.4, 48]} />
        <meshStandardMaterial color="#3e454c" metalness={0.2} roughness={0.7} />
      </mesh>
    </group>
  );
}
