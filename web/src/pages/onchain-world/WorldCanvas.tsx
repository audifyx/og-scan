import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, Line, OrbitControls, Sparkles, Stars } from "@react-three/drei";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import type { Group, Mesh } from "three";
import { Color, Vector3 } from "three";
import type { ChainEvent, CityDistricts, FlowRow, KolCard, TokenDistrict } from "./api";
import { fmtNum, fmtUsd } from "./format";
import { isOrbitxMint, ORBITX_MINT } from "../../../shared/orbitx-chain-intel.js";
import { activeOrbitxKols } from "../../../shared/orbitx-kol-directory.js";

export type WorldPick =
  | { kind: "event"; event: ChainEvent }
  | { kind: "wallet"; address: string }
  | { kind: "token"; mint: string }
  | { kind: "hub"; id: string };

export type CamCommand =
  | { kind: "reset" }
  | { kind: "orbitx" }
  | { kind: "wallet"; address: string }
  | { kind: "token"; mint: string }
  | { kind: "follow" }
  | null;

type Props = {
  events: ChainEvent[];
  kols?: KolCard[];
  flows?: FlowRow[];
  districts?: CityDistricts | null;
  followId?: string | null;
  followWallet?: string | null;
  cinematic?: boolean;
  cam?: CamCommand;
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

const HUB_POS: Record<string, [number, number, number]> = {
  jupiter: [13.2, 0, 3.4],
  raydium: [-11.4, 0, 7.2],
  pumpfun: [7.6, 0, -12.4],
};

function tokenPos(mint: string, index: number, total: number): [number, number, number] {
  if (isOrbitxMint(mint)) return [0, 0, 0];
  const a = (index / Math.max(total, 1)) * Math.PI * 2 + 0.4;
  const r = 10.4 + (hash(mint) % 40) / 14;
  return [Math.cos(a) * r, 0, Math.sin(a) * r];
}

function walletPos(address: string, kolIndex: number, kolCount: number, isKol: boolean): [number, number, number] {
  if (isKol && kolIndex >= 0) return ring(kolIndex, kolCount, 6.5, 0.15);
  const h = hash(address);
  const a = (h % 360) * (Math.PI / 180);
  return [Math.cos(a) * (16.4 + (h % 30) / 14), 0.15, Math.sin(a) * (16.4 + (h % 30) / 14)];
}

function eventColor(type: string): string {
  if (type.includes("BURN")) return "#f59e0b";
  if (type.includes("BUY")) return "#34d399";
  if (type.includes("SELL")) return "#fb7185";
  if (type.includes("SOL")) return "#38bdf8";
  if (type.includes("ORBITX")) return "#c084fc";
  return "#67e8f9";
}

function Ground() {
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[42, 96]} />
        <meshStandardMaterial color="#070614" metalness={0.48} roughness={0.55} />
      </mesh>
      <gridHelper args={[58, 58, "#2a1850", "#10081c"]} position={[0, 0.02, 0]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <ringGeometry args={[6.0, 6.35, 80]} />
        <meshBasicMaterial color="#a855f7" transparent opacity={0.45} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <ringGeometry args={[10.9, 11.15, 80]} />
        <meshBasicMaterial color="#22d3ee" transparent opacity={0.18} />
      </mesh>
    </>
  );
}

