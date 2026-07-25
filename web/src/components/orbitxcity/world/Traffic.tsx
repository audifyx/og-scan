import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface CarSpec {
  /** Rectangular loop the car drives around (lane offset already applied). */
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  speed: number;
  phase: number;
  body: string;
  glow: string;
  reverse: boolean;
}

const CARS: CarSpec[] = [
  { minX: -26.5, maxX: 26.5, minZ: -26.5, maxZ: 26.5, speed: 7, phase: 0, body: "#131c2e", glow: "#3de7ff", reverse: false },
  { minX: -25.3, maxX: 25.3, minZ: -25.3, maxZ: 25.3, speed: 6, phase: 0.45, body: "#241430", glow: "#ff4d9a", reverse: true },
  { minX: -26.5, maxX: 26.5, minZ: -26.5, maxZ: 26.5, speed: 8, phase: 0.7, body: "#102518", glow: "#17ff4d", reverse: false },
  { minX: -29.6, maxX: 54, minZ: -29.6, maxZ: 29.6, speed: 9, phase: 0.2, body: "#2a2110", glow: "#f5c542", reverse: false },
  { minX: -54, maxX: 29.6, minZ: -29.6, maxZ: 29.6, speed: 8.5, phase: 0.6, body: "#1c1430", glow: "#a78bfa", reverse: true },
  { minX: -54, maxX: 54, minZ: -26.2, maxZ: 26.2, speed: 10, phase: 0.9, body: "#301620", glow: "#ff6b35", reverse: false },
];

/** Position along a rectangular loop for parameter t ∈ [0,1). */
function loopPoint(spec: CarSpec, t: number): { x: number; z: number; yaw: number } {
  const w = spec.maxX - spec.minX;
  const d = spec.maxZ - spec.minZ;
  const perimeter = 2 * (w + d);
  let dist = (t % 1) * perimeter;
  if (spec.reverse) dist = perimeter - dist;

  if (dist < w) return { x: spec.minX + dist, z: spec.minZ, yaw: spec.reverse ? -Math.PI / 2 : Math.PI / 2 };
  dist -= w;
  if (dist < d) return { x: spec.maxX, z: spec.minZ + dist, yaw: spec.reverse ? Math.PI : 0 };
  dist -= d;
  if (dist < w) return { x: spec.maxX - dist, z: spec.maxZ, yaw: spec.reverse ? Math.PI / 2 : -Math.PI / 2 };
  dist -= w;
  return { x: spec.minX, z: spec.maxZ - dist, yaw: spec.reverse ? 0 : Math.PI };
}

function HoverCar({ spec }: { spec: CarSpec }) {
  const group = useRef<THREE.Group>(null);
  const t = useRef(spec.phase);

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const perimeter = 2 * (spec.maxX - spec.minX + spec.maxZ - spec.minZ);
    t.current = (t.current + (spec.speed * dt) / perimeter) % 1;
    const p = loopPoint(spec, t.current);
    if (!group.current) return;
    group.current.position.set(p.x, 0.42 + Math.sin(clock.elapsedTime * 5 + spec.phase * 10) * 0.05, p.z);
    // Smooth heading
    let dy = p.yaw - group.current.rotation.y;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    group.current.rotation.y += dy * Math.min(1, dt * 8);
  });

  return (
    <group ref={group}>
      {/* Body */}
      <mesh castShadow>
        <boxGeometry args={[0.9, 0.32, 2]} />
        <meshStandardMaterial color={spec.body} metalness={0.8} roughness={0.25} />
      </mesh>
      {/* Cabin */}
      <mesh position={[0, 0.26, -0.1]}>
        <boxGeometry args={[0.7, 0.24, 1]} />
        <meshStandardMaterial color="#0a1220" metalness={0.6} roughness={0.2} emissive="#20304a" emissiveIntensity={0.4} />
      </mesh>
      {/* Headlights */}
      <mesh position={[0, 0.02, 1.02]}>
        <boxGeometry args={[0.6, 0.08, 0.05]} />
        <meshBasicMaterial color="#e8f4ff" toneMapped={false} />
      </mesh>
      {/* Tail glow */}
      <mesh position={[0, 0.02, -1.02]}>
        <boxGeometry args={[0.6, 0.08, 0.05]} />
        <meshBasicMaterial color="#ff3b3b" toneMapped={false} />
      </mesh>
      {/* Underglow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.2, 0]}>
        <planeGeometry args={[1.2, 2.3]} />
        <meshBasicMaterial color={spec.glow} transparent opacity={0.3} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** Ambient hover-car traffic looping the ring roads. */
export function Traffic() {
  return (
    <group>
      {CARS.map((c, i) => (
        <HoverCar key={i} spec={c} />
      ))}
    </group>
  );
}
