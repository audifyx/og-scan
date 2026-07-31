import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, Text } from "@react-three/drei";
import * as THREE from "three";
import { NYC_DEMO_BLOCK } from "@/lib/orbitxcity/demoBlock";
import { collidesAt, mulberry32, randomOpenPoint } from "@/lib/orbitxcity/collision";
import type { AvatarAppearance, StreetSegment, WorldBlockConfig } from "@/lib/orbitxcity/types";
import { getWorldStreets } from "@/lib/orbitxcity/worlds";
import { useCity } from "@/pages/orbitxcity/CityProvider";
import { CharacterMesh } from "./CharacterMesh";

const TALK_RADIUS = 2.1;

/** Pick a sidewalk point offset from a street segment. */
function sidewalkPoint(streets: StreetSegment[], rand: () => number, block: WorldBlockConfig): { x: number; z: number } {
  if (!streets.length) return randomOpenPoint(rand, 3, block);
  for (let i = 0; i < 16; i++) {
    const s = streets[Math.floor(rand() * streets.length)]!;
    const t = 0.1 + rand() * 0.8;
    const along = s.from + (s.to - s.from) * t;
    const side = rand() > 0.5 ? 1 : -1;
    const offset = s.w * 0.55 + 0.9;
    const x = s.o === "h" ? along : s.at + side * offset;
    const z = s.o === "h" ? s.at + side * offset : along;
    if (!collidesAt(x, z, 0.5, block)) return { x, z };
  }
  return randomOpenPoint(rand, 3, block);
}

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

const NAMES = ["Apex", "Nova", "Drift", "Pixel", "Quark", "Moxie", "Rune", "Echo", "Vex", "Sol"];

const NPC_COLORS = ["#233a5c", "#3c2a4d", "#1e4436", "#4d3a1e", "#2a3d4d", "#43242e"];
const ACCENTS = ["#3de7ff", "#ff4d9a", "#17ff4d", "#f5c542", "#a78bfa", "#ff6b35"];
const OUTFITS: AvatarAppearance["outfit"][] = ["street", "suit", "sport", "neon"];
const CLASSES: NonNullable<AvatarAppearance["classId"]>[] = [
  "trader",
  "builder",
  "gamer",
  "creator",
  "explorer",
];

type StreetNpcLive = {
  id: string;
  x: number;
  z: number;
  name: string;
  line: string;
};

/** Shared registry so the crowd can report the nearest talkable local. */
const liveNpcs = new Map<string, StreetNpcLive>();