function OrbitXTower({ district, pulsing, onPick }: { district?: TokenDistrict; pulsing: boolean; onPick: () => void }) {
  const glow = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    if (!glow.current) return;
    glow.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 2) * (pulsing ? 0.2 : 0.07));
  });
  const cap = district?.market_cap != null ? fmtUsd(district.market_cap) : null;
  return (
    <group onClick={(e) => { e.stopPropagation(); onPick(); }}>
      <mesh position={[0, 3.1, 0]} castShadow>
        <cylinderGeometry args={[0.62, 1.45, 6.2, 8]} />
        <meshStandardMaterial color="#7c3aed" emissive="#6d28d9" emissiveIntensity={0.85} metalness={0.55} roughness={0.2} />
      </mesh>
      <mesh ref={glow} position={[0, 6.5, 0]}>
        <octahedronGeometry args={[0.72, 0]} />
        <meshStandardMaterial color="#f5d0fe" emissive="#c084fc" emissiveIntensity={1.4} />
      </mesh>
      <pointLight position={[0, 6.8, 0]} intensity={pulsing ? 50 : 32} distance={22} color="#c084fc" />
      <Html center distanceFactor={20} position={[0, 7.6, 0]}>
        <div className="oxw-tag oxw-tag-ox">ORBITX{cap ? ` · ${cap}` : ""}</div>
      </Html>
    </group>
  );
}

function DexBuilding({ id, label, onPick }: { id: string; label: string; onPick: () => void }) {
  const pos = HUB_POS[id] || [12, 0, 0];
  const color = id === "jupiter" ? "#22d3ee" : id === "raydium" ? "#a78bfa" : "#fb923c";
  return (
    <group position={pos} onClick={(e) => { e.stopPropagation(); onPick(); }}>
      <mesh position={[0, 1.35, 0]}>
        <boxGeometry args={[2.6, 2.7, 2.6]} />
        <meshStandardMaterial color="#161325" emissive={new Color(color)} emissiveIntensity={0.28} metalness={0.45} roughness={0.35} />
      </mesh>
      <Html center distanceFactor={24} position={[0, 3.05, 0]}>
        <div className="oxw-tag">{label}</div>
      </Html>
    </group>
  );
}

function TokenBuilding({ district, index, total, onPick }: { district: TokenDistrict; index: number; total: number; onPick: () => void }) {
  const pos = useMemo(() => tokenPos(district.mint, index, total), [district.mint, index, total]);
  const h = 1.15 + Math.min(3.2, Math.log10(Math.max(district.market_cap || district.volume_24h || 10, 10)) * 0.55);
  const tone = district.source === "pumpfun" ? "#fb923c" : "#67e8f9";
  const sub = district.market_cap != null ? fmtUsd(district.market_cap) : district.volume_24h != null ? `${fmtNum(district.volume_24h)} VOL` : null;
  return (
    <group position={pos} onClick={(e) => { e.stopPropagation(); onPick(); }}>
      <mesh position={[0, h / 2, 0]} castShadow>
        <boxGeometry args={[1.05, h, 1.05]} />
        <meshStandardMaterial color="#1b1730" emissive={tone} emissiveIntensity={0.22} metalness={0.4} roughness={0.4} />
      </mesh>
      <Html center distanceFactor={26} position={[0, h + 0.42, 0]}>
        <div className="oxw-tag">
          ${district.symbol || district.mint.slice(0, 4)}
          {sub ? <span> {sub}</span> : null}
        </div>
      </Html>
    </group>
  );
}

