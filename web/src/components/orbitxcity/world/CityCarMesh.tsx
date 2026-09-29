/**
 * Realistic human-scale car mesh built from three.js primitives.
 * GTA-STYLE law: believable proportions, glass cabin, lit details — never blocky.
 *
 * Shared by lane traffic (Traffic.tsx) and parked curb props (PropScatter.tsx).
 * Drivable cars use DrivableCar.tsx (animated wheels, driver, lean) instead.
 *
 * Convention: forward = +Z (headlights at +Z). All dims in meters.
 */
import { isNight } from "@/lib/orbitxcity/dayNight";

export const CITY_CAR_GLOWS = ["#3de7ff", "#00ff9f", "#f5c542", "#a78bfa", "#ff6b35", "#c5a26f"] as const;
export const CITY_CAR_BODIES = ["#2a3a52", "#4a2a2a", "#243848", "#3a3424", "#1e2836", "#3a2430"] as const;

const GLASS = "#101c28";

function Wheel({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0.34, z]}>
      {/* tire */}
      <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.34, 0.34, 0.26, 14]} />
        <meshStandardMaterial color="#0c0e11" roughness={0.85} />
      </mesh>
      {/* rim */}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.19, 0.19, 0.27, 10]} />
        <meshStandardMaterial color="#9aa4ae" metalness={0.85} roughness={0.3} />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.07, 0.07, 0.28, 8]} />
        <meshStandardMaterial color="#2b3138" metalness={0.6} roughness={0.5} />
      </mesh>
    </group>
  );
}

export function CityCarMesh({ glow, body }: { glow: string; body: string }) {
  const night = isNight();
  return (
    <group>
      {/* lower body */}
      <mesh position={[0, 0.58, 0]} castShadow>
        <boxGeometry args={[1.82, 0.52, 4.35]} />
        <meshStandardMaterial color={body} metalness={0.6} roughness={0.32} />
      </mesh>
      {/* hood + trunk shoulders */}
      <mesh position={[0, 0.82, 1.35]} castShadow>
        <boxGeometry args={[1.7, 0.22, 1.5]} />
        <meshStandardMaterial color={body} metalness={0.6} roughness={0.32} />
      </mesh>
      <mesh position={[0, 0.84, -1.45]} castShadow>
        <boxGeometry args={[1.72, 0.24, 1.15]} />
        <meshStandardMaterial color={body} metalness={0.6} roughness={0.32} />
      </mesh>
      {/* glass cabin */}
      <mesh position={[0, 1.08, -0.15]} castShadow>
        <boxGeometry args={[1.58, 0.5, 1.9]} />
        <meshStandardMaterial
          color={GLASS}
          metalness={0.4}
          roughness={0.12}
          emissive={glow}
          emissiveIntensity={0.14}
        />
      </mesh>
      {/* windshield slope */}
      <mesh position={[0, 1.02, 0.92]} rotation={[0.42, 0, 0]}>
        <boxGeometry args={[1.56, 0.06, 0.95]} />
        <meshStandardMaterial color={GLASS} metalness={0.4} roughness={0.1} />
      </mesh>
      {/* rear glass slope */}
      <mesh position={[0, 1.02, -1.22]} rotation={[-0.42, 0, 0]}>
        <boxGeometry args={[1.56, 0.06, 0.9]} />
        <meshStandardMaterial color={GLASS} metalness={0.4} roughness={0.1} />
      </mesh>
      {/* roof panel */}
      <mesh position={[0, 1.32, -0.15]}>
        <boxGeometry args={[1.5, 0.07, 1.05]} />
        <meshStandardMaterial color={body} metalness={0.6} roughness={0.32} />
      </mesh>

      {/* bumpers */}
      <mesh position={[0, 0.42, 2.2]}>
        <boxGeometry args={[1.86, 0.3, 0.18]} />
        <meshStandardMaterial color="#14171b" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.42, -2.2]}>
        <boxGeometry args={[1.86, 0.3, 0.18]} />
        <meshStandardMaterial color="#14171b" roughness={0.6} />
      </mesh>

      {/* headlights */}
      {[-0.58, 0.58].map((x) => (
        <mesh key={x} position={[x, 0.66, 2.19]}>
          <boxGeometry args={[0.42, 0.14, 0.06]} />
          <meshStandardMaterial
            color="#dfeeff"
            emissive="#eaf6ff"
            emissiveIntensity={night ? 2.4 : 0.7}
            toneMapped={false}
          />
        </mesh>
      ))}
      {/* taillight bar */}
      <mesh position={[0, 0.68, -2.19]}>
        <boxGeometry args={[1.3, 0.12, 0.06]} />
        <meshStandardMaterial color="#ff3b3b" emissive="#ff2b2b" emissiveIntensity={night ? 1.6 : 0.6} toneMapped={false} />
      </mesh>
      {/* side mirrors */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.98, 1.02, 0.72]}>
          <boxGeometry args={[0.14, 0.1, 0.18]} />
          <meshStandardMaterial color={body} metalness={0.6} roughness={0.35} />
        </mesh>
      ))}
      {/* door handles */}
      {[-1, 1].map((s) =>
        [-0.1, 0.55].map((z) => (
          <mesh key={`${s}${z}`} position={[s * 0.92, 0.78, z]}>
            <boxGeometry args={[0.03, 0.05, 0.22]} />
            <meshStandardMaterial color="#0e1114" roughness={0.5} />
          </mesh>
        )),
      )}

      <Wheel x={-0.88} z={1.38} />
      <Wheel x={0.88} z={1.38} />
      <Wheel x={-0.88} z={-1.38} />
      <Wheel x={0.88} z={-1.38} />

      {/* underglow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
        <planeGeometry args={[2.0, 4.5]} />
        <meshBasicMaterial color={glow} transparent opacity={0.14} toneMapped={false} />
      </mesh>
    </group>
  );
}
