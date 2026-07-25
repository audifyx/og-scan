import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Vec3 } from "@/lib/orbitxcity/types";
import { NYC_DEMO_BLOCK } from "@/lib/orbitxcity/demoBlock";
import { useCity } from "@/pages/orbitxcity/CityProvider";

const PICKUP_RADIUS = 1.7;
const SHARD_COLOR = "#17ff4d";

/** Walk over a shard to collect it — awards an $OBX shard + plays a chime. */
export function Collectibles() {
  const { collectedShards, collectShard, playerPos } = useCity();
  const shards = NYC_DEMO_BLOCK.shards ?? [];

  return (
    <group>
      {shards.map((s) =>
        collectedShards.has(s.id) ? null : (
          <Shard
            key={s.id}
            id={s.id}
            position={s.position}
            playerPos={playerPos}
            onCollect={collectShard}
          />
        ),
      )}
    </group>
  );
}

function Shard({
  id,
  position,
  playerPos,
  onCollect,
}: {
  id: string;
  position: Vec3;
  playerPos: Vec3;
  onCollect: (id: string) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const core = useRef<THREE.Mesh>(null);
  const player = useRef(playerPos);
  player.current = playerPos;

  useFrame(({ clock }, dt) => {
    if (group.current) {
      group.current.rotation.y += dt * 1.6;
      group.current.position.y = position.y + Math.sin(clock.elapsedTime * 2 + position.x) * 0.18;
    }
    if (core.current) {
      const pulse = 0.6 + Math.sin(clock.elapsedTime * 4 + position.z) * 0.25;
      (core.current.material as THREE.MeshStandardMaterial).emissiveIntensity = pulse;
    }
    const d = Math.hypot(player.current.x - position.x, player.current.z - position.z);
    if (d < PICKUP_RADIUS) onCollect(id);
  });

  return (
    <group ref={group} position={[position.x, position.y, position.z]}>
      <mesh ref={core} castShadow>
        <octahedronGeometry args={[0.42, 0]} />
        <meshStandardMaterial
          color={SHARD_COLOR}
          emissive={SHARD_COLOR}
          emissiveIntensity={0.7}
          metalness={0.6}
          roughness={0.2}
        />
      </mesh>
      {/* Glow halo */}
      <mesh scale={1.5}>
        <octahedronGeometry args={[0.42, 0]} />
        <meshBasicMaterial color={SHARD_COLOR} transparent opacity={0.12} />
      </mesh>
      {/* Ground beacon */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -position.y + 0.05, 0]}>
        <ringGeometry args={[0.5, 0.72, 24]} />
        <meshBasicMaterial color={SHARD_COLOR} transparent opacity={0.35} />
      </mesh>
    </group>
  );
}
