import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, Text } from "@react-three/drei";
import * as THREE from "three";

const PAD = { x: 21, z: 6 };
const IDLE_SECONDS = 14;
const BOOST_SECONDS = 4;
const PARTICLES = 90;

/** Launch Arena set piece: countdown, lift-off, exhaust particles, reset. */
export function RocketShow() {
  const rocket = useRef<THREE.Group>(null);
  const flame = useRef<THREE.Mesh>(null);
  const points = useRef<THREE.Points>(null);
  const beamA = useRef<THREE.Group>(null);
  const beamB = useRef<THREE.Group>(null);

  const cycle = useRef(0);
  const [count, setCount] = useState<number | null>(null);

  const { positions, life } = useMemo(() => {
    const p = new Float32Array(PARTICLES * 3);
    const l = new Float32Array(PARTICLES).fill(-1);
    return { positions: p, life: l };
  }, []);

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    cycle.current = (cycle.current + dt) % (IDLE_SECONDS + BOOST_SECONDS);
    const t = cycle.current;
    const boosting = t > IDLE_SECONDS;

    // Countdown readout (last 5 idle seconds)
    const remaining = IDLE_SECONDS - t;
    const next = !boosting && remaining <= 5 ? Math.ceil(remaining) : null;
    if (next !== count) setCount(next);

    if (rocket.current) {
      if (boosting) {
        const bt = (t - IDLE_SECONDS) / BOOST_SECONDS;
        rocket.current.position.y = bt * bt * 52;
        rocket.current.rotation.z = Math.sin(clock.elapsedTime * 22) * 0.008;
        rocket.current.visible = bt < 0.96;
      } else {
        rocket.current.position.y = 0;
        rocket.current.visible = true;
        rocket.current.rotation.z = 0;
      }
    }

    if (flame.current) {
      flame.current.visible = boosting;
      const s = 0.8 + Math.random() * 0.5;
      flame.current.scale.set(s, 1 + Math.random() * 0.6, s);
    }

    // Exhaust particles
    if (points.current) {
      const rocketY = rocket.current?.position.y ?? 0;
      for (let i = 0; i < PARTICLES; i++) {
        if (boosting && life[i] < 0 && Math.random() < 0.4) {
          life[i] = 0.6 + Math.random() * 0.5;
          positions[i * 3] = PAD.x + (Math.random() - 0.5) * 0.7;
          positions[i * 3 + 1] = rocketY + 0.6;
          positions[i * 3 + 2] = PAD.z + (Math.random() - 0.5) * 0.7;
        }
        if (life[i] >= 0) {
          life[i] -= dt;
          positions[i * 3] += (Math.random() - 0.5) * 3.4 * dt;
          positions[i * 3 + 1] -= (5 + Math.random() * 4) * dt;
          positions[i * 3 + 2] += (Math.random() - 0.5) * 3.4 * dt;
          if (life[i] < 0 || positions[i * 3 + 1] < 0.05) life[i] = -1;
        }
        if (life[i] < 0) {
          positions[i * 3 + 1] = -50;
        }
      }
      points.current.geometry.attributes.position.needsUpdate = true;
    }

    // Searchlight sweep (tilt + spin around the base pivot)
    const sweep = clock.elapsedTime * 0.7;
    if (beamA.current) beamA.current.rotation.set(0.35 + Math.sin(sweep) * 0.18, sweep, 0);
    if (beamB.current) beamB.current.rotation.set(0.35 + Math.cos(sweep * 0.8) * 0.18, -sweep * 1.2, 0);
  });

  return (
    <group>
      {/* Launch pad */}
      <mesh position={[PAD.x, 0.12, PAD.z]} receiveShadow>
        <cylinderGeometry args={[2.4, 2.7, 0.24, 24]} />
        <meshStandardMaterial color="#131926" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[PAD.x, 0.26, PAD.z]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[1.7, 2.05, 32]} />
        <meshBasicMaterial color="#f5c542" transparent opacity={0.65} toneMapped={false} />
      </mesh>

      {/* Rocket */}
      <group ref={rocket} position={[PAD.x, 0, PAD.z]}>
        <mesh position={[0, 2.2, 0]} castShadow>
          <cylinderGeometry args={[0.55, 0.65, 3.4, 14]} />
          <meshStandardMaterial color="#dfe8f5" metalness={0.7} roughness={0.25} />
        </mesh>
        <mesh position={[0, 4.35, 0]}>
          <coneGeometry args={[0.55, 1.1, 14]} />
          <meshStandardMaterial color="#f5c542" metalness={0.6} roughness={0.3} />
        </mesh>
        {[0, (Math.PI * 2) / 3, (Math.PI * 4) / 3].map((a) => (
          <mesh key={a} position={[Math.cos(a) * 0.62, 0.7, Math.sin(a) * 0.62]} rotation-y={-a}>
            <boxGeometry args={[0.1, 1.1, 0.55]} />
            <meshStandardMaterial color="#f5c542" metalness={0.5} roughness={0.35} />
          </mesh>
        ))}
        <mesh position={[0, 2.4, 0.58]}>
          <circleGeometry args={[0.22, 12]} />
          <meshBasicMaterial color="#3de7ff" toneMapped={false} />
        </mesh>
        <mesh ref={flame} position={[0, 0.15, 0]} visible={false}>
          <coneGeometry args={[0.45, 1.6, 12]} />
          <meshBasicMaterial color="#ffb054" transparent opacity={0.9} toneMapped={false} />
        </mesh>
      </group>

      {/* Exhaust particles */}
      <points ref={points}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.4} color="#ffb054" transparent opacity={0.85} depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>

      {/* Countdown */}
      {count != null && (
        <Billboard position={[PAD.x, 7.5, PAD.z]}>
          <Text fontSize={1.4} color="#f5c542" anchorX="center" anchorY="middle" material-toneMapped={false} outlineWidth={0.08} outlineColor="#140f04">
            {`T-${count}`}
          </Text>
        </Billboard>
      )}

      {/* Searchlights — beams pivot at their base so they never dip underground */}
      <group ref={beamA} position={[PAD.x - 4, 0.3, PAD.z + 3]}>
        <mesh position={[0, 9, 0]} rotation-z={Math.PI}>
          <coneGeometry args={[1.5, 18, 12, 1, true]} />
          <meshBasicMaterial color="#f5c542" transparent opacity={0.05} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
      </group>
      <group ref={beamB} position={[PAD.x + 4, 0.3, PAD.z - 3]}>
        <mesh position={[0, 9, 0]} rotation-z={Math.PI}>
          <coneGeometry args={[1.5, 18, 12, 1, true]} />
          <meshBasicMaterial color="#3de7ff" transparent opacity={0.06} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
      </group>
    </group>
  );
}
