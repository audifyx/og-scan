import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/** Steam puffs that rise and fade in a loop above the bowl. */
function Steam() {
  const refs = useRef<(THREE.Mesh | null)[]>([]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    refs.current.forEach((m, i) => {
      if (!m) return;
      const phase = (t * 0.35 + i / 3) % 1;
      m.position.y = 0.22 + phase * 0.25;
      m.position.x = Math.sin(t * 1.4 + i * 2.1) * 0.02 + (i - 1) * 0.035;
      const mat = m.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.28 * Math.sin(phase * Math.PI);
      const s = 0.05 + phase * 0.05;
      m.scale.set(s, s, s);
    });
  });

  return (
    <group>
      {[0, 1, 2].map((i) => (
        <mesh
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
        >
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

const NOODLES: Array<[number, number, number, number, number, number]> = [
  // x, z, tiltX, tiltZ, torusRadius, rotationY
  [0.03, 0.02, 0.25, 0.15, 0.062, 0.4],
  [-0.045, 0.01, -0.2, 0.3, 0.072, 1.7],
  [0.01, -0.05, 0.35, -0.2, 0.055, 2.9],
  [-0.02, 0.055, -0.3, -0.25, 0.078, 0.9],
  [0.055, -0.02, 0.15, -0.35, 0.06, 2.2],
  [-0.01, -0.01, 0.1, 0.1, 0.07, 3.6],
];

export function RamenBowl() {
  return (
    <group>
      {/* Bowl: deep red outside */}
      <mesh position={[0, 0.06, 0]}>
        <cylinderGeometry args={[0.16, 0.1, 0.12, 32]} />
        <meshStandardMaterial color="#8f1f1f" roughness={0.35} metalness={0.05} />
      </mesh>
      {/* Bowl inner cream rim ring */}
      <mesh position={[0, 0.115, 0]}>
        <cylinderGeometry args={[0.155, 0.148, 0.015, 32, 1, true]} />
        <meshStandardMaterial color="#f5e9d0" roughness={0.5} side={THREE.DoubleSide} />
      </mesh>
      {/* Foot */}
      <mesh position={[0, 0.008, 0]}>
        <cylinderGeometry args={[0.06, 0.07, 0.018, 24]} />
        <meshStandardMaterial color="#6e1616" roughness={0.4} />
      </mesh>

      {/* Broth surface */}
      <mesh position={[0, 0.112, 0]} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[0.145, 32]} />
        <meshStandardMaterial color="#c46a1e" emissive="#7a3a08" emissiveIntensity={0.45} roughness={0.25} />
      </mesh>

      {/* Noodles */}
      {NOODLES.map(([x, z, tx, tz, r, ry], i) => (
        <mesh key={i} position={[x, 0.118, z]} rotation={[tx, ry, tz]}>
          <torusGeometry args={[r, 0.012, 10, 24]} />
          <meshStandardMaterial color="#f2d98c" roughness={0.55} />
        </mesh>
      ))}

      {/* Egg half */}
      <group position={[0.085, 0.118, 0.045]}>
        <mesh scale={[1, 0.6, 1]}>
          <sphereGeometry args={[0.028, 20, 16]} />
          <meshStandardMaterial color="#faf3e3" roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.012, 0]}>
          <sphereGeometry args={[0.011, 16, 12]} />
          <meshStandardMaterial color="#f59b0c" emissive="#b45309" emissiveIntensity={0.3} roughness={0.35} />
        </mesh>
      </group>

      {/* Chopsticks resting diagonally across the rim */}
      <group rotation-y={0.6}>
        <mesh position={[0.02, 0.155, 0.02]} rotation={[0, 0, Math.PI / 2 - 0.18]}>
          <cylinderGeometry args={[0.008, 0.008, 0.4, 10]} />
          <meshStandardMaterial color="#a9743c" roughness={0.6} />
        </mesh>
        <mesh position={[-0.015, 0.168, 0.035]} rotation={[0.12, 0, Math.PI / 2 - 0.22]}>
          <cylinderGeometry args={[0.008, 0.008, 0.4, 10]} />
          <meshStandardMaterial color="#b9834a" roughness={0.6} />
        </mesh>
      </group>

      <Steam />
    </group>
  );
}