function StreetLocal({
  seed,
  block,
  idle,
}: {
  seed: number;
  block: WorldBlockConfig;
  idle: boolean;
}) {
  const rand = useMemo(() => mulberry32(seed), [seed]);
  const streets = useMemo(() => getWorldStreets(block.cityId), [block.cityId]);
  const start = useMemo(() => sidewalkPoint(streets, rand, block), [rand, block, streets]);
  const name = useMemo(() => NAMES[Math.floor(rand() * NAMES.length)]!, [rand]);
  const appearance = useMemo<AvatarAppearance>(
    () => ({
      bodyColor: NPC_COLORS[Math.floor(rand() * NPC_COLORS.length)]!,
      accentColor: ACCENTS[Math.floor(rand() * ACCENTS.length)]!,
      skinColor: "#e0c8b0",
      name,
      classId: CLASSES[Math.floor(rand() * CLASSES.length)],
      hairStyle: idle ? "bun" : "short",
      hairColor: "#1a1420",
      outfit: OUTFITS[Math.floor(rand() * OUTFITS.length)]!,
      faceStyle: idle ? "smile" : "cool",
    }),
    [rand, name, idle],
  );
  const speed = useMemo(() => 1.4 + rand() * 1.4, [rand]);
  const npcId = `${block.cityId}-${seed}`;

  const group = useRef<THREE.Group>(null);
  const pos = useRef(new THREE.Vector3(start.x, 0, start.z));
  const target = useRef(sidewalkPoint(streets, mulberry32(seed ^ 0x9e3779b9), block));
  const [isMoving, setIsMoving] = useState(false);
  const [bubble, setBubble] = useState<string | null>(idle ? PHRASES[seed % PHRASES.length]! : null);
  const lineRef = useRef(PHRASES[seed % PHRASES.length]!);

  useEffect(() => {
    let hideTimer: ReturnType<typeof setTimeout> | undefined;
    const localRand = mulberry32(seed ^ 0x51f15e);
    const cycle = setInterval(() => {
      if (localRand() > (idle ? 0.25 : 0.45)) {
        const line = PHRASES[Math.floor(localRand() * PHRASES.length)]!;
        lineRef.current = line;
        setBubble(line);
        hideTimer = setTimeout(() => setBubble(null), idle ? 4200 : 3200);
      }
    }, (idle ? 4800 : 6500) + (seed % 4000));
    return () => {
      clearInterval(cycle);
      if (hideTimer) clearTimeout(hideTimer);
      liveNpcs.delete(npcId);
    };
  }, [seed, idle, npcId]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);

    if (!idle) {
      const dx = target.current.x - pos.current.x;
      const dz = target.current.z - pos.current.z;
      const dist = Math.hypot(dx, dz);

      let nowMoving = false;
      if (dist < 0.5) {
        target.current = sidewalkPoint(
          streets,
          mulberry32((seed ^ ((pos.current.x * 97) | 0) ^ ((pos.current.z * 131) | 0)) >>> 0),
          block,
        );
      } else {
        const nx = pos.current.x + (dx / dist) * speed * dt;
        const nz = pos.current.z + (dz / dist) * speed * dt;
        if (!collidesAt(nx, nz, 0.4, block)) {
          pos.current.set(nx, 0, nz);
          nowMoving = true;
        } else {
          target.current = sidewalkPoint(streets, mulberry32((seed + 7) >>> 0), block);
        }
      }
      if (nowMoving !== isMoving) setIsMoving(nowMoving);

      if (group.current) {
        group.current.position.copy(pos.current);
        const targetYaw = Math.atan2(dx, dz);
        group.current.rotation.y += (targetYaw - group.current.rotation.y) * Math.min(1, dt * 8);
      }
    }

    liveNpcs.set(npcId, {
      id: npcId,
      x: pos.current.x,
      z: pos.current.z,
      name,
      line: lineRef.current,
    });
  });

  return (
    <group ref={group} position={[start.x, 0, start.z]}>
      {idle && (
        <mesh position={[0, 0.03, 0.35]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.55, 20]} />
          <meshStandardMaterial color="#1a222c" roughness={0.85} />
        </mesh>
      )}
      <CharacterMesh appearance={appearance} moving={!idle && isMoving} walkIntensity={idle ? 0.2 : 0.85} />
      {bubble && (
        <Billboard position={[0, 2.55, 0]}>
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

/** Picks nearest street local for HUD prompt / E talk. */
function StreetTalkBridge() {
  const { playerPos, interiorBuildingId, activeZone, setStreetNpc } = useCity();
  const nearRef = useRef<string | null>(null);

  useFrame(() => {
    if (interiorBuildingId || activeZone) {
      if (nearRef.current) {
        nearRef.current = null;
        setStreetNpc(null);
      }
      return;
    }
    let best: StreetNpcLive | null = null;
    let bestDist = TALK_RADIUS;
    for (const npc of liveNpcs.values()) {
      const d = Math.hypot(playerPos.x - npc.x, playerPos.z - npc.z);
      if (d < bestDist) {
        best = npc;
        bestDist = d;
      }
    }
    const id = best?.id ?? null;
    if (id === nearRef.current) return;
    nearRef.current = id;
    if (best) {
      setStreetNpc({ name: best.name, line: best.line });
    } else {
      setStreetNpc(null);
    }
  });

  useEffect(() => () => setStreetNpc(null), [setStreetNpc]);
  return null;
}

const NPC_SEEDS = [11, 47, 83, 129, 211, 307, 401, 509, 613, 727, 829, 941];

/** Ambient crowd — wanderers + idle sitters, approachable with E. */
export function NPCs({ block = NYC_DEMO_BLOCK, count = 8 }: { block?: WorldBlockConfig; count?: number }) {
  const seeds = NPC_SEEDS.slice(0, Math.max(1, Math.min(count, NPC_SEEDS.length)));
  return (
    <group>
      <StreetTalkBridge />
      {seeds.map((s, i) => (
        <StreetLocal key={`${block.cityId}-${s}`} seed={s} block={block} idle={i % 3 === 0} />
      ))}
    </group>
  );
}
