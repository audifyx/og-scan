/**
 * Human-scale procedural sedan — Kenney car_sedan.gltf is a ~0.5m toy.
 * Shared by lane traffic and parked curb cars.
 */
export const CITY_CAR_GLOWS = ["#3de7ff", "#00ff9f", "#f5c542", "#a78bfa", "#ff6b35", "#c5a26f"] as const;
export const CITY_CAR_BODIES = ["#2a3a52", "#4a2a2a", "#243848", "#3a3424", "#1e2836", "#3a2430"] as const;

export function CityCarMesh({ glow, body }: { glow: string; body: string }) {
  return (
    <group>
      <mesh position={[0, 0.28, 0]} castShadow>
        <boxGeometry args={[1.05, 0.32, 2.15]} />
        <meshStandardMaterial color={body} metalness={0.55} roughness={0.38} />
      </mesh>
      <mesh position={[0, 0.55, -0.08]} castShadow>
        <boxGeometry args={[0.88, 0.28, 1.15]} />
        <meshStandardMaterial
          color="#2a3848"
          metalness={0.35}
          roughness={0.22}
          emissive={glow}
          emissiveIntensity={0.12}
        />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh position={[side * 0.46, 0.16, 0.68]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.16, 0.16, 0.12, 10]} />
            <meshStandardMaterial color="#111418" roughness={0.7} />
          </mesh>
          <mesh position={[side * 0.46, 0.16, -0.68]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.16, 0.16, 0.12, 10]} />
            <meshStandardMaterial color="#111418" roughness={0.7} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0.32, 1.1]}>
        <boxGeometry args={[0.7, 0.08, 0.06]} />
        <meshBasicMaterial color="#e8f4ff" toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.32, -1.1]}>
        <boxGeometry args={[0.7, 0.08, 0.06]} />
        <meshBasicMaterial color="#ff3b3b" toneMapped={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <planeGeometry args={[1.05, 2.2]} />
        <meshBasicMaterial color={glow} transparent opacity={0.16} toneMapped={false} />
      </mesh>
    </group>
  );
}
