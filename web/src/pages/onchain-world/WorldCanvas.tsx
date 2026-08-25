import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Float, Html, Line, OrbitControls, Sparkles, Stars } from "@react-three/drei";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import type { Group, Mesh } from "three";
import { Vector3 } from "three";
import type { ChainEvent, FlowRow, KolCard } from "./api";
import { isOrbitxMint, ORBITX_MINT } from "../../../shared/orbitx-chain-intel.js";
import { activeOrbitxKols } from "../../../shared/orbitx-kol-directory.js";

export type WorldPick =
  | { kind: "event"; event: ChainEvent }
  | { kind: "wallet"; address: string }
  | { kind: "token"; mint: string };

type Props = {
  events: ChainEvent[];
  kols?: KolCard[];
  flows?: FlowRow[];
  followId?: string | null;
  followWallet?: string | null;
  onPick: (pick: WorldPick) => void;
};

function hash(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return h >>> 0;
}

function ring(index: number, count: number, radius: number, y = 0): [number, number, number] {
  const a = (index / Math.max(count, 1)) * Math.PI * 2 - Math.PI / 2;
  return [Math.cos(a) * radius, y, Math.sin(a) * radius];
}

function tokenPos(mint: string): [number, number, number] {
  if (isOrbitxMint(mint)) return [0, 0, 0];
  const h = hash(mint);
  const a = (h % 360) * (Math.PI / 180);
  const r = 11 + (h % 70) / 10;
  return [Math.cos(a) * r, 0, Math.sin(a) * r];
}

function walletPos(address: string, kolIndex: number, kolCount: number, isKol: boolean): [number, number, number] {
  if (isKol && kolIndex >= 0) return ring(kolIndex, kolCount, 6.6, 0);
  const h = hash(address);
  const a = (h % 360) * (Math.PI / 180);
  const r = 16 + (h % 50) / 12;
  return [Math.cos(a) * r, 0, Math.sin(a) * r];
}

function eventColor(type: string): string {
  if (type.includes("BURN")) return "#fbbf24";
  if (type.includes("BUY")) return "#4ade80";
  if (type.includes("SELL")) return "#fb7185";
  if (type.includes("SOL")) return "#facc15";
  return "#67e8f9";
}

function Ground() {
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[40, 96]} />
        <meshStandardMaterial color="#061018" metalness={0.42} roughness={0.62} />
      </mesh>
      <gridHelper args={[56, 56, "#153044", "#0a1822"]} position={[0, 0.02, 0]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <ringGeometry args={[5.9, 6.25, 72]} />
        <meshBasicMaterial color="#22d3ee" transparent opacity={0.4} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <ringGeometry args={[10.8, 11.1, 72]} />
        <meshBasicMaterial color="#64748b" transparent opacity={0.22} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <ringGeometry args={[16.4, 16.7, 72]} />
        <meshBasicMaterial color="#334155" transparent opacity={0.18} />
      </mesh>
    </>
  );
}

function CityFill() {
  const blocks = useMemo(() => {
    return Array.from({ length: 36 }, (_, i) => {
      const a = (i / 36) * Math.PI * 2;
      const r = 20 + (i % 5) * 1.4;
      return {
        key: `blk-${i}`,
        pos: [Math.cos(a) * r, 0, Math.sin(a) * r] as [number, number, number],
        h: 0.5 + (i % 7) * 0.22,
      };
    });
  }, []);
  return (
    <>
      {blocks.map((b) => (
        <mesh key={b.key} position={[b.pos[0], b.h / 2, b.pos[2]]}>
          <boxGeometry args={[0.55, b.h, 0.55]} />
          <meshStandardMaterial color="#0f1c28" emissive="#123047" emissiveIntensity={0.18} metalness={0.3} roughness={0.55} />
        </mesh>
      ))}
    </>
  );
}

function OrbitXTower({ onPick, pulsing }: { onPick: () => void; pulsing: boolean }) {
  const glow = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    if (!glow.current) return;
    const s = 1 + Math.sin(clock.elapsedTime * 2.2) * (pulsing ? 0.18 : 0.06);
    glow.current.scale.setScalar(s);
  });
  return (
    <Float speed={1.1} rotationIntensity={0.08} floatIntensity={0.25}>
      <group onClick={(e) => { e.stopPropagation(); onPick(); }}>
        <mesh position={[0, 2.4, 0]} castShadow>
          <cylinderGeometry args={[0.55, 1.15, 4.8, 8]} />
          <meshStandardMaterial color="#67e8f9" emissive="#0891b2" emissiveIntensity={0.7} metalness={0.55} roughness={0.22} />
        </mesh>
        <mesh ref={glow} position={[0, 5.05, 0]}>
          <octahedronGeometry args={[0.55, 0]} />
          <meshStandardMaterial color="#ecfeff" emissive="#22d3ee" emissiveIntensity={1.2} />
        </mesh>
        <pointLight position={[0, 5.4, 0]} intensity={pulsing ? 42 : 28} distance={20} color="#67e8f9" />
        <Html center distanceFactor={22} position={[0, 6.1, 0]}>
          <div className="oxw-tag oxw-tag-ox">$ORBITX</div>
        </Html>
      </group>
    </Float>
  );
}

