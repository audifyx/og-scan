import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Stars, Text } from "@react-three/drei";
import * as THREE from "three";
import { NYC_DEMO_BLOCK } from "@/lib/orbitxcity/demoBlock";
import type { ScreenerRow } from "@/lib/orbitxcity/marketData";
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

function HqHologram() {
  const ring = useRef<THREE.Mesh>(null);
  const ringB = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (ring.current) {
      ring.current.rotation.z = t * 0.5;
      ring.current.position.y = 17.4 + Math.sin(t * 1.2) * 0.3;
    }
    if (ringB.current) {
      ringB.current.rotation.z = -t * 0.8;
      ringB.current.position.y = 17.4 + Math.sin(t * 1.2) * 0.3;
    }
  });
  return (
    <group position={[0, 0, -16]}>
      <mesh ref={ring} position={[0, 17.4, 0]}>
        <torusGeometry args={[2.2, 0.06, 10, 48]} />
        <meshBasicMaterial color="#17ff4d" transparent opacity={0.7} toneMapped={false} />
      </mesh>
      <mesh ref={ringB} position={[0, 17.4, 0]} rotation-x={Math.PI / 3}>
        <torusGeometry args={[1.6, 0.05, 10, 48]} />
        <meshBasicMaterial color="#3de7ff" transparent opacity={0.55} toneMapped={false} />
      </mesh>
      <Text
        position={[0, 17.4, 0]}
        fontSize={0.9}
        color="#17ff4d"
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
export function CityEnvironment({ tickerRows }: { tickerRows: ScreenerRow[] }) {
  const block = NYC_DEMO_BLOCK;

  return (
    <group>
      <color attach="background" args={["#04070f"]} />
      <fog attach="fog" args={["#04070f", 30, 90]} />

      <ambientLight intensity={0.55} />
      <hemisphereLight args={["#28406b", "#05070d", 0.6]} />
      <directionalLight
        position={[18, 28, 12]}
        intensity={1.4}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <pointLight position={[0, 10, 0]} intensity={0.6} color="#17ff4d" distance={40} />
      <pointLight position={[-16, 8, 0]} intensity={0.45} color="#ff4d9a" distance={24} />
      <pointLight position={[16, 8, 0]} intensity={0.45} color="#f5c542" distance={24} />
      <pointLight position={[0, 8, 16]} intensity={0.4} color="#3de7ff" distance={24} />

      <Stars radius={90} depth={50} count={1600} factor={3.4} saturation={0} fade speed={0.4} />

      <Ground />
      <Skyline />
      <StreetProps />
      <GraffitiLayer />

      {block.buildings.map((b) => (
        <BuildingMesh key={b.id} building={b} />
      ))}

      {block.billboards.map((bb) => (
        <BillboardMesh key={bb.id} board={bb} />
      ))}

      {/* Live market jumbotrons */}
      <MegaScreen rows={tickerRows} position={[18, 11.5, 15.4]} rotationY={Math.PI * 0.78} width={8.5} height={4.8} />
      <MegaScreen rows={tickerRows} position={[-4.2, 6.2, 17.8]} rotationY={Math.PI * -0.12} width={6.5} height={3.6} />

      <HqHologram />
      <RocketShow />
      <NPCs />
      <Drones />
      <OxiGuide />

      {/* Central plaza hologram disc */}
      <mesh position={[0, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[3.2, 48]} />
        <meshStandardMaterial color="#0a1410" emissive="#17ff4d" emissiveIntensity={0.06} metalness={0.5} roughness={0.4} transparent opacity={0.85} />
      </mesh>
      <mesh position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.9, 3.2, 48]} />
        <meshBasicMaterial color="#17ff4d" transparent opacity={0.5} toneMapped={false} />
      </mesh>
    </group>
  );
}
