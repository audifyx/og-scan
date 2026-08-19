import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface DroneSpec {
  radius: number;
  height: number;
  speed: number;
  phase: number;
  color: string;
}

const DRONES: DroneSpec[] = [
  { radius: 9, height: 6.5, speed: 0.42, phase: 0, color: "#3de7ff" },
  { radius: 14, height: 8.5, speed: -0.3, phase: 2.1, color: "#ff4d9a" },
  { radius: 19, height: 10.5, speed: 0.24, phase: 4.2, color: "#17ff4d" },
  { radius: 12, height: 12, speed: -0.36, phase: 1.2, color: "#f5c542" },
];

function Drone({ spec, origin }: { spec: DroneSpec; origin: { x: number; z: number } }) {
  const group = useRef<THREE.Group>(null);
  const lamp = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime * spec.speed + spec.phase;
    if (group.current) {
      group.current.position.set(
        origin.x + Math.cos(t) * spec.radius,
        spec.height + Math.sin(clock.elapsedTime * 1.6 + spec.phase) * 0.4,
        origin.z + Math.sin(t) * spec.radius,
      );
      group.current.rotation.y = -t + Math.PI / 2;
    }
    if (lamp.current) {
      const mat = lamp.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.5 + Math.abs(Math.sin(clock.elapsedTime * 4 + spec.phase)) * 0.5;
    }
  });

  return (
    <group ref={group}>
      <mesh castShadow>
        <boxGeometry args={[0.6, 0.18, 0.6]} />
        <meshStandardMaterial color="#141c2c" metalness={0.7} roughness={0.3} />
      </mesh>
      {[-0.32, 0.32].flatMap((x) =>
        [-0.32, 0.32].map((z) => (
          <mesh key={`rotor-${x}-${z}`} position={[x, 0.12, z]}>
            <cylinderGeometry args={[0.16, 0.16, 0.04, 10]} />
            <meshStandardMaterial color="#0b1120" metalness={0.6} roughness={0.4} />
          </mesh>
        )),
      )}
      <mesh ref={lamp} position={[0, -0.14, 0]}>
        <sphereGeometry args={[0.09, 10, 10]} />
        <meshBasicMaterial color={spec.color} transparent toneMapped={false} />
      </mesh>
      {/* Ad streamer */}
      <mesh position={[0, -0.55, 0]}>
        <planeGeometry args={[1.6, 0.5]} />
        <meshBasicMaterial color={spec.color} transparent opacity={0.35} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** Ad drones circling the district spawn / HQ. */
export function Drones({ origin = { x: 0, z: 0 } }: { origin?: { x: number; z: number } }) {
  return (
    <group>
      {DRONES.map((d, i) => (
        <Drone key={i} spec={d} origin={origin} />
      ))}
    </group>
  );
}
