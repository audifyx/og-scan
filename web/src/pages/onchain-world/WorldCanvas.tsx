import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import { useMemo, useRef } from "react";
import type { Mesh } from "three";
import type { ChainEvent } from "./api";
import { isOrbitxMint, ORBITX_MINT } from "../../../shared/orbitx-chain-intel.js";

type Props = {
  events: ChainEvent[];
  onPick: (event: ChainEvent) => void;
  followId?: string | null;
};

function hashPos(id: string, radius: number): [number, number, number] {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const a = (h % 360) * (Math.PI / 180);
  const b = ((h >> 8) % 360) * (Math.PI / 180);
  const r = 6 + (h % 100) / 100 * radius;
  return [Math.cos(a) * r, 0.4 + (h % 7) * 0.18, Math.sin(b) * r];
}

function Building({ mint, orbitx }: { mint: string; orbitx: boolean }) {
  const pos = useMemo(() => (orbitx ? [0, 1.6, 0] as [number, number, number] : hashPos(mint, 14)), [mint, orbitx]);
  const h = orbitx ? 3.4 : 0.8 + (mint.length % 5) * 0.28;
  return (
    <mesh position={pos} castShadow>
      <boxGeometry args={[orbitx ? 1.6 : 0.7, h, orbitx ? 1.6 : 0.7]} />
      <meshStandardMaterial
        color={orbitx ? "#67e8f9" : "#94a3b8"}
        emissive={orbitx ? "#22d3ee" : "#334155"}
        emissiveIntensity={orbitx ? 0.55 : 0.12}
        metalness={0.4}
        roughness={0.35}
      />
    </mesh>
  );
}

function Pulse({ event, onPick }: { event: ChainEvent; onPick: (e: ChainEvent) => void }) {
  const ref = useRef<Mesh>(null);
  const from = useMemo(() => hashPos(event.wallet || event.signature, 16), [event.wallet, event.signature]);
  const to = useMemo(
    () => (isOrbitxMint(event.token_ca) ? [0, 1.8, 0] as [number, number, number] : hashPos(event.token_ca || event.destination_wallet || "x", 12)),
    [event.token_ca, event.destination_wallet],
  );
  useFrame(({ clock }) => {
    const t = (clock.elapsedTime * (0.25 + Math.min(event.importance, 40) / 80) + event.importance * 0.01) % 1;
    if (!ref.current) return;
    ref.current.position.set(
      from[0] + (to[0] - from[0]) * t,
      from[1] + (to[1] - from[1]) * t + Math.sin(t * Math.PI) * 0.6,
      from[2] + (to[2] - from[2]) * t,
    );
  });
  const color = event.event_type.includes("BURN")
    ? "#fbbf24"
    : event.event_type.includes("BUY")
      ? "#4ade80"
      : event.event_type.includes("SELL")
        ? "#fb7185"
        : "#7dd3fc";
  const scale = event.whale_related || event.orbitx_related ? 0.22 : 0.1;
  return (
    <mesh ref={ref} onClick={(e) => { e.stopPropagation(); onPick(event); }}>
      <sphereGeometry args={[scale, 12, 12]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.8} />
    </mesh>
  );
}

function Scene({ events, onPick }: Props) {
  const tokens = useMemo(() => {
    const set = new Set<string>();
    for (const e of events) if (e.token_ca) set.add(e.token_ca);
    set.add(ORBITX_MINT);
    return [...set].slice(0, 28);
  }, [events]);
  const vis = events.filter((e) => e.importance >= 8 || e.orbitx_related).slice(0, 36);
  return (
    <>
      <color attach="background" args={["#05070b"]} />
      <fog attach="fog" args={["#05070b", 18, 42]} />
      <ambientLight intensity={0.35} />
      <pointLight position={[0, 6, 0]} intensity={18} color="#67e8f9" distance={28} />
      <directionalLight position={[8, 12, 4]} intensity={0.7} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[22, 64]} />
        <meshStandardMaterial color="#0b1220" metalness={0.2} roughness={0.9} />
      </mesh>
      <Stars radius={40} depth={20} count={1200} factor={2} fade speed={0.4} />
      {tokens.map((mint) => (
        <Building key={mint} mint={mint} orbitx={isOrbitxMint(mint)} />
      ))}
      {vis.map((event) => (
        <Pulse key={event.event_id} event={event} onPick={onPick} />
      ))}
      <OrbitControls enablePan enableZoom maxDistance={34} minDistance={6} autoRotate autoRotateSpeed={0.25} />
    </>
  );
}

export default function WorldCanvas(props: Props) {
  return (
    <Canvas camera={{ position: [10, 8, 12], fov: 50 }} dpr={[1, 1.6]}>
      <Scene {...props} />
    </Canvas>
  );
}