function Agent({
  label,
  kol,
  whale,
  followed,
  pos,
  onPick,
}: {
  label: string;
  kol: boolean;
  whale: boolean;
  followed: boolean;
  pos: [number, number, number];
  onPick: () => void;
}) {
  const ref = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.position.y = 0.22 + Math.sin(clock.elapsedTime * 2.1 + pos[0]) * 0.06;
    ref.current.rotation.y += 0.01;
  });
  const color = followed ? "#f0abfc" : kol ? "#e879f9" : whale ? "#fbbf24" : "#38bdf8";
  const s = whale ? 0.28 : kol ? 0.2 : 0.14;
  return (
    <group ref={ref} position={pos} onClick={(e) => { e.stopPropagation(); onPick(); }}>
      <mesh>
        <octahedronGeometry args={[s, 0]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.85} metalness={0.3} roughness={0.25} />
      </mesh>
      {(kol || followed) && (
        <Html center distanceFactor={18} position={[0, 0.55, 0]}>
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
  const start: [number, number, number] = [from[0], from[1] + 0.7, from[2]];
  const end: [number, number, number] = [to[0], to[1] + 1.3, to[2]];
  const mid: [number, number, number] = [(start[0] + end[0]) / 2, Math.max(start[1], end[1]) + 2.1, (start[2] + end[2]) / 2];
  const color = eventColor(event.event_type);
  const scale = highlight || event.whale_related || event.orbitx_related ? 0.2 : 0.09;
  useFrame(({ clock }) => {
    const t = (clock.elapsedTime * (0.2 + Math.min(event.importance, 50) / 90) + hash(event.event_id) / 1e9) % 1;
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
      <Line points={[start, mid, end]} color={color} transparent opacity={highlight ? 0.75 : 0.28} lineWidth={event.orbitx_related || highlight ? 2 : 1} />
      <mesh ref={ref} onClick={(e) => { e.stopPropagation(); onPick(); }}>
        <sphereGeometry args={[scale, 8, 8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1} />
      </mesh>
    </group>
  );
}

function Callout({ event, pos, onPick }: { event: ChainEvent; pos: [number, number, number]; onPick: () => void }) {
  return (
    <Html center distanceFactor={22} position={[pos[0], 3.4, pos[2]]}>
      <button type="button" className="oxw-callout" onClick={(e) => { e.stopPropagation(); onPick(); }}>
        <b>{event.event_type.replace(/_/g, " ")}</b>
        <span>{event.token_symbol ? `$${event.token_symbol}` : ""} {event.amount != null ? fmtNum(event.amount) : ""}</span>
      </button>
    </Html>
  );
}

function CameraRig({
  target,
  controls,
  cam,
}: {
  target: [number, number, number] | null;
  controls: RefObject<{ target: Vector3 } | null>;
  cam: CamCommand;
}) {
  const { camera } = useThree();
  const goal = useRef(new Vector3(15, 11, 17));
  useEffect(() => {
    if (cam?.kind === "reset") goal.current.set(15, 11, 17);
    if (cam?.kind === "orbitx") goal.current.set(8, 8, 10);
    if (target && (cam?.kind === "follow" || cam?.kind === "wallet" || cam?.kind === "token")) {
      goal.current.set(target[0] + 6.4, 7.2, target[2] + 7.4);
    }
  }, [cam, target]);
  useFrame(() => {
    camera.position.lerp(goal.current, 0.04);
    if (target && controls.current && cam && cam.kind !== "reset") {
      controls.current.target.lerp(new Vector3(target[0], 1.2, target[2]), 0.06);
    }
  });
  return null;
}

function Scene({ events, kols, flows, districts, followId, followWallet, cinematic, cam, onPick }: Props) {
  const controls = useRef<{ target: Vector3 } | null>(null);
  const assigned = useMemo(() => (kols?.length ? kols.filter((k) => k.status !== "disputed") : activeOrbitxKols()), [kols]);
  const kolIndex = useMemo(() => {
    const m = new Map<string, number>();
    assigned.forEach((k, i) => m.set(k.address, i));
    return m;
  }, [assigned]);
  const tokens = districts?.tokens || [];
  const tokenIndex = useMemo(() => {
    const m = new Map<string, [number, number, number]>();
    tokens.forEach((t, i) => m.set(t.mint, tokenPos(t.mint, i, tokens.length)));
    m.set(ORBITX_MINT, [0, 0, 0]);
    return m;
  }, [tokens]);

  const extraWallets = useMemo(() => {
    const set = new Set<string>();
    for (const e of events) {
      const addr = e.wallet || e.source_wallet;
      if (addr && !kolIndex.has(addr)) set.add(addr);
    }
    return [...set].slice(0, 10);
  }, [events, kolIndex]);

  const vis = events.filter((e) => e.importance >= 6 || e.orbitx_related || e.kol_related).slice(0, 28);
  const burns = events.filter((e) => e.event_type.includes("BURN") && e.orbitx_related);
  const callouts = vis.filter((e) => e.importance >= 18 || e.orbitx_related).slice(0, 4);

  const follow = followWallet
    ? walletPos(followWallet, kolIndex.get(followWallet) ?? -1, assigned.length, kolIndex.has(followWallet))
    : cam?.kind === "token" && cam.mint
      ? tokenIndex.get(cam.mint) || [0, 0, 0]
      : cam?.kind === "orbitx"
        ? [0, 0, 0] as [number, number, number]
        : null;

  return (
    <>
      <color attach="background" args={["#05030c"]} />
      <fog attach="fog" args={["#05030c", 18, 48]} />
      <ambientLight intensity={0.26} />
      <directionalLight position={[9, 16, 6]} intensity={0.8} color="#ddd6fe" />
      <Stars radius={70} depth={30} count={1600} factor={2} fade speed={0.3} />
      <Ground />
      <OrbitXTower district={districts?.orbitx} pulsing={burns.length > 0} onPick={() => onPick({ kind: "token", mint: ORBITX_MINT })} />
      {burns.length > 0 ? <Sparkles count={56} scale={[3.6, 5, 3.6]} size={4} color="#f59e0b" position={[0, 3.6, 0]} /> : null}
      {(districts?.hubs || []).map((h) => (
        <DexBuilding key={h.id} id={h.id} label={h.label} onPick={() => onPick({ kind: "hub", id: h.id })} />
      ))}
      {tokens.filter((t) => !isOrbitxMint(t.mint)).map((t, i) => (
        <TokenBuilding key={t.mint} district={t} index={i} total={tokens.length} onPick={() => onPick({ kind: "token", mint: t.mint })} />
      ))}
      {assigned.map((k, i) => (
        <Agent
          key={k.address}
          label={k.name}
          kol
          whale={false}
          followed={followWallet === k.address}
          pos={walletPos(k.address, i, assigned.length, true)}
          onPick={() => onPick({ kind: "wallet", address: k.address })}
        />
      ))}
      {extraWallets.map((addr) => (
        <Agent
          key={addr}
          label={addr.slice(0, 4)}
          kol={false}
          whale={events.some((e) => e.wallet === addr && e.whale_related)}
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
          : event.token_ca && tokenIndex.get(event.token_ca)
            ? tokenIndex.get(event.token_ca)!
            : HUB_POS.jupiter;
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
      {callouts.map((event) => {
        const addr = event.wallet || event.source_wallet || event.signature;
        return (
          <Callout
            key={`c-${event.event_id}`}
            event={event}
            pos={walletPos(addr, kolIndex.get(addr) ?? -1, assigned.length, kolIndex.has(addr))}
            onPick={() => onPick({ kind: "event", event })}
          />
        );
      })}
      {(flows || []).slice(0, 10).map((f) => (
        <Line
          key={`${f.from_address}-${f.to_address}-${f.last_signature || ""}`}
          points={[
            walletPos(f.from_address, kolIndex.get(f.from_address) ?? -1, assigned.length, kolIndex.has(f.from_address)),
            walletPos(f.to_address, kolIndex.get(f.to_address) ?? -1, assigned.length, kolIndex.has(f.to_address)),
          ]}
          color="#818cf8"
          transparent
          opacity={0.12}
        />
      ))}
      <CameraRig target={follow} controls={controls} cam={cam || null} />
      <OrbitControls
        ref={controls}
        enablePan
        enableZoom
        maxDistance={44}
        minDistance={5}
        autoRotate={Boolean(cinematic) && !followWallet}
        autoRotateSpeed={0.22}
      />
    </>
  );
}

export default function WorldCanvas(props: Props) {
  return (
    <Canvas camera={{ position: [15, 11, 17], fov: 46 }} dpr={[1, 1.5]} shadows>
      <Scene {...props} />
    </Canvas>
  );
}
