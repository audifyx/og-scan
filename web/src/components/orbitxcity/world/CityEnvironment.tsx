import { Stars } from "@react-three/drei";
import { NYC_DEMO_BLOCK } from "@/lib/orbitxcity/demoBlock";
import { Ground } from "./Ground";
import { BuildingMesh } from "./BuildingMesh";
import { BillboardMesh } from "./BillboardMesh";
import { FloatingTraffic } from "./FloatingTraffic";

/** Static scenic layer — districts, buildings, billboards, sky. */
export function CityEnvironment() {
  const block = NYC_DEMO_BLOCK;

  return (
    <group>
      <color attach="background" args={["#04070f"]} />
      <fog attach="fog" args={["#04070f", 28, 70]} />

      <ambientLight intensity={0.35} />
      <directionalLight
        position={[18, 28, 12]}
        intensity={1.15}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <pointLight position={[0, 10, 0]} intensity={0.6} color="#17ff4d" distance={40} />
      <pointLight position={[-16, 8, 0]} intensity={0.45} color="#ff4d9a" distance={24} />
      <pointLight position={[16, 8, 0]} intensity={0.45} color="#f5c542" distance={24} />
      <pointLight position={[0, 8, 16]} intensity={0.4} color="#3de7ff" distance={24} />

      <Stars radius={80} depth={40} count={1200} factor={3} saturation={0} fade speed={0.4} />

      <FloatingTraffic count={8} />

      <Ground />

      {block.buildings.map((b) => (
        <BuildingMesh key={b.id} building={b} />
      ))}

      {block.billboards.map((bb) => (
        <BillboardMesh key={bb.id} board={bb} />
      ))}

      {/* Central plaza hologram */}
      <mesh position={[0, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[3.2, 48]} />
        <meshStandardMaterial color="#0a1a14" emissive="#17ff4d" emissiveIntensity={0.2} metalness={0.5} roughness={0.4} />
      </mesh>
    </group>
  );
}