function DexHub() {
  return (
    <group position={[14, 0, 0]}>
      <mesh position={[0, 1.1, 0]}>
        <boxGeometry args={[2.4, 2.2, 2.4]} />
        <meshStandardMaterial color="#1e293b" emissive="#334155" emissiveIntensity={0.2} metalness={0.4} roughness={0.4} />
      </mesh>
      <Html center distanceFactor={24} position={[0, 2.6, 0]}>
        <div className="oxw-tag">DEX</div>
      </Html>
    </group>
  );
}

function TokenDistrict({ mint, symbol, onPick }: { mint: string; symbol?: string | null; onPick: () => void }) {
  const pos = useMemo(() => tokenPos(mint), [mint]);
  const h = 1.1 + (hash(mint) % 18) / 10;
  return (
    <group position={pos} onClick={(e) => { e.stopPropagation(); onPick(); }}>
      <mesh position={[0, h / 2, 0]} castShadow>
        <boxGeometry args={[0.9, h, 0.9]} />
        <meshStandardMaterial color="#94a3b8" emissive="#1e293b" emissiveIntensity={0.25} metalness={0.45} roughness={0.38} />
      </mesh>
      <Html center distanceFactor={26} position={[0, h + 0.35, 0]}>
        <div className="oxw-tag">{symbol ? `$${symbol}` : mint.slice(0, 4)}</div>
      </Html>
    </group>
  );
}

function Character({
  label,
  kol,
  active,
  followed,
  pos,
  onPick,
}: {
  label: string;
  kol: boolean;
  active: boolean;
  followed: boolean;
  pos: [number, number, number];
  onPick: () => void;
}) {
  const ref = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.position.y = 0.02 + Math.sin(clock.elapsedTime * 2 + pos[0]) * 0.04;
    ref.current.scale.setScalar(followed ? 1.18 : 1);
  });
  const color = followed ? "#f0abfc" : kol ? "#f472b6" : active ? "#7dd3fc" : "#64748b";
  return (
    <group ref={ref} position={pos} onClick={(e) => { e.stopPropagation(); onPick(); }}>
      <mesh position={[0, 0.55, 0]} castShadow>
        <capsuleGeometry args={[0.14, kol ? 0.55 : 0.42, 6, 10]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={kol || active || followed ? 0.6 : 0.15} />
      </mesh>
      <mesh position={[0, kol ? 1.08 : 0.98, 0]}>
        <sphereGeometry args={[0.15, 12, 12]} />
        <meshStandardMaterial color={kol ? "#fecdd3" : "#e2e8f0"} />
      </mesh>
      {(kol || followed) && (
        <Html center distanceFactor={20} position={[0, kol ? 1.5 : 1.35, 0]}>
          <div className={`oxw-tag${kol ? " oxw-tag-kol" : ""}`}>{label}</div>
        </Html>
      )}
    </group>
  );
}

function Transit({
  event,
  from,
  to,
  highlight,
  onPick,
}: {
  event: ChainEvent;
  from: [number, number, number];
  to: [number, number, number];
  highlight: boolean;
  onPick: () => void;
}) {
  const ref = useRef<Mesh>(null);
  const start: [number, number, number] = [from[0], from[1] + 0.8, from[2]];
  const end: [number, number, number] = [to[0], to[1] + 1.4, to[2]];
  const mid: [number, number, number] = [(start[0] + end[0]) / 2, Math.max(start[1], end[1]) + 2.2, (start[2] + end[2]) / 2];
  const color = eventColor(event.event_type);
  const scale = highlight || event.whale_related || event.orbitx_related ? 0.22 : 0.1;
  useFrame(({ clock }) => {
    const t = (clock.elapsedTime * (0.18 + Math.min(event.importance, 50) / 90) + hash(event.event_id) / 1e9) % 1;
    const u = 1 - t;
    if (!ref.current) return;
    ref.current.position.set(
      u * u * start[0] + 2 * u * t * mid[0] + t * t * end[0],
      u * u * start[1] + 2 * u * t * mid[1] + t * t * end[1],
      u * u * start[2] + 2 * u * t * mid[2] + t * t * end[2],
    );
  });
  return (
    <group>
      <Line points={[start, mid, end]} color={color} transparent opacity={highlight ? 0.7 : 0.28} lineWidth={event.orbitx_related || highlight ? 2 : 1} />
      <mesh ref={ref} onClick={(e) => { e.stopPropagation(); onPick(); }}>
        <sphereGeometry args={[scale, 10, 10]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1} />
      </mesh>
    </group>
  );
}

function CameraRig({ target, controls }: { target: [number, number, number] | null; controls: RefObject<{ target: Vector3 } | null> }) {
  const { camera } = useThree();
  const goal = useRef(new Vector3(14, 10, 16));
  useEffect(() => {
    if (!target) return;
    goal.current.set(target[0] + 7, 7.5, target[2] + 8);
  }, [target]);
  useFrame(() => {
    camera.position.lerp(goal.current, 0.035);
    if (target && controls.current) {
      controls.current.target.lerp(new Vector3(target[0], 1.1, target[2]), 0.05);
    }
  });
  return null;
}

