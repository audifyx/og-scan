import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Vec3, WorldBlockConfig } from "@/lib/orbitxcity/types";
import { collidesAt, randomOpenPoint, hashSeed, mulberry32 } from "@/lib/orbitxcity/collision";

const RESPAWN_SECONDS = 25;
const PICKUP_RADIUS = 1.1;

interface CoinState {
  collectedAt: number | null;
}

function buildShardSpots(block: WorldBlockConfig): Array<[number, number]> {
  const rand = mulberry32(hashSeed(`${block.cityId}-shards`));
  const spots: Array<[number, number]> = [];
  // Each landmark has a nearby pickup route, then open-world nodes fill out
  // the remaining circuit. This keeps collectibles in the active city.
  for (const zone of block.zones) {
    const angle = rand() * Math.PI * 2;
    const radius = Math.max(zone.radius + 1.4, 3.4);
    const x = zone.position.x + Math.cos(angle) * radius;
    const z = zone.position.z + Math.sin(angle) * radius;
    const candidate = randomOpenPoint(() => rand(), 3, block);
    spots.push(collidesAt(x, z, 0.7, block) ? [candidate.x, candidate.z] : [x, z]);
  }
  while (spots.length < 24) {
    const p = randomOpenPoint(rand, 3, block);
    spots.push([p.x, p.z]);
  }
  return spots;
}

/** Collectible OBX shards — walk over them to bank shards in your inventory. */
export function CoinField({
  playerPos,
  onCollect,
  lite = false,
  block,
}: {
  playerPos: Vec3;
  onCollect: () => void;
  lite?: boolean;
  block: WorldBlockConfig;
}) {
  const activeSpots = useMemo(() => {
    const spots = buildShardSpots(block);
    return lite ? spots.slice(0, 10) : spots;
  }, [block, lite]);
  const coins = useRef<CoinState[]>(activeSpots.map(() => ({ collectedAt: null })));
  const groupRefs = useRef<Array<THREE.Group | null>>([]);
  const player = useRef(playerPos);
  player.current = playerPos;

  useEffect(() => {
    coins.current = activeSpots.map(() => ({ collectedAt: null }));
    groupRefs.current = [];
  }, [activeSpots]);

  const goldMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#f5c542", emissive: "#f5a742", emissiveIntensity: 0.7, metalness: 0.85, roughness: 0.2 }),
    [],
  );

  useFrame(({ clock }) => {
    const now = clock.elapsedTime;
    activeSpots.forEach(([x, z], i) => {
      const state = coins.current[i];
      const g = groupRefs.current[i];
      if (!g || !state) return;

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
      {activeSpots.map(([x, z], i) => (
        <group key={i} position={[x, 0.75, z]} ref={(el) => (groupRefs.current[i] = el)}>
          <mesh rotation-x={Math.PI / 2} castShadow material={goldMat}>
            <cylinderGeometry args={[0.34, 0.34, 0.08, 24]} />
          </mesh>
          <mesh rotation-x={Math.PI / 2} position={[0, 0, 0]}>
            <torusGeometry args={[0.34, 0.035, 8, 24]} />
            <meshBasicMaterial color="#ffe28a" toneMapped={false} />
          </mesh>
          <mesh rotation-x={-Math.PI / 2} position={[0, -0.68, 0]}>
            <ringGeometry args={[0.3, 0.44, 24]} />
            <meshBasicMaterial color="#f5c542" transparent opacity={0.3} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
