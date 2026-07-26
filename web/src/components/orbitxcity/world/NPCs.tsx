import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, Text } from "@react-three/drei";
import * as THREE from "three";
import { NYC_DEMO_BLOCK } from "@/lib/orbitxcity/demoBlock";
import { collidesAt, mulberry32, randomOpenPoint } from "@/lib/orbitxcity/collision";
import type { WorldBlockConfig } from "@/lib/orbitxcity/types";

const PHRASES = [
  "gm ser",
  "wen lambo?",
  "just aped 2 SOL",
  "chart looks bullish af",
  "rugged again smh",
  "WAGMI",
  "this launch is HUGE",
  "buy the dip, ser",
  "scanner said TRUE OG",
  "diamond hands only",
  "probably nothing",
  "LFG",
  "floor is lava",
  "my bags are heavy",
];

const NPC_COLORS = ["#233a5c", "#3c2a4d", "#1e4436", "#4d3a1e", "#2a3d4d", "#43242e"];
const ACCENTS = ["#3de7ff", "#ff4d9a", "#17ff4d", "#f5c542", "#a78bfa", "#ff6b35"];

function TraderNPC({ seed, block }: { seed: number; block: WorldBlockConfig }) {
  const rand = useMemo(() => mulberry32(seed), [seed]);
  const start = useMemo(() => randomOpenPoint(rand, 3, block), [rand, block]);
  const body = useMemo(() => NPC_COLORS[Math.floor(rand() * NPC_COLORS.length)], [rand]);
  const accent = useMemo(() => ACCENTS[Math.floor(rand() * ACCENTS.length)], [rand]);
  const speed = useMemo(() => 1.4 + rand() * 1.4, [rand]);

  const group = useRef<THREE.Group>(null);
  const pos = useRef(new THREE.Vector3(start.x, 0, start.z));
  const target = useRef(randomOpenPoint(mulberry32(seed ^ 0x9e3779b9), 3, block));
  const bob = useRef(rand() * 10);

  const [bubble, setBubble] = useState<string | null>(null);

  useEffect(() => {
    let hideTimer: ReturnType<typeof setTimeout> | undefined;
    const localRand = mulberry32(seed ^ 0x51f15e);
    const cycle = setInterval(() => {
      if (localRand() > 0.45) {
        setBubble(PHRASES[Math.floor(localRand() * PHRASES.length)]);
        hideTimer = setTimeout(() => setBubble(null), 3200);
      }
    }, 6500 + (seed % 4000));
    return () => {
      clearInterval(cycle);
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, [seed]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const dx = target.current.x - pos.current.x;
    const dz = target.current.z - pos.current.z;
    const dist = Math.hypot(dx, dz);

    if (dist < 0.5) {
      target.current = randomOpenPoint(mulberry32((seed ^ ((pos.current.x * 97) | 0) ^ ((pos.current.z * 131) | 0)) >>> 0), 3, block);
    } else {
      const nx = pos.current.x + (dx / dist) * speed * dt;
      const nz = pos.current.z + (dz / dist) * speed * dt;
      if (!collidesAt(nx, nz, 0.4, block)) {
        pos.current.set(nx, 0, nz);
      } else {
        target.current = randomOpenPoint(mulberry32((seed + 7) >>> 0), 3, block);
      }
      bob.current += dt * 9;
    }

    if (group.current) {
      group.current.position.copy(pos.current);
      const targetYaw = Math.atan2(dx, dz);
      group.current.rotation.y += (targetYaw - group.current.rotation.y) * Math.min(1, dt * 8);
      const legL = group.current.getObjectByName("npcLegL");
      const legR = group.current.getObjectByName("npcLegR");
      const swing = dist >= 0.5 ? Math.sin(bob.current) * 0.4 : 0;
      if (legL) legL.rotation.x = swing;
      if (legR) legR.rotation.x = -swing;
    }
  });

  return (
    <group ref={group} position={[start.x, 0, start.z]}>
      <mesh position={[0, 1.05, 0]} castShadow>
        <capsuleGeometry args={[0.3, 0.6, 6, 10]} />
        <meshStandardMaterial color={body} metalness={0.3} roughness={0.55} />
      </mesh>
      <mesh position={[0, 1.85, 0]}>
        <sphereGeometry args={[0.27, 14, 14]} />
        <meshStandardMaterial color="#d9c6ae" roughness={0.7} />
      </mesh>
      <mesh position={[0, 1.88, 0.19]}>
        <boxGeometry args={[0.32, 0.1, 0.06]} />
        <meshBasicMaterial color={accent} toneMapped={false} />
      </mesh>
      <mesh name="npcLegL" position={[-0.13, 0.4, 0]}>
        <capsuleGeometry args={[0.1, 0.3, 4, 8]} />
        <meshStandardMaterial color="#0d121c" />
      </mesh>
      <mesh name="npcLegR" position={[0.13, 0.4, 0]}>
        <capsuleGeometry args={[0.1, 0.3, 4, 8]} />
        <meshStandardMaterial color="#0d121c" />
      </mesh>

      {bubble && (
        <Billboard position={[0, 2.7, 0]}>
          <Text
            fontSize={0.26}
            color="#e8f1ff"
            anchorX="center"
            anchorY="middle"
            maxWidth={3.4}
            outlineWidth={0.05}
            outlineColor="#04070f"
          >
            {bubble}
          </Text>
        </Billboard>
      )}
    </group>
  );
}

const NPC_SEEDS = [11, 47, 83, 129, 211, 307, 401, 509, 613, 727, 829, 941];

/** Ambient trader crowd wandering the block. */
export function NPCs({ block = NYC_DEMO_BLOCK }: { block?: WorldBlockConfig }) {
  return (
    <group>
      {NPC_SEEDS.map((s) => (
        <TraderNPC key={`${block.cityId}-${s}`} seed={s} block={block} />
      ))}
    </group>
  );
}
