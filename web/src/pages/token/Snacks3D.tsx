import { useMemo } from 'react';

const BAG_POS: [number, number, number] = [-0.12, 0.11, 0];
const BOWL_POS: [number, number, number] = [0.1, 0.03, 0.05];
const BAR_POS: [number, number, number] = [0.02, 0.02, -0.12];

type Candy = { pos: [number, number, number]; color: string };

const CANDY_COLORS = ['#ff3b30', '#ffd60a', '#34c759', '#0a84ff', '#bf5af2', '#ff9f0a'];

export function SnackPile() {
  const candies: Candy[] = useMemo(
    () => [
      { pos: [0.1, 0.088, 0.05], color: CANDY_COLORS[0] },
      { pos: [0.13, 0.07, 0.05], color: CANDY_COLORS[1] },
      { pos: [0.07, 0.07, 0.05], color: CANDY_COLORS[2] },
      { pos: [0.1, 0.07, 0.08], color: CANDY_COLORS[3] },
      { pos: [0.1, 0.07, 0.02], color: CANDY_COLORS[4] },
      { pos: [0.12, 0.08, 0.065], color: CANDY_COLORS[5] },
      { pos: [0.08, 0.08, 0.035], color: CANDY_COLORS[0] },
      { pos: [0.115, 0.062, 0.03], color: CANDY_COLORS[2] },
    ],
    []
  );

  const squares: [number, number, number][] = useMemo(
    () => [
      [0.02 - 0.0525, 0.036, -0.12],
      [0.02 - 0.0175, 0.036, -0.12],
      [0.02 + 0.0175, 0.036, -0.12],
      [0.02 + 0.0525, 0.036, -0.12],
    ],
    []
  );

  return (
    <group>
      {/* Chip bag */}
      <mesh position={BAG_POS} castShadow>
        <boxGeometry args={[0.16, 0.22, 0.08]} />
        <meshStandardMaterial color="#e11d2e" roughness={0.35} metalness={0.05} />
      </mesh>
      {/* Yellow stripe on the front face */}
      <mesh position={[-0.12, 0.11, 0.041]}>
        <planeGeometry args={[0.13, 0.05]} />
        <meshStandardMaterial color="#ffd400" emissive="#ffd400" emissiveIntensity={0.55} />
      </mesh>
      {/* Pinched top */}
      <mesh position={[-0.12, 0.245, 0]} rotation={[0, 0, 0.15]} castShadow>
        <boxGeometry args={[0.12, 0.05, 0.06]} />
        <meshStandardMaterial color="#c41624" roughness={0.35} metalness={0.05} />
      </mesh>

      {/* Candy bowl */}
      <mesh position={BOWL_POS} castShadow receiveShadow>
        <cylinderGeometry args={[0.09, 0.06, 0.06, 24]} />
        <meshStandardMaterial color="#14b8a6" roughness={0.25} metalness={0.1} />
      </mesh>
      {candies.map((c, i) => (
        <mesh key={i} position={c.pos} castShadow>
          <sphereGeometry args={[0.015, 16, 16]} />
          <meshStandardMaterial color={c.color} roughness={0.2} />
        </mesh>
      ))}

      {/* Chocolate bar */}
      <mesh position={BAR_POS} castShadow>
        <boxGeometry args={[0.14, 0.02, 0.07]} />
        <meshStandardMaterial color="#5b3a1e" roughness={0.5} />
      </mesh>
      {squares.map((p, i) => (
        <mesh key={i} position={p} castShadow>
          <boxGeometry args={[0.025, 0.012, 0.025]} />
          <meshStandardMaterial color="#6b4423" roughness={0.5} />
        </mesh>
      ))}
    </group>
  );
}
