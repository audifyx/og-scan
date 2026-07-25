import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Vec3 } from "@/lib/orbitxcity/types";

const SPOTS: Array<[number, number]> = [
  [0, 4], [3, -3], [-3, -6], [8, 0], [-8, 2], [0, -8],
  [12, 10], [-12, 8], [10, -10], [-10, -12], [2, 20], [-2, -20],
  [20, -8], [-20, -4],
  // Outer districts
  [34, 14], [40, -6], [-33, -6], [-42, -34], [0, -36], [14, 36],
  [-14, 34], [46, 34], [-46, -46], [20, -40], [34, 46], [-46, 36],
];

const RESPAWN_SECONDS = 25;
const PICKUP_RADIUS = 1.1;

interface CoinState {
  collectedAt: number | null;
}

/** Collectible OBX shards — walk over them to bank shards in your inventory. */
export function CoinField({ playerPos, onCollect }: { playerPos: Vec3; onCollect: () => void }) {
  const coins = useRef<CoinState[]>(SPOTS.map(() => ({ collectedAt: null })));
  const groupRefs = useRef<Array<THREE.Group | null>>([]);
  const player = useRef(playerPos);
  player.current = playerPos;

  const goldMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#f5c542", emissive: "#f5a742", emissiveIntensity: 0.7, metalness: 0.85, roughness: 0.2 }),
    [],
  );

  useFrame(({ clock }) => {
    const now = clock.elapsedTime;
    SPOTS.forEach(([x, z], i) => {
      const state = coins.current[i];
      const g = groupRefs.current[i];
      if (!g) return;

      if (state.collectedAt != null && now - state.collectedAt > RESPAWN_SECONDS) {
        state.collectedAt = null;
      }

      const alive = state.collectedAt == null;
      g.visible = alive;
      if (!alive) return;

      g.rotation.y = now * 2 + i;
      g.position.y = 0.75 + Math.sin(now * 2.4 + i * 1.3) * 0.12;

      const d = Math.hypot(player.current.x - x, player.current.z - z);
      if (d < PICKUP_RADIUS) {
        state.collectedAt = now;
        onCollect();
      }
    });
  });

  return (
    <group>
      {SPOTS.map(([x, z], i) => (
        <group key={i} position={[x, 0.75, z]} ref={(el) => (groupRefs.current[i] = el)}>
          <mesh rotation-x={Math.PI / 2} castShadow material={goldMat}>
            <cylinderGeometry args={[0.34, 0.34, 0.08, 24]} />
          </mesh>
          <mesh rotation-x={Math.PI / 2} position={[0, 0, 0]}>
            <torusGeometry args={[0.34, 0.035, 8, 24]} />
            <meshBasicMaterial color="#ffe28a" toneMapped={false} />
          </mesh>
          {/* ground glow */}
          <mesh rotation-x={-Math.PI / 2} position={[0, -0.68, 0]}>
            <ringGeometry args={[0.3, 0.44, 24]} />
            <meshBasicMaterial color="#f5c542" transparent opacity={0.3} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