function Scene({ events, kols, flows, followId, followWallet, onPick }: Props) {
  const controls = useRef<{ target: Vector3 } | null>(null);
  const assigned = useMemo(() => {
    if (kols?.length) return kols.filter((k) => k.status !== "disputed");
    return activeOrbitxKols();
  }, [kols]);
  const kolIndex = useMemo(() => {
    const m = new Map<string, number>();
    assigned.forEach((k, i) => m.set(k.address, i));
    return m;
  }, [assigned]);

  const tokens = useMemo(() => {
    const map = new Map<string, string | null>();
    map.set(ORBITX_MINT, "ORBITX");
    for (const e of events) if (e.token_ca && !isOrbitxMint(e.token_ca)) map.set(e.token_ca, e.token_symbol);
    return [...map.entries()].slice(0, 22);
  }, [events]);

  const extraWallets = useMemo(() => {
    const set = new Set<string>();
    for (const e of events) {
      const addr = e.wallet || e.source_wallet;
      if (addr && !kolIndex.has(addr)) set.add(addr);
    }
    return [...set].slice(0, 16);
  }, [events, kolIndex]);

  const vis = events.filter((e) => e.importance >= 6 || e.orbitx_related || e.kol_related).slice(0, 42);
  const burns = events.filter((e) => e.event_type.includes("BURN") && e.orbitx_related);
  const follow = followWallet
    ? walletPos(followWallet, kolIndex.get(followWallet) ?? -1, assigned.length, kolIndex.has(followWallet))
    : null;

  return (
    <>
      <color attach="background" args={["#03070c"]} />
      <fog attach="fog" args={["#03070c", 22, 50]} />
      <ambientLight intensity={0.28} />
      <directionalLight position={[10, 16, 6]} intensity={0.85} color="#dbeafe" />
      <Stars radius={60} depth={28} count={1800} factor={2.2} fade speed={0.35} />
      <Ground />
      <CityFill />
      <OrbitXTower pulsing={burns.length > 0} onPick={() => onPick({ kind: "token", mint: ORBITX_MINT })} />
      <DexHub />
      {burns.length > 0 ? <Sparkles count={48} scale={[3.4, 4.4, 3.4]} size={4} color="#fbbf24" position={[0, 3.2, 0]} /> : null}
      {tokens.filter(([mint]) => !isOrbitxMint(mint)).map(([mint, symbol]) => (
        <TokenDistrict key={mint} mint={mint} symbol={symbol} onPick={() => onPick({ kind: "token", mint })} />
      ))}
      {assigned.map((k, i) => (
        <Character
          key={k.address}
          label={k.name}
          kol
          active={events.some((e) => e.wallet === k.address || e.source_wallet === k.address)}
          followed={followWallet === k.address}
          pos={walletPos(k.address, i, assigned.length, true)}
          onPick={() => onPick({ kind: "wallet", address: k.address })}
        />
      ))}
      {extraWallets.map((addr) => (
        <Character
          key={addr}
          label={addr.slice(0, 4)}
          kol={false}
          active
          followed={followWallet === addr}
          pos={walletPos(addr, -1, assigned.length, false)}
          onPick={() => onPick({ kind: "wallet", address: addr })}
        />
      ))}
      {vis.map((event) => {
        const fromAddr = event.source_wallet || event.wallet || event.signature;
        const from = walletPos(fromAddr, kolIndex.get(fromAddr) ?? -1, assigned.length, kolIndex.has(fromAddr));
        const dest = event.destination_wallet;
        const to = dest
          ? walletPos(dest, kolIndex.get(dest) ?? -1, assigned.length, kolIndex.has(dest))
          : event.token_ca
            ? tokenPos(event.token_ca)
            : ([14, 0, 0] as [number, number, number]);
        return (
          <Transit
            key={event.event_id}
            event={event}
            from={from}
            to={to}
            highlight={followId === event.event_id}
            onPick={() => onPick({ kind: "event", event })}
          />
        );
      })}
      {(flows || []).slice(0, 14).map((f) => (
        <Line
          key={`${f.from_address}-${f.to_address}-${f.last_signature || ""}`}
          points={[
            walletPos(f.from_address, kolIndex.get(f.from_address) ?? -1, assigned.length, kolIndex.has(f.from_address)),
            walletPos(f.to_address, kolIndex.get(f.to_address) ?? -1, assigned.length, kolIndex.has(f.to_address)),
          ]}
          color="#38bdf8"
          transparent
          opacity={0.14}
        />
      ))}
      <CameraRig target={follow} controls={controls} />
      <OrbitControls
        ref={controls}
        enablePan
        enableZoom
        maxDistance={42}
        minDistance={5}
        autoRotate={!followWallet}
        autoRotateSpeed={0.18}
      />
    </>
  );
}

export default function WorldCanvas(props: Props) {
  return (
    <Canvas camera={{ position: [14, 10, 16], fov: 48 }} dpr={[1, 1.7]} shadows>
      <Scene {...props} />
    </Canvas>
  );
}
