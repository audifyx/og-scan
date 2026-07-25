import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface Drone {
  radius: number;
  height: number;
  speed: number;
  phase: number;
  color: string;
  scale: number;
}

const PALETTE = ["#3de7ff", "#ff4d9a", "#f5c542", "#17ff4d", "#a78bfa"];

/** Ambient neon hover-drones circling the skyline to make the city feel alive. */
export function FloatingTraffic({ count = 7 }: { count?: number }) {
  const drones = useMemo<Drone[]>(
    () =>
      Array.from({ length: count }).map((_, i) => ({
        radius: 14 + (i % 4) * 4.5,
        height: 9 + ((i * 3) % 7),
        speed: 0.12 + (i % 5) * 0.05 * (i % 2 === 0 ? 1 : -1),
        phase: (i / count) * Math.PI * 2,
        color: PALETTE[i % PALETTE.length],
        scale: 0.7 + (i % 3) * 0.25,
      })),
    [count],
  );

  return (
    <group>
      {drones.map((d, i) => (
        <DroneMesh key={i} drone={d} />
      ))}
    </group>
  );
}

function DroneMesh({ drone }: { drone: Drone }) {
  const ref = useRef<THREE.Group>(null);
  const trail = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime * drone.speed + drone.phase;
    const x = Math.cos(t) * drone.radius;
    const z = Math.sin(t) * drone.radius;
    const y = drone.height + Math.sin(t * 2) * 0.6;
    if (ref.current) {
      ref.current.position.set(x, y, z);
      ref.current.rotation.y = -t + Math.PI / 2;
    }
    if (trail.current) {
      const m = trail.current.material as THREE.MeshBasicMaterial;
      m.opacity = 0.25 + Math.sin(clock.elapsedTime * 6 + drone.phase) * 0.1;
    }
  });

  return (
    <group ref={ref} scale={drone.scale}>
      <mesh>
        <capsuleGeometry args={[0.18, 0.6, 4, 8]} />
        <meshStandardMaterial
          color="#0b1220"
          emissive={drone.color}
          emissiveIntensity={0.5}
          metalness={0.6}
          roughness={0.3}
        />
      </mesh>
      {/* Under-glow */}
      <mesh position={[0, -0.28, 0]}>
        <sphereGeometry args={[0.14, 8, 8]} />
        <meshBasicMaterial color={drone.color} />
      </mesh>
      {/* Light trail */}
      <mesh ref={trail} position={[0, 0, -0.7]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.12, 1.4, 8]} />
        <meshBasicMaterial color={drone.color} transparent opacity={0.28} />
      </mesh>
    </group>
  );
}
